const express = require('express');
const { createAdminAuditHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsage = requireCapability(SystemCapabilities.READ_USAGE);

const handlers = createAdminAuditHandlers({
  listAdminAudit: (opts) => db.listAdminAudit(opts),
});

router.use(requireJwtAuth, requireAdminAccess);
router.get('/', requireReadUsage, handlers.list);

module.exports = router;
