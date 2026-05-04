import { Types } from 'mongoose';
import { logger } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { TModelBudgetsConfig } from 'librechat-data-provider';
import type { ServerRequest } from '~/types/http';

const CREDITS_PER_USD = 1_000_000;

export interface AdminBudgetsDeps {
  /** Returns the runtime modelBudgets config for the request, or null when disabled. */
  getConfig: (req: ServerRequest) => TModelBudgetsConfig | null;
  /** Returns all budget snapshots for a user (lazy-resets each one). */
  getUserBudgets: (
    userId: string,
    config: TModelBudgetsConfig,
  ) => Promise<Array<Record<string, unknown>>>;
  /** Atomic admin override of allocated/spent credits for a user/bucket pair. */
  setUserBudget: (
    userId: string,
    bucketKey: string,
    updates: { allocatedCredits?: number; spentCredits?: number },
    config: TModelBudgetsConfig,
  ) => Promise<Record<string, unknown>>;
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

export function createAdminBudgetsHandlers(deps: AdminBudgetsDeps) {
  const { getConfig, getUserBudgets, setUserBudget } = deps;

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

      const snapshot = await setUserBudget(
        userId,
        bucketKey,
        { allocatedCredits, spentCredits },
        config,
      );
      return res.status(200).json({ userId, bucket: bucketKey, budget: snapshot });
    } catch (err) {
      logger.error('[adminBudgets] setBudget error:', err);
      return res.status(500).json({ error: 'Failed to update user budget' });
    }
  }

  return { getBudgets: getBudgetsHandler, setBudget: setBudgetHandler };
}
