import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

/**
 * 统一数据管理路由 — 干系人/风险/资源数据持久化
 * 权限: viewer可查看, project_manager+可编辑, admin可删除
 */

// ===== 读取数据 =====
router.get('/:projectName/:dataType', requireAuth, (req, res) => {
  const { projectName, dataType } = req.params;

  // 验证数据类型
  if (!['stakeholder', 'risk', 'resource', 'raci'].includes(dataType)) {
    return res.status(400).json({ error: '不支持的数据类型' });
  }

  const db = getDb();

  // 确保数据表存在
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_content TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'unknown',
      UNIQUE(project_name, data_type),
      FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
    );
  `);

  const row = db.prepare(
    'SELECT data_content, updated_at, updated_by FROM project_data WHERE project_name = ? AND data_type = ?'
  ).get(projectName, dataType);

  res.json({
    data: row ? JSON.parse(row.data_content) : [],
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
  });
});

// ===== 保存数据 =====
router.post('/:projectName/:dataType', requireAuth, requireRole('admin', 'project_manager', 'construction_unit'), (req, res) => {
  const { projectName, dataType } = req.params;
  const { data } = req.body;

  if (!['stakeholder', 'risk', 'resource', 'raci'].includes(dataType)) {
    return res.status(400).json({ error: '不支持的数据类型' });
  }
  if (!data) return res.status(400).json({ error: '缺少data字段' });

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_content TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'unknown',
      UNIQUE(project_name, data_type),
      FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
    );
  `);

  db.prepare(
    `INSERT INTO project_data (project_name, data_type, data_content, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_name, data_type) DO UPDATE SET data_content = ?, updated_at = datetime('now'), updated_by = ?`
  ).run(projectName, dataType, JSON.stringify(data), req.user?.username || 'unknown',
    JSON.stringify(data), req.user?.username || 'unknown');

  logAudit(projectName, req.user?.username || 'unknown', 'update', 'configuration', `${dataType}-data`, { count: Array.isArray(data) ? data.length : 0 });

  res.json({ success: true });
});

export default router;
