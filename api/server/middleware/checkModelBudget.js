const { logger } = require('@librechat/data-schemas');
const { getModelBudgetsConfig } = require('@librechat/api');
const db = require('~/models');

/**
 * Pre-request middleware that enforces per-user, per-model bucket budgets.
 *
 * Behavior:
 *   • Skipped entirely when `appConfig.modelBudgets.enabled` is not true.
 *   • Resolves the model name from `req.body.model` or, for agents requests,
 *     from the agent document.
 *   • Looks up the matching bucket via `db.getBucketForModel`. If the model
 *     does not match any bucket and `rejectUnmatchedModel === true`, the
 *     request is rejected with HTTP 402 + `code: 'MODEL_NOT_BUDGETED'`.
 *   • Otherwise calls `db.hasBudget` (which lazy-resets the period). If the
 *     bucket is exhausted, returns HTTP 402 + `code: 'BUDGET_EXCEEDED'`.
 *
 * NOTE: this guard runs BEFORE the LLM call. The matching deduction happens
 * inside `spendTokens` once the provider returns actual token counts.
 */
async function checkModelBudget(req, res, next) {
  try {
    const appConfig = req.config;
    const config = getModelBudgetsConfig(appConfig);
    if (!config) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    const model = await resolveModel(req);
    if (!model) {
      return next();
    }

    const bucket = db.getBucketForModel(model, config.buckets);
    if (!bucket) {
      if (config.rejectUnmatchedModel) {
        return res.status(402).json({
          code: 'MODEL_NOT_BUDGETED',
          message: `El modelo "${model}" no tiene un presupuesto configurado.`,
          model,
        });
      }
      return next();
    }

    const status = await db.hasBudget(userId, bucket, config);
    if (!status.ok) {
      return res.status(402).json({
        code: status.reason || 'BUDGET_EXCEEDED',
        message: `Tu presupuesto para ${bucket.label || bucket.key} se agotó hasta el próximo período.`,
        bucket: status.bucket,
        allocatedCredits: status.allocatedCredits,
        spentCredits: status.spentCredits,
        remainingCredits: status.remainingCredits,
        periodEnd: status.periodEnd,
      });
    }

    return next();
  } catch (err) {
    logger.error('[checkModelBudget] error', err);
    // Fail open — don't block the request if our middleware itself errors.
    return next();
  }
}

/**
 * Resolves the requested model name. For agent requests, loads the agent doc
 * and reads its `model` field. For everything else, returns body.model.
 */
async function resolveModel(req) {
  const body = req.body ?? {};
  if (body.model) return body.model;

  const agentId = body.agent_id || body.agentId || body.endpointOption?.agent_id;
  if (agentId) {
    try {
      const agent = await db.getAgent({ id: agentId });
      if (agent?.model) return agent.model;
    } catch (err) {
      logger.warn('[checkModelBudget] failed to resolve agent', { agentId, err: err?.message });
    }
  }

  return undefined;
}

module.exports = checkModelBudget;
