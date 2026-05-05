import { Types } from 'mongoose';
import type { Response } from 'express';
import type { Model } from 'mongoose';
import type { ServerRequest } from '~/types/http';
import { createAdminUsageHandlers } from './usage';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function createReqRes(overrides: { query?: Record<string, string> } = {}) {
  const req = {
    params: {},
    query: overrides.query ?? {},
    body: {},
    user: { _id: new Types.ObjectId(), role: 'admin' },
  } as unknown as ServerRequest;

  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  return { req, res, status, json };
}

interface MockTransactionRow {
  _id?: { user?: Types.ObjectId; model?: string } | null;
  promptTokens?: number;
  completionTokens?: number;
  cacheTokens?: number;
  spentMicroUsd?: number;
  txCount?: number;
  firstAt?: Date;
  lastAt?: Date;
}

function createTransactionMock(opts: {
  rows?: MockTransactionRow[];
  groupCount?: number;
  totals?: {
    totalSpentMicroUsd?: number;
    totalTx?: number;
    distinctUsers?: Types.ObjectId[];
    distinctModels?: (string | null)[];
  };
  users?: Array<{ _id: Types.ObjectId; email?: string; name?: string }>;
}) {
  const rows = opts.rows ?? [];
  const groupCount = opts.groupCount ?? rows.length;
  const totals = opts.totals ?? {
    totalSpentMicroUsd: 0,
    totalTx: 0,
    distinctUsers: [],
    distinctModels: [],
  };
  const users = opts.users ?? [];

  const aggregate = jest.fn((pipeline) => {
    const stages = Array.isArray(pipeline) ? pipeline : [];
    const hasFacet = stages.some((s) => s && typeof s === 'object' && '$facet' in s);
    if (hasFacet) {
      return Promise.resolve([{ rows, count: [{ value: groupCount }] }]);
    }
    return Promise.resolve([totals]);
  });

  const lean = jest.fn().mockResolvedValue(users);
  const find = jest.fn(() => ({ lean }));

  const Transaction = {
    aggregate,
    db: {
      models: {
        User: { find },
      },
    },
  } as unknown as Model<unknown>;

  return { Transaction, aggregate, find };
}

describe('createAdminUsageHandlers', () => {
  it('returns empty result with sane defaults', async () => {
    const { Transaction } = createTransactionMock({});
    const handlers = createAdminUsageHandlers({ Transaction: Transaction as never });
    const { req, res, status, json } = createReqRes();

    await handlers.listUsage(req, res);

    expect(status).toHaveBeenCalledWith(200);
    const body = json.mock.calls[0][0];
    expect(body.rows).toEqual([]);
    expect(body.groupCount).toBe(0);
    expect(body.groupBy).toBe('user');
    expect(body.totals).toEqual({
      spentMicroUsd: 0,
      spentUsd: 0,
      txCount: 0,
      uniqueUsers: 0,
      uniqueModels: 0,
    });
    expect(body.from).toBeDefined();
    expect(body.to).toBeDefined();
  });

  it('aggregates rows and joins user info when groupBy=user', async () => {
    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();
    const { Transaction } = createTransactionMock({
      rows: [
        {
          _id: { user: userA },
          promptTokens: 1000,
          completionTokens: 200,
          cacheTokens: 0,
          spentMicroUsd: 5_000_000,
          txCount: 10,
          firstAt: new Date('2026-01-01'),
          lastAt: new Date('2026-01-15'),
        },
        {
          _id: { user: userB },
          promptTokens: 500,
          completionTokens: 100,
          cacheTokens: 50,
          spentMicroUsd: 2_500_000,
          txCount: 5,
        },
      ],
      groupCount: 2,
      totals: {
        totalSpentMicroUsd: 7_500_000,
        totalTx: 15,
        distinctUsers: [userA, userB],
        distinctModels: ['claude-haiku-4-5', null],
      },
      users: [
        { _id: userA, email: 'a@example.com', name: 'Alice' },
        { _id: userB, email: 'b@example.com', name: 'Bob' },
      ],
    });

    const handlers = createAdminUsageHandlers({ Transaction: Transaction as never });
    const { req, res, json } = createReqRes({ query: { groupBy: 'user' } });
    await handlers.listUsage(req, res);

    const body = json.mock.calls[0][0];
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0].email).toBe('a@example.com');
    expect(body.rows[0].name).toBe('Alice');
    expect(body.rows[0].spentUsd).toBe(5);
    expect(body.rows[0].totalTokens).toBe(1200);
    expect(body.rows[0].groupKey).toBe(`user:${userA.toString()}`);
    expect(body.rows[1].email).toBe('b@example.com');
    expect(body.rows[1].totalTokens).toBe(650);
    expect(body.totals.spentUsd).toBe(7.5);
    expect(body.totals.uniqueUsers).toBe(2);
    expect(body.totals.uniqueModels).toBe(1);
  });

  it('groups by model and skips user lookup', async () => {
    const { Transaction, find } = createTransactionMock({
      rows: [
        {
          _id: { model: 'claude-haiku-4-5' },
          promptTokens: 100,
          completionTokens: 20,
          cacheTokens: 0,
          spentMicroUsd: 100_000,
          txCount: 1,
        },
      ],
      groupCount: 1,
    });

    const handlers = createAdminUsageHandlers({ Transaction: Transaction as never });
    const { req, res, json } = createReqRes({ query: { groupBy: 'model' } });
    await handlers.listUsage(req, res);

    const body = json.mock.calls[0][0];
    expect(body.rows[0].model).toBe('claude-haiku-4-5');
    expect(body.rows[0].groupKey).toBe('model:claude-haiku-4-5');
    expect(body.rows[0].userId).toBeUndefined();
    expect(find).not.toHaveBeenCalled();
  });

  it('respects from/to and userId query filters', async () => {
    const { Transaction, aggregate } = createTransactionMock({});
    const handlers = createAdminUsageHandlers({ Transaction: Transaction as never });
    const userId = new Types.ObjectId().toString();
    const { req, res } = createReqRes({
      query: { from: '2026-01-01', to: '2026-02-01', userId },
    });

    await handlers.listUsage(req, res);

    const firstPipeline = aggregate.mock.calls[0][0];
    const matchStage = firstPipeline[0].$match;
    expect(matchStage.user.toString()).toBe(userId);
    expect(matchStage.createdAt.$gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(matchStage.createdAt.$lte.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('falls back to default groupBy=user on invalid value', async () => {
    const { Transaction } = createTransactionMock({});
    const handlers = createAdminUsageHandlers({ Transaction: Transaction as never });
    const { req, res, json } = createReqRes({ query: { groupBy: 'evil' } });
    await handlers.listUsage(req, res);
    const body = json.mock.calls[0][0];
    expect(body.groupBy).toBe('user');
  });

  it('returns 500 on aggregation failure', async () => {
    const aggregate = jest.fn().mockRejectedValue(new Error('boom'));
    const Transaction = {
      aggregate,
      db: { models: { User: { find: jest.fn() } } },
    } as unknown as Model<unknown>;
    const handlers = createAdminUsageHandlers({ Transaction: Transaction as never });
    const { req, res, status, json } = createReqRes();
    await handlers.listUsage(req, res);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Failed to load usage' });
  });
});
