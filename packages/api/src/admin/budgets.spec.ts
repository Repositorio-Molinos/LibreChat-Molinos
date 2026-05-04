import { Types } from 'mongoose';
import type { Response } from 'express';
import type { TModelBudgetsConfig } from 'librechat-data-provider';
import type { ServerRequest } from '~/types/http';
import { createAdminBudgetsHandlers } from './budgets';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const userId = new Types.ObjectId().toString();

const mockConfig: TModelBudgetsConfig = {
  enabled: true,
  periodMs: 2_592_000_000,
  rejectUnmatchedModel: true,
  buckets: [
    { key: 'anthropic-haiku', label: 'Claude Haiku', match: ['claude-haiku'], defaultUsd: 20 },
  ],
};

function createReqRes(overrides: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const req = {
    params: overrides.params ?? {},
    body: overrides.body ?? {},
    query: {},
    user: { _id: new Types.ObjectId(), role: 'admin' },
  } as unknown as ServerRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { req, res, status, json };
}

function createDeps(overrides: {
  config?: TModelBudgetsConfig | null;
  setUserBudget?: jest.Mock;
  getUserBudgets?: jest.Mock;
} = {}) {
  return {
    getConfig: jest.fn().mockReturnValue(overrides.config === undefined ? mockConfig : overrides.config),
    getUserBudgets: overrides.getUserBudgets ?? jest.fn().mockResolvedValue([]),
    setUserBudget: overrides.setUserBudget ?? jest.fn().mockResolvedValue({}),
  };
}

describe('createAdminBudgetsHandlers', () => {
  describe('getBudgets', () => {
    it('rejects invalid userId with 400', async () => {
      const handlers = createAdminBudgetsHandlers(createDeps());
      const { req, res, status, json } = createReqRes({ params: { userId: 'not-an-id' } });
      await handlers.getBudgets(req, res);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid userId' });
    });

    it('returns 404 when modelBudgets disabled', async () => {
      const handlers = createAdminBudgetsHandlers(createDeps({ config: null }));
      const { req, res, status } = createReqRes({ params: { userId } });
      await handlers.getBudgets(req, res);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('returns budgets for valid user', async () => {
      const budgets = [{ bucket: 'anthropic-haiku', remainingCredits: 5_000_000 }];
      const deps = createDeps({ getUserBudgets: jest.fn().mockResolvedValue(budgets) });
      const handlers = createAdminBudgetsHandlers(deps);
      const { req, res, json } = createReqRes({ params: { userId } });
      await handlers.getBudgets(req, res);
      expect(json).toHaveBeenCalledWith({ userId, budgets });
    });
  });

  describe('setBudget', () => {
    it('rejects invalid userId with 400', async () => {
      const handlers = createAdminBudgetsHandlers(createDeps());
      const { req, res, status } = createReqRes({
        params: { userId: 'bad', bucket: 'anthropic-haiku' },
        body: { allocatedUsd: 50 },
      });
      await handlers.setBudget(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('rejects when no update fields provided', async () => {
      const handlers = createAdminBudgetsHandlers(createDeps());
      const { req, res, status } = createReqRes({
        params: { userId, bucket: 'anthropic-haiku' },
        body: {},
      });
      await handlers.setBudget(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('rejects unknown bucket with 404', async () => {
      const handlers = createAdminBudgetsHandlers(createDeps());
      const { req, res, status } = createReqRes({
        params: { userId, bucket: 'does-not-exist' },
        body: { allocatedUsd: 10 },
      });
      await handlers.setBudget(req, res);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('converts allocatedUsd to micro-credits before persisting', async () => {
      const setUserBudget = jest.fn().mockResolvedValue({ bucket: 'anthropic-haiku' });
      const handlers = createAdminBudgetsHandlers(createDeps({ setUserBudget }));
      const { req, res, status } = createReqRes({
        params: { userId, bucket: 'anthropic-haiku' },
        body: { allocatedUsd: 50 },
      });
      await handlers.setBudget(req, res);
      expect(setUserBudget).toHaveBeenCalledWith(
        userId,
        'anthropic-haiku',
        { allocatedCredits: 50_000_000, spentCredits: undefined },
        mockConfig,
      );
      expect(status).toHaveBeenCalledWith(200);
    });

    it('passes allocatedCredits through unchanged when explicit', async () => {
      const setUserBudget = jest.fn().mockResolvedValue({});
      const handlers = createAdminBudgetsHandlers(createDeps({ setUserBudget }));
      const { req, res } = createReqRes({
        params: { userId, bucket: 'anthropic-haiku' },
        body: { allocatedCredits: 12_345_678, spentCredits: 0 },
      });
      await handlers.setBudget(req, res);
      expect(setUserBudget).toHaveBeenCalledWith(
        userId,
        'anthropic-haiku',
        { allocatedCredits: 12_345_678, spentCredits: 0 },
        mockConfig,
      );
    });

    it('rejects negative values', async () => {
      const setUserBudget = jest.fn();
      const handlers = createAdminBudgetsHandlers(createDeps({ setUserBudget }));
      const { req, res, status } = createReqRes({
        params: { userId, bucket: 'anthropic-haiku' },
        body: { allocatedUsd: -5 },
      });
      await handlers.setBudget(req, res);
      expect(status).toHaveBeenCalledWith(400);
      expect(setUserBudget).not.toHaveBeenCalled();
    });
  });
});
