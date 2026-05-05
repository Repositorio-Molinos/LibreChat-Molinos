import mongoose, { Schema, Document, Types } from 'mongoose';

export type AdminAuditAction =
  | 'budget.set_allocation'
  | 'budget.reset_spent'
  | 'budget.set_both';

export interface IAdminAuditLog extends Document {
  actor: {
    id: Types.ObjectId;
    email?: string;
    role?: string;
  };
  action: AdminAuditAction;
  target: {
    type: 'user';
    id: Types.ObjectId;
    email?: string;
  };
  resource: {
    type: 'modelBudget';
    key: string;
  };
  before?: {
    allocatedCredits?: number;
    spentCredits?: number;
  } | null;
  after?: {
    allocatedCredits?: number;
    spentCredits?: number;
  } | null;
  context?: {
    ip?: string;
    userAgent?: string;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const adminAuditLogSchema: Schema<IAdminAuditLog> = new Schema(
  {
    actor: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
      email: { type: String },
      role: { type: String },
    },
    action: {
      type: String,
      enum: ['budget.set_allocation', 'budget.reset_spent', 'budget.set_both'],
      required: true,
      index: true,
    },
    target: {
      type: {
        type: String,
        enum: ['user'],
        required: true,
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
      email: { type: String },
    },
    resource: {
      type: {
        type: String,
        enum: ['modelBudget'],
        required: true,
      },
      key: { type: String, required: true },
    },
    before: {
      allocatedCredits: { type: Number },
      spentCredits: { type: Number },
    },
    after: {
      allocatedCredits: { type: Number },
      spentCredits: { type: Number },
    },
    context: {
      ip: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: true },
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });
adminAuditLogSchema.index({ 'target.id': 1, createdAt: -1 });

export default adminAuditLogSchema;
