import { Types } from 'mongoose';
import { logger } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { TModelBudgetsConfig } from 'librechat-data-provider';
import type { ServerRequest } from '~/types/http';

const CREDITS_PER_USD = 1_000_000;

export type BudgetSnapshotLike = {
  bucket?: string;
  allocatedCredits?: number;
  spentCredits?: number;
  [key: string]: unknown;
};

export type AuditAction = 'budget.set_allocation' | 'budget.reset_spent' | 'budget.set_both';

export interface AuditEntry {
  actor: { id: string; email?: string; role?: string };
  action: AuditAction;
  target: { type: 'user'; id: string; email?: string };
  resource: { type: 'modelBudget'; key: string };
  before?: { allocatedCredits?: number; spentCredits?: number } | null;
  after?: { allocatedCredits?: number; spentCredits?: number } | null;
  context?: { ip?: string; userAgent?: string } | null;
}

export interface AdminBudgetsDeps {
  /** Returns the runtime modelBudgets config for the request, or null when disabled. */
  getConfig: (req: ServerRequest) => TModelBudgetsConfig | null;
  /** Returns all budget snapshots for a user (lazy-resets each one). */
  getUserBudgets: (
    userId: string,
    config: TModelBudgetsConfig,
  ) => Promise<BudgetSnapshotLike[]>;
  /** Atomic admin override of allocated/spent credits for a user/bucket pair. */
  setUserBudget: (
    userId: string,
    bucketKey: string,
    updates: { allocatedCredits?: number; spentCredits?: number },
    config: TModelBudgetsConfig,
  ) => Promise<BudgetSnapshotLike>;
  /** Optional: lookup target user's email for audit context. */
  findUserEmail?: (userId: string) => Promise<string | undefined>;
  /** Optional: append-only audit recorder. Called best-effort after a successful mutation. */
  recordAudit?: (entry: AuditEntry) => Promise<void>;
}

function isValidUserId(id: string | undefined): id is string {
  return typeof id === 'string' && Types.ObjectId.isValid(id);
}

function parseCreditAmount(value: unknown, unit: 'credits' | 'usd'): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return unit === 'usd' ? Math.round(n * CREDITS_PER_USD) : Math.round(n);
}

function pickAuditAction(
  before: { allocatedCredits?: number; spentCredits?: number } | undefined,
  after: { allocatedCredits?: number; spentCredits?: number },
): AuditAction {
  const allocChanged =
    before?.allocatedCredits !== after.allocatedCredits;
  const spentReset =
    after.spentCredits === 0 && (before?.spentCredits ?? 0) > 0;
  if (allocChanged && spentReset) return 'budget.set_both';
  if (allocChanged) return 'budget.set_allocation';
  if (spentReset) return 'budget.reset_spent';
  return 'budget.set_allocation';
}

export function createAdminBudgetsHandlers(deps: AdminBudgetsDeps) {
  const { getConfig, getUserBudgets, setUserBudget, findUserEmail, recordAudit } = deps;

  function ensureConfigOr404(req: ServerRequest, res: Response): TModelBudgetsConfig | null {
    const config = getConfig(req);
    if (!config) {
      res.status(404).json({ error: 'modelBudgets disabled or not configured' });
      return null;
    }
    return config;
  }

  async function getBudgetsHandler(req: ServerRequest, res: Response) {
    try {
      const params = req.params as Record<string, string | undefined>;
      const userId = params.userId;
      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: 'Invalid userId' });
      }
      const config = ensureConfigOr404(req, res);
      if (!config) return;

      const budgets = await getUserBudgets(userId, config);
      return res.status(200).json({ userId, budgets });
    } catch (err) {
      logger.error('[adminBudgets] getBudgets error:', err);
      return res.status(500).json({ error: 'Failed to load user budgets' });
    }
  }

  async function setBudgetHandler(req: ServerRequest, res: Response) {
    try {
      const params = req.params as Record<string, string | undefined>;
      const userId = params.userId;
      const bucketKey = params.bucket;
      if (!isValidUserId(userId)) {
        return res.status(400).json({ error: 'Invalid userId' });
      }
      if (!bucketKey || typeof bucketKey !== 'string') {
        return res.status(400).json({ error: 'Invalid bucket' });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const allocatedCredits =
        body.allocatedCredits != null
          ? parseCreditAmount(body.allocatedCredits, 'credits')
          : parseCreditAmount(body.allocatedUsd, 'usd');
      const spentCredits =
        body.spentCredits != null
          ? parseCreditAmount(body.spentCredits, 'credits')
          : parseCreditAmount(body.spentUsd, 'usd');

      if (allocatedCredits === undefined && spentCredits === undefined) {
        return res
          .status(400)
          .json({ error: 'Provide allocatedCredits/allocatedUsd or spentCredits/spentUsd' });
      }

      const config = ensureConfigOr404(req, res);
      if (!config) return;

      const bucketExists = (config.buckets ?? []).some((b) => b.key === bucketKey);
      if (!bucketExists) {
        return res.status(404).json({ error: `Bucket "${bucketKey}" not defined in config` });
      }

      let beforeSnap: BudgetSnapshotLike | undefined;
      if (recordAudit) {
        try {
          const all = await getUserBudgets(userId, config);
          beforeSnap = all.find((b) => b.bucket === bucketKey);
        } catch (err) {
          logger.warn('[adminBudgets] failed to read before-snapshot for audit', err);
        }
      }

      const snapshot = await setUserBudget(
        userId,
        bucketKey,
        { allocatedCredits, spentCredits },
        config,
      );

      if (recordAudit) {
        const reqUser = (req.user ?? {}) as {
          _id?: { toString(): string };
          id?: string;
          email?: string;
          role?: string;
        };
        const actorId =
          reqUser._id != null ? reqUser._id.toString() : (reqUser.id as string | undefined);
        if (actorId) {
          let targetEmail: string | undefined;
          if (findUserEmail) {
            try {
              targetEmail = await findUserEmail(userId);
            } catch (err) {
              logger.warn('[adminBudgets] failed to resolve target email for audit', err);
            }
          }
          const action = pickAuditAction(
            beforeSnap
              ? {
                  allocatedCredits: beforeSnap.allocatedCredits,
                  spentCredits: beforeSnap.spentCredits,
                }
              : undefined,
            {
              allocatedCredits: snapshot.allocatedCredits,
              spentCredits: snapshot.spentCredits,
            },
          );
          await recordAudit({
            actor: { id: actorId, email: reqUser.email, role: reqUser.role },
            action,
            target: { type: 'user', id: userId, email: targetEmail },
            resource: { type: 'modelBudget', key: bucketKey },
            before: beforeSnap
              ? {
                  allocatedCredits: beforeSnap.allocatedCredits,
                  spentCredits: beforeSnap.spentCredits,
                }
              : null,
            after: {
              allocatedCredits: snapshot.allocatedCredits,
              spentCredits: snapshot.spentCredits,
            },
            context: {
              ip: typeof req.ip === 'string' ? req.ip : undefined,
              userAgent:
                typeof req.headers?.['user-agent'] === 'string'
                  ? (req.headers['user-agent'] as string)
                  : undefined,
            },
          });
        }
      }

      return res.status(200).json({ userId, bucket: bucketKey, budget: snapshot });
    } catch (err) {
      logger.error('[adminBudgets] setBudget error:', err);
      return res.status(500).json({ error: 'Failed to update user budget' });
    }
  }

  return { getBudgets: getBudgetsHandler, setBudget: setBudgetHandler };
}
