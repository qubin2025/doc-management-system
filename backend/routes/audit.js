import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAuditLog } from '../utils/audit.js';

const router = Router();

// GET 查询审计日志
router.get('/', requireRole('admin'), (req, res) => {
  const { project, user, action, limit, offset } = req.query;
  const logs = queryAuditLog({
    projectName: project,
    userId: user,
    action: action,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });
  res.json(logs);
});

export default router;
