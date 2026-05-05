import adminAuditLogSchema, { IAdminAuditLog } from '~/schema/adminAuditLog';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';

export function createAdminAuditLogModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(adminAuditLogSchema);
  return (
    mongoose.models.AdminAuditLog ||
    mongoose.model<IAdminAuditLog>('AdminAuditLog', adminAuditLogSchema)
  );
}
