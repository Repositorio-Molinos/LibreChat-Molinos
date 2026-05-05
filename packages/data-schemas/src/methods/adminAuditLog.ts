import logger from '~/config/winston';
import type { Types, FilterQuery } from 'mongoose';
import type { IAdminAuditLog, AdminAuditAction } from '~/schema/adminAuditLog';

export interface AdminAuditEntryInput {
  actor: { id: Types.ObjectId | string; email?: string; role?: string };
  action: AdminAuditAction;
  target: { type: 'user'; id: Types.ObjectId | string; email?: string };
  resource: { type: 'modelBudget'; key: string };
  before?: { allocatedCredits?: number; spentCredits?: number } | null;
  after?: { allocatedCredits?: number; spentCredits?: number } | null;
  context?: { ip?: string; userAgent?: string } | null;
}

export interface AdminAuditQueryOptions {
  from?: Date;
  to?: Date;
  actorId?: string;
  targetUserId?: string;
  action?: AdminAuditAction;
  limit?: number;
  offset?: number;
}

export function createAdminAuditLogMethods(mongoose: typeof import('mongoose')) {
  /**
   * Append-only insert. Errors are logged but never propagated — admin actions
   * must succeed even if the audit write fails.
   */
  async function recordAdminAudit(entry: AdminAuditEntryInput): Promise<void> {
    try {
      const AdminAuditLog = mongoose.models.AdminAuditLog;
      if (!AdminAuditLog) {
        logger.warn('[adminAudit] model not registered, skipping');
        return;
      }
      await AdminAuditLog.create(entry);
    } catch (err) {
      logger.error('[adminAudit] failed to record entry', err);
    }
  }

  async function listAdminAudit(opts: AdminAuditQueryOptions = {}): Promise<{
    rows: IAdminAuditLog[];
    total: number;
  }> {
    const AdminAuditLog = mongoose.models.AdminAuditLog;
    if (!AdminAuditLog) {
      return { rows: [], total: 0 };
    }

    const filter: FilterQuery<IAdminAuditLog> = {};
    if (opts.from || opts.to) {
      filter.createdAt = {};
      if (opts.from) (filter.createdAt as Record<string, Date>).$gte = opts.from;
      if (opts.to) (filter.createdAt as Record<string, Date>).$lte = opts.to;
    }
    if (opts.actorId) {
      filter['actor.id'] = new mongoose.Types.ObjectId(opts.actorId);
    }
    if (opts.targetUserId) {
      filter['target.id'] = new mongoose.Types.ObjectId(opts.targetUserId);
    }
    if (opts.action) {
      filter.action = opts.action;
    }

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);

    const [rows, total] = await Promise.all([
      AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean() as Promise<
        IAdminAuditLog[]
      >,
      AdminAuditLog.countDocuments(filter),
    ]);

    return { rows, total };
  }

  return { recordAdminAudit, listAdminAudit };
}

export type AdminAuditLogMethods = ReturnType<typeof createAdminAuditLogMethods>;
