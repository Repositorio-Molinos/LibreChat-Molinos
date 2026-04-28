import modelBudgetSchema from '~/schema/modelBudget';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type * as t from '~/types';

export function createModelBudgetModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(modelBudgetSchema);
  return (
    mongoose.models.ModelBudget ||
    mongoose.model<t.IModelBudget>('ModelBudget', modelBudgetSchema)
  );
}
