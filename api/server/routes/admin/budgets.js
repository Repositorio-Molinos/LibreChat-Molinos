const express = require('express');
const { createAdminBudgetsHandlers, getModelBudgetsConfig } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireManageUsers = requireCapability(SystemCapabilities.MANAGE_USERS);
const requireReadUsage = requireCapability(SystemCapabilities.READ_USAGE);

const handlers = createAdminBudgetsHandlers({
  getConfig: (req) => getModelBudgetsConfig(req.config),
  getUserBudgets: (userId, config) => db.getUserBudgets(userId, config),
  setUserBudget: (userId, bucketKey, updates, config) =>
    db.setUserBudget(userId, bucketKey, updates, config),
});

router.use(requireJwtAuth, requireAdminAccess, configMiddleware);

router.get('/:userId', requireReadUsage, handlers.getBudgets);
router.patch('/:userId/:bucket', requireManageUsers, handlers.setBudget);

module.exports = router;
