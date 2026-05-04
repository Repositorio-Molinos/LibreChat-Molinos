import { Types } from 'mongoose';
import { logger } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { Model, PipelineStage } from 'mongoose';
type ITransaction = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  model?: string;
  tokenType: 'prompt' | 'completion' | 'credits';
  rawAmount?: number;
  tokenValue?: number;
  inputTokens?: number;
  writeTokens?: number;
  readTokens?: number;
  createdAt?: Date;
};
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

export type UsageGroupBy = 'user' | 'model' | 'user-model';

export interface UsageRow {
  groupKey: string;
  userId?: string;
  email?: string;
  name?: string;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  cacheTokens: number;
  totalTokens: number;
  spentMicroUsd: number;
  spentUsd: number;
  txCount: number;
  firstAt?: string;
  lastAt?: string;
}

export interface AdminUsageDeps {
  Transaction: Model<ITransaction>;
}

const VALID_GROUP_BY: ReadonlySet<UsageGroupBy> = new Set(['user', 'model', 'user-model']);

function parseDate(raw: unknown, fallback: Date): Date {
  if (typeof raw !== 'string' || !raw) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function buildGroupId(groupBy: UsageGroupBy) {
  if (groupBy === 'user') return { user: '$user' };
  if (groupBy === 'model') return { model: '$model' };
  return { user: '$user', model: '$model' };
}

function defaultRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function createAdminUsageHandlers(deps: AdminUsageDeps) {
  const { Transaction } = deps;

  async function listUsageHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query as { limit?: string; offset?: string });
      const range = defaultRange();
      const from = parseDate((req.query as { from?: string }).from, range.from);
      const to = parseDate((req.query as { to?: string }).to, range.to);
      const rawGroupBy = (req.query as { groupBy?: string }).groupBy;
      const groupBy: UsageGroupBy = VALID_GROUP_BY.has(rawGroupBy as UsageGroupBy)
        ? (rawGroupBy as UsageGroupBy)
        : 'user';

      const userFilter = (req.query as { userId?: string }).userId;
      const modelFilter = (req.query as { model?: string }).model;

      const match: Record<string, unknown> = {
        createdAt: { $gte: from, $lte: to },
      };
      if (userFilter && Types.ObjectId.isValid(userFilter)) {
        match.user = new Types.ObjectId(userFilter);
      }
      if (modelFilter) {
        match.model = modelFilter;
      }

      const pipeline: PipelineStage[] = [
        { $match: match },
        {
          $project: {
            user: 1,
            model: 1,
            tokenType: 1,
            createdAt: 1,
            absValue: { $abs: { $ifNull: ['$tokenValue', 0] } },
            promptTokens: {
              $cond: [
                { $eq: ['$tokenType', 'prompt'] },
                {
                  $abs: {
                    $add: [
                      { $ifNull: ['$rawAmount', 0] },
                      { $ifNull: ['$inputTokens', 0] },
                    ],
                  },
                },
                0,
              ],
            },
            completionTokens: {
              $cond: [
                { $eq: ['$tokenType', 'completion'] },
                { $abs: { $ifNull: ['$rawAmount', 0] } },
                0,
              ],
            },
            cacheTokens: {
              $abs: {
                $add: [{ $ifNull: ['$writeTokens', 0] }, { $ifNull: ['$readTokens', 0] }],
              },
            },
          },
        },
        {
          $group: {
            _id: buildGroupId(groupBy),
            promptTokens: { $sum: '$promptTokens' },
            completionTokens: { $sum: '$completionTokens' },
            cacheTokens: { $sum: '$cacheTokens' },
            spentMicroUsd: { $sum: '$absValue' },
            txCount: { $sum: 1 },
            firstAt: { $min: '$createdAt' },
            lastAt: { $max: '$createdAt' },
          },
        },
        { $sort: { spentMicroUsd: -1 } },
      ];

      const totalsPromise = Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSpentMicroUsd: { $sum: { $abs: { $ifNull: ['$tokenValue', 0] } } },
            totalTx: { $sum: 1 },
            distinctUsers: { $addToSet: '$user' },
            distinctModels: { $addToSet: '$model' },
          },
        },
      ]);

      const facetPipeline: PipelineStage[] = [
        ...pipeline,
        {
          $facet: {
            rows: [{ $skip: offset }, { $limit: limit }],
            count: [{ $count: 'value' }],
          },
        },
      ];

      const [facetResult, totalsResult] = await Promise.all([
        Transaction.aggregate(facetPipeline),
        totalsPromise,
      ]);

      const facet = facetResult[0] ?? { rows: [], count: [] };
      const groupCount: number = facet.count[0]?.value ?? 0;
      const totals = totalsResult[0] ?? {
        totalSpentMicroUsd: 0,
        totalTx: 0,
        distinctUsers: [],
        distinctModels: [],
      };

      const userIds = new Set<string>();
      for (const r of facet.rows as Array<{ _id: { user?: Types.ObjectId } }>) {
        if (r._id?.user) userIds.add(r._id.user.toString());
      }

      const userById = new Map<string, { email?: string; name?: string }>();
      if (userIds.size > 0) {
        const UserModel = Transaction.db.models.User;
        if (UserModel) {
          const users = await UserModel.find(
            { _id: { $in: Array.from(userIds).map((id) => new Types.ObjectId(id)) } },
            { email: 1, name: 1 },
          ).lean();
          for (const u of users as Array<{ _id: Types.ObjectId; email?: string; name?: string }>) {
            userById.set(u._id.toString(), { email: u.email, name: u.name });
          }
        }
      }

      const rows: UsageRow[] = (
        facet.rows as Array<{
          _id: { user?: Types.ObjectId; model?: string };
          promptTokens: number;
          completionTokens: number;
          cacheTokens: number;
          spentMicroUsd: number;
          txCount: number;
          firstAt?: Date;
          lastAt?: Date;
        }>
      ).map((r) => {
        const userId = r._id?.user?.toString();
        const userInfo = userId ? userById.get(userId) : undefined;
        const promptTokens = r.promptTokens ?? 0;
        const completionTokens = r.completionTokens ?? 0;
        const cacheTokens = r.cacheTokens ?? 0;
        const totalTokens = promptTokens + completionTokens + cacheTokens;
        const spentMicroUsd = r.spentMicroUsd ?? 0;
        const groupKey =
          groupBy === 'user'
            ? `user:${userId ?? 'unknown'}`
            : groupBy === 'model'
              ? `model:${r._id?.model ?? 'unknown'}`
              : `user:${userId ?? 'unknown'}|model:${r._id?.model ?? 'unknown'}`;
        return {
          groupKey,
          userId,
          email: userInfo?.email,
          name: userInfo?.name,
          model: r._id?.model,
          promptTokens,
          completionTokens,
          cacheTokens,
          totalTokens,
          spentMicroUsd,
          spentUsd: spentMicroUsd / 1_000_000,
          txCount: r.txCount ?? 0,
          firstAt: r.firstAt?.toISOString(),
          lastAt: r.lastAt?.toISOString(),
        };
      });

      return res.status(200).json({
        from: from.toISOString(),
        to: to.toISOString(),
        groupBy,
        rows,
        groupCount,
        totals: {
          spentMicroUsd: totals.totalSpentMicroUsd ?? 0,
          spentUsd: (totals.totalSpentMicroUsd ?? 0) / 1_000_000,
          txCount: totals.totalTx ?? 0,
          uniqueUsers: (totals.distinctUsers ?? []).length,
          uniqueModels: (totals.distinctModels ?? []).filter((m: string | null) => !!m).length,
        },
        limit,
        offset,
      });
    } catch (error) {
      logger.error('[adminUsage] listUsage error:', error);
      return res.status(500).json({ error: 'Failed to load usage' });
    }
  }

  return { listUsage: listUsageHandler };
}
