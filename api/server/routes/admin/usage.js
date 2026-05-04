const express = require('express');
const mongoose = require('mongoose');
const { createAdminUsageHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsage = requireCapability(SystemCapabilities.READ_USAGE);

const handlers = createAdminUsageHandlers({
  Transaction: mongoose.models.Transaction,
});

router.use(requireJwtAuth, requireAdminAccess);
router.get('/', requireReadUsage, handlers.listUsage);

module.exports = router;
