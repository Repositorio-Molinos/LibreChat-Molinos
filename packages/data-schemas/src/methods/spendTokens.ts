import logger from '~/config/winston';
import type { TxData, TransactionResult } from './transaction';
import type {
  ModelBudgetBucketConfig,
  ModelBudgetsRuntimeConfig,
} from '~/types';

/** Base transaction context passed by callers — does not include fields added internally */
export interface SpendTxData {
  user: string | import('mongoose').Types.ObjectId;
  conversationId?: string;
  model?: string;
  context?: string;
  endpointTokenConfig?: Record<string, Record<string, number>> | null;
  balance?: { enabled?: boolean };
  transactions?: { enabled?: boolean };
  valueKey?: string;
  /** Per-request snapshot of the modelBudgets yaml config. Caller passes it
   *  through so spendTokens can record the cost in the right bucket without
   *  reaching into the request context. */
  modelBudgets?: ModelBudgetsRuntimeConfig | null;
}

export interface SpendTokensDeps {
  createTransaction: (txData: TxData) => Promise<TransactionResult | undefined>;
  createStructuredTransaction: (txData: TxData) => Promise<TransactionResult | undefined>;
  /** Optional hook — when provided, spendTokens records the per-bucket cost
   *  alongside the global Balance update. */
  recordModelBudgetUsage?: (
    userId: string | import('mongoose').Types.ObjectId,
    bucket: ModelBudgetBucketConfig,
    config: ModelBudgetsRuntimeConfig,
    credits: number,
  ) => Promise<unknown>;
  getBucketForModel?: (
    model: string | undefined,
    buckets: ModelBudgetBucketConfig[] | undefined,
  ) => ModelBudgetBucketConfig | null;
}

export function createSpendTokensMethods(
  _mongoose: typeof import('mongoose'),
  transactionMethods: SpendTokensDeps,
) {
  function maybeRecordModelBudget(
    txData: SpendTxData,
    results: Array<TransactionResult | undefined>,
  ): Promise<unknown> | void {
    const cfg = txData.modelBudgets;
    if (!cfg?.enabled) return;
    if (!transactionMethods.recordModelBudgetUsage || !transactionMethods.getBucketForModel) return;
    const bucket = transactionMethods.getBucketForModel(txData.model, cfg.buckets);
    if (!bucket) return;
    let credits = 0;
    for (const r of results) {
      if (!r) continue;
      const v = (r.prompt ?? r.completion ?? 0) as number;
      credits += Math.abs(v);
    }
    if (credits <= 0) return;
    return transactionMethods
      .recordModelBudgetUsage(txData.user, bucket, cfg, credits)
      .catch((err) => logger.error('[spendTokens] modelBudget recordUsage failed', err));
  }

  /**
   * Creates up to two transactions to record the spending of tokens.
   */
  async function spendTokens(
    txData: SpendTxData,
    tokenUsage: { promptTokens?: number; completionTokens?: number },
  ) {
    const { promptTokens, completionTokens } = tokenUsage;
    logger.debug(
      `[spendTokens] conversationId: ${txData.conversationId}${
        txData?.context ? ` | Context: ${txData?.context}` : ''
      } | Token usage: `,
      { promptTokens, completionTokens },
    );
    let prompt: TransactionResult | undefined, completion: TransactionResult | undefined;
    const normalizedPromptTokens = Math.max(promptTokens ?? 0, 0);
    try {
      if (promptTokens !== undefined) {
        prompt = await transactionMethods.createTransaction({
          ...txData,
          tokenType: 'prompt',
          rawAmount: promptTokens === 0 ? 0 : -normalizedPromptTokens,
          inputTokenCount: normalizedPromptTokens,
        });
      }

      if (completionTokens !== undefined) {
        completion = await transactionMethods.createTransaction({
          ...txData,
          tokenType: 'completion',
          rawAmount: completionTokens === 0 ? 0 : -Math.max(completionTokens, 0),
          inputTokenCount: normalizedPromptTokens,
        });
      }

      if (prompt || completion) {
        logger.debug('[spendTokens] Transaction data record against balance:', {
          user: txData.user,
          prompt: prompt?.prompt,
          promptRate: prompt?.rate,
          completion: completion?.completion,
          completionRate: completion?.rate,
          balance: completion?.balance ?? prompt?.balance,
        });
      } else {
        logger.debug('[spendTokens] No transactions incurred against balance');
      }
      await maybeRecordModelBudget(txData, [prompt, completion]);
    } catch (err) {
      logger.error('[spendTokens]', err);
    }
  }

  /**
   * Creates transactions to record the spending of structured tokens.
   */
  async function spendStructuredTokens(
    txData: SpendTxData,
    tokenUsage: {
      promptTokens?: { input?: number; write?: number; read?: number };
      completionTokens?: number;
    },
  ) {
    const { promptTokens, completionTokens } = tokenUsage;
    logger.debug(
      `[spendStructuredTokens] conversationId: ${txData.conversationId}${
        txData?.context ? ` | Context: ${txData?.context}` : ''
      } | Token usage: `,
      { promptTokens, completionTokens },
    );
    let prompt: TransactionResult | undefined, completion: TransactionResult | undefined;
    try {
      if (promptTokens) {
        const input = Math.max(promptTokens.input ?? 0, 0);
        const write = Math.max(promptTokens.write ?? 0, 0);
        const read = Math.max(promptTokens.read ?? 0, 0);
        const totalInputTokens = input + write + read;
        prompt = await transactionMethods.createStructuredTransaction({
          ...txData,
          tokenType: 'prompt',
          inputTokens: -input,
          writeTokens: -write,
          readTokens: -read,
          inputTokenCount: totalInputTokens,
        });
      }

      if (completionTokens) {
        const totalInputTokens = promptTokens
          ? Math.max(promptTokens.input ?? 0, 0) +
            Math.max(promptTokens.write ?? 0, 0) +
            Math.max(promptTokens.read ?? 0, 0)
          : undefined;
        completion = await transactionMethods.createTransaction({
          ...txData,
          tokenType: 'completion',
          rawAmount: -Math.max(completionTokens, 0),
          inputTokenCount: totalInputTokens,
        });
      }

      if (prompt || completion) {
        logger.debug('[spendStructuredTokens] Transaction data record against balance:', {
          user: txData.user,
          prompt: prompt?.prompt,
          promptRate: prompt?.rate,
          completion: completion?.completion,
          completionRate: completion?.rate,
          balance: completion?.balance ?? prompt?.balance,
        });
      } else {
        logger.debug('[spendStructuredTokens] No transactions incurred against balance');
      }
      await maybeRecordModelBudget(txData, [prompt, completion]);
    } catch (err) {
      logger.error('[spendStructuredTokens]', err);
    }

    return { prompt, completion };
  }

  return { spendTokens, spendStructuredTokens };
}

export type SpendTokensMethods = ReturnType<typeof createSpendTokensMethods>;
