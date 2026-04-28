import { Schema } from 'mongoose';
import type * as t from '~/types';

const modelBudgetSchema = new Schema<t.IModelBudget>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bucket: {
      type: String,
      required: true,
      index: true,
    },
    /** Total allocation for the current period, in micro-USD credits (1 USD = 1_000_000). */
    allocatedCredits: {
      type: Number,
      required: true,
      default: 0,
    },
    /** Accumulated spend in the current period, in micro-USD credits. */
    spentCredits: {
      type: Number,
      required: true,
      default: 0,
    },
    /** Start of the current period — used together with `periodMs` for lazy reset. */
    periodStart: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    /**
     * Period length snapshot (ms). Stored on the document so that runtime config
     * changes don't truncate or extend an in-flight period for an existing user.
     */
    periodMs: {
      type: Number,
      required: true,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true },
);

modelBudgetSchema.index({ user: 1, bucket: 1 }, { unique: true });

export default modelBudgetSchema;
