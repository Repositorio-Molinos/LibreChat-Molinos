import { Document, Types } from 'mongoose';

export interface IModelBudget extends Document {
  user: Types.ObjectId;
  bucket: string;
  allocatedCredits: number;
  spentCredits: number;
  periodStart: Date;
  periodMs: number;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ModelBudgetBucketConfig {
  key: string;
  label?: string;
  match: string[];
  defaultUsd: number;
}

export interface ModelBudgetsRuntimeConfig {
  enabled: boolean;
  periodMs: number;
  rejectUnmatchedModel: boolean;
  buckets: ModelBudgetBucketConfig[];
}
