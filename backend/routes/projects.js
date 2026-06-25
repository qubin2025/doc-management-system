import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// 确保 details 列存在（向后兼容）
function ensureDetailsColumn() {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info(projects)").all();
  if (!cols.some(c => c.name === 'details')) {
    db.exec("ALTER TABLE projects ADD COLUMN details TEXT DEFAULT '{}'");
  }
}
ensureDetailsColumn();

// 获取所有项目（含详情）
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  const projects = rows.map(r => ({
    id: r.id, name: r.name,
    created_at: r.created_at, updated_at: r.updated_at,
    details: JSON.parse(r.details || '{}'),
  }));
  res.json(projects);
});

// 创建项目
router.post('/', requireRole('admin', 'project_manager'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '项目名称不能为空' });
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO projects (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), details: {} });
  } catch (e) {
    res.status(e.message.includes('UNIQUE') ? 409 : 500).json({ error: e.message.includes('UNIQUE') ? '项目名称已存在' : e.message });
  }
});

// 更新项目详情（持久化编辑内容）
router.put('/:id', requireAuth, (req, res) => {
  const { name, details } = req.body;
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  db.prepare('UPDATE projects SET name = COALESCE(?, name), details = COALESCE(?, details), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(name || null, details ? JSON.stringify(details) : null, Number(req.params.id));
  res.json({ ok: true });
});

// 删除项目
router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: '项目不存在' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
