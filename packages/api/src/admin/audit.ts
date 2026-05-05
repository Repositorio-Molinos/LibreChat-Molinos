import { Types } from 'mongoose';
import { logger } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

export type AuditAction = 'budget.set_allocation' | 'budget.reset_spent' | 'budget.set_both';

export interface AdminAuditEntry {
  _id?: { toString(): string };
  actor: { id: { toString(): string }; email?: string; role?: string };
  action: AuditAction;
  target: { type: 'user'; id: { toString(): string }; email?: string };
  resource: { type: 'modelBudget'; key: string };
  before?: { allocatedCredits?: number; spentCredits?: number } | null;
  after?: { allocatedCredits?: number; spentCredits?: number } | null;
  context?: { ip?: string; userAgent?: string } | null;
  createdAt?: Date;
}

export interface AdminAuditDeps {
  listAdminAudit: (opts: {
    from?: Date;
    to?: Date;
    actorId?: string;
    targetUserId?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  }) => Promise<{ rows: AdminAuditEntry[]; total: number }>;
}

const VALID_ACTIONS = new Set<AuditAction>([
  'budget.set_allocation',
  'budget.reset_spent',
  'budget.set_both',
]);

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function defaultRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function createAdminAuditHandlers(deps: AdminAuditDeps) {
  const { listAdminAudit } = deps;

  async function listHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(
        req.query as { limit?: string; offset?: string },
      );
      const range = defaultRange();
      const query = req.query as Record<string, string | undefined>;

      const from = parseDate(query.from) ?? range.from;
      const to = parseDate(query.to) ?? range.to;

      const actorId =
        query.actorId && Types.ObjectId.isValid(query.actorId) ? query.actorId : undefined;
      const targetUserId =
        query.targetUserId && Types.ObjectId.isValid(query.targetUserId)
          ? query.targetUserId
          : undefined;
      const action =
        query.action && VALID_ACTIONS.has(query.action as AuditAction)
          ? (query.action as AuditAction)
          : undefined;

      const { rows, total } = await listAdminAudit({
        from,
        to,
        actorId,
        targetUserId,
        action,
        limit,
        offset,
      });

      const mapped = rows.map((r) => ({
        id: r._id?.toString() ?? '',
        action: r.action,
        actor: {
          id: r.actor.id?.toString() ?? '',
          email: r.actor.email,
          role: r.actor.role,
        },
        target: {
          type: r.target.type,
          id: r.target.id?.toString() ?? '',
          email: r.target.email,
        },
        resource: r.resource,
        before: r.before ?? null,
        after: r.after ?? null,
        context: r.context ?? null,
        createdAt: r.createdAt?.toISOString(),
      }));

      return res.status(200).json({
        from: from.toISOString(),
        to: to.toISOString(),
        rows: mapped,
        total,
        limit,
        offset,
      });
    } catch (err) {
      logger.error('[adminAudit] list error:', err);
      return res.status(500).json({ error: 'Failed to load audit log' });
    }
  }

  return { list: listHandler };
}
