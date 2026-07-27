import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stakeholders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      org TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// GET /api/stakeholders?project=X — 获取项目干系人列表
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  ensureTable(db);
  const { project } = req.query;
  if (!project) return res.json([]);
  const rows = db.prepare(
    'SELECT * FROM stakeholders WHERE project_name = ? ORDER BY name'
  ).all(project);
  res.json(rows.map(r => ({
    id: r.id, name: r.name, role: r.role, org: r.org, contact: r.contact,
  })));
});

// POST /api/stakeholders — 批量保存（桌面端同步）
router.post('/', requireAuth, (req, res) => {
  const db = getDb();
  ensureTable(db);
  const { project, items } = req.body;
  if (!project || !Array.isArray(items)) return res.status(400).json({ error: '缺少参数' });

  // 先删后插
  db.prepare('DELETE FROM stakeholders WHERE project_name = ?').run(project);
  const stmt = db.prepare(
    'INSERT INTO stakeholders (project_name, name, role, org, contact) VALUES (?, ?, ?, ?, ?)'
  );
  for (const item of items) {
    stmt.run(project, item.name || '', item.role || '', item.org || '', item.contact || '');
  }
  res.json({ success: true, count: items.length });
});

export default router;
