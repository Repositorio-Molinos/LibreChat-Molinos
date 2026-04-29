import logger from '~/config/winston';
import type { Types } from 'mongoose';
import type {
  IModelBudget,
  ModelBudgetBucketConfig,
  ModelBudgetsRuntimeConfig,
} from '~/types';

/** 1 USD = 1_000_000 micro-USD credits — same convention as `tx.ts`. */
const CREDITS_PER_USD = 1_000_000;

export interface BudgetSnapshot {
  bucket: string;
  allocatedCredits: number;
  spentCredits: number;
  remainingCredits: number;
  periodStart: Date;
  periodEnd: Date;
  periodMs: number;
}

export interface DeductionResult {
  ok: boolean;
  reason?: 'BUDGET_EXCEEDED';
  bucket: string;
  allocatedCredits: number;
  spentCredits: number;
  remainingCredits: number;
  periodEnd: Date;
}

export function createModelBudgetMethods(mongoose: typeof import('mongoose')) {
  /**
   * Resolve the configured bucket for a given model name.
   * Uses substring matching against each bucket's `match` array; the first match wins.
   * Returns `null` when no bucket matches.
   */
  function getBucketForModel(
    model: string | undefined,
    buckets: ModelBudgetBucketConfig[] | undefined,
  ): ModelBudgetBucketConfig | null {
    if (!model || !buckets?.length) {
      return null;
    }
    const lower = model.toLowerCase();
    for (const bucket of buckets) {
      for (const pattern of bucket.match ?? []) {
        if (!pattern) continue;
        if (lower.includes(pattern.toLowerCase())) {
          return bucket;
        }
      }
    }
    return null;
  }

  /**
   * Get-or-create a per-user budget document for the given bucket.
   * Performs a lazy period reset when the prior period has elapsed.
   *
   * The new period inherits `periodMs` and `allocatedCredits` from the runtime
   * config so changes to the yaml take effect on the next period boundary.
   */
  async function getOrCreateBudget(
    userId: Types.ObjectId | string,
    bucket: ModelBudgetBucketConfig,
    config: ModelBudgetsRuntimeConfig,
  ): Promise<IModelBudget> {
    const ModelBudget = mongoose.models.ModelBudget;
    const allocatedCredits = Math.round((bucket.defaultUsd ?? 0) * CREDITS_PER_USD);
    const periodMs = config.periodMs;
    const now = new Date();

    let doc = (await ModelBudget.findOne({ user: userId, bucket: bucket.key })) as
      | IModelBudget
      | null;

    if (!doc) {
      doc = (await ModelBudget.create({
        user: userId,
        bucket: bucket.key,
        allocatedCredits,
        spentCredits: 0,
        periodStart: now,
        periodMs,
      })) as IModelBudget;
      return doc;
    }

    const periodEnd = new Date(doc.periodStart.getTime() + doc.periodMs);
    if (now >= periodEnd) {
      doc.spentCredits = 0;
      doc.periodStart = now;
      doc.periodMs = periodMs;
      doc.allocatedCredits = allocatedCredits;
      await doc.save();
    }

    return doc;
  }

  /**
   * Read-only snapshot for the user/bucket pair (no period reset side-effect).
   * Used by status endpoints.
   */
  function snapshot(doc: IModelBudget): BudgetSnapshot {
    const periodEnd = new Date(doc.periodStart.getTime() + doc.periodMs);
    return {
      bucket: doc.bucket,
      allocatedCredits: doc.allocatedCredits,
      spentCredits: doc.spentCredits,
      remainingCredits: Math.max(doc.allocatedCredits - doc.spentCredits, 0),
      periodStart: doc.periodStart,
      periodEnd,
      periodMs: doc.periodMs,
    };
  }

  /**
   * Pre-check: returns whether the user still has budget left for the bucket.
   * Lazy-resets the period when expired.
   */
  async function hasBudget(
    userId: Types.ObjectId | string,
    bucket: ModelBudgetBucketConfig,
    config: ModelBudgetsRuntimeConfig,
  ): Promise<DeductionResult> {
    const doc = await getOrCreateBudget(userId, bucket, config);
    const periodEnd = new Date(doc.periodStart.getTime() + doc.periodMs);
    const remaining = Math.max(doc.allocatedCredits - doc.spentCredits, 0);
    if (doc.spentCredits >= doc.allocatedCredits) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        bucket: doc.bucket,
        allocatedCredits: doc.allocatedCredits,
        spentCredits: doc.spentCredits,
        remainingCredits: 0,
        periodEnd,
      };
    }
    return {
      ok: true,
      bucket: doc.bucket,
      allocatedCredits: doc.allocatedCredits,
      spentCredits: doc.spentCredits,
      remainingCredits: remaining,
      periodEnd,
    };
  }

  /**
   * Atomically increment the spent counter for the user/bucket.
   * Lazy-resets the period when expired before applying the increment.
   *
   * Returns the post-update snapshot. Does NOT reject when over-budget; the
   * pre-check middleware is responsible for refusing requests, while this
   * function records the actual cost reported by the provider.
   */
  async function recordUsage(
    userId: Types.ObjectId | string,
    bucket: ModelBudgetBucketConfig,
    config: ModelBudgetsRuntimeConfig,
    credits: number,
  ): Promise<DeductionResult> {
    if (!Number.isFinite(credits) || credits <= 0) {
      const doc = await getOrCreateBudget(userId, bucket, config);
      return {
        ok: true,
        bucket: doc.bucket,
        allocatedCredits: doc.allocatedCredits,
        spentCredits: doc.spentCredits,
        remainingCredits: Math.max(doc.allocatedCredits - doc.spentCredits, 0),
        periodEnd: new Date(doc.periodStart.getTime() + doc.periodMs),
      };
    }

    const doc = await getOrCreateBudget(userId, bucket, config);
    const ModelBudget = mongoose.models.ModelBudget;
    const updated = (await ModelBudget.findOneAndUpdate(
      { _id: doc._id },
      { $inc: { spentCredits: Math.round(credits) } },
      { new: true },
    )) as IModelBudget;

    return {
      ok: updated.spentCredits < updated.allocatedCredits,
      reason: updated.spentCredits >= updated.allocatedCredits ? 'BUDGET_EXCEEDED' : undefined,
      bucket: updated.bucket,
      allocatedCredits: updated.allocatedCredits,
      spentCredits: updated.spentCredits,
      remainingCredits: Math.max(updated.allocatedCredits - updated.spentCredits, 0),
      periodEnd: new Date(updated.periodStart.getTime() + updated.periodMs),
    };
  }

  /**
   * List all budgets for a user. Lazy-resets each one before returning the
   * snapshots so the response is consistent with the live state.
   */
  async function getUserBudgets(
    userId: Types.ObjectId | string,
    config: ModelBudgetsRuntimeConfig,
  ): Promise<BudgetSnapshot[]> {
    const ModelBudget = mongoose.models.ModelBudget;
    const out: BudgetSnapshot[] = [];

    for (const bucket of config.buckets ?? []) {
      try {
        const doc = await getOrCreateBudget(userId, bucket, config);
        out.push({
          ...snapshot(doc),
          // overlay label + match patterns from config so the consumer can
          // filter by active model without a second lookup
          ...(bucket.label ? { label: bucket.label } : {}),
          match: bucket.match ?? [],
        } as BudgetSnapshot & { label?: string; match: string[] });
      } catch (err) {
        logger.error(`[modelBudget.getUserBudgets] bucket=${bucket.key}`, err);
      }
    }

    // Include any docs for buckets the config no longer defines (orphaned, but worth surfacing)
    const definedKeys = new Set((config.buckets ?? []).map((b) => b.key));
    const orphaned = (await ModelBudget.find({ user: userId })) as IModelBudget[];
    for (const doc of orphaned) {
      if (!definedKeys.has(doc.bucket)) {
        out.push(snapshot(doc));
      }
    }

    return out;
  }

  return {
    getBucketForModel,
    getOrCreateBudget,
    hasBudget,
    recordUsage,
    getUserBudgets,
    snapshot,
  };
}

export type ModelBudgetMethods = ReturnType<typeof createModelBudgetMethods>;
