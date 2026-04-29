const { logger } = require('@librechat/data-schemas');
const { getModelBudgetsConfig } = require('@librechat/api');
const { findBalanceByUser } = require('~/models');
const db = require('~/models');

async function balanceController(req, res) {
  const balanceData = await findBalanceByUser(req.user.id);

  // Build the legacy balance shape (returns 404 only when both balance and
  // modelBudgets are missing — see end of function).
  let baseResult = null;
  if (balanceData) {
    const { _id: _, ...result } = balanceData;
    if (!result.autoRefillEnabled) {
      delete result.refillIntervalValue;
      delete result.refillIntervalUnit;
      delete result.lastRefill;
      delete result.refillAmount;
    }
    baseResult = result;
  }

  // Extend with per-bucket Molinos budgets when configured.
  let modelBudgets = null;
  try {
    const cfg = getModelBudgetsConfig(req.config);
    logger.warn(
      `[balanceController] cfg=${!!cfg} typeofGetUserBudgets=${typeof db.getUserBudgets}`,
    );
    if (cfg) {
      modelBudgets = await db.getUserBudgets(req.user.id, cfg);
      logger.warn(`[balanceController] returning ${modelBudgets?.length} budgets`);
    }
  } catch (err) {
    logger.error('[balanceController] failed to load modelBudgets', err);
  }

  if (!baseResult && !modelBudgets?.length) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  return res.status(200).json({
    ...(baseResult ?? {}),
    modelBudgets: modelBudgets ?? [],
  });
}

module.exports = balanceController;
