import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// 获取所有项目（所有登录用户可读）
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, name, created_at, updated_at FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// 创建项目（admin 和 project_manager）
router.post('/', requireRole('admin', 'project_manager'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '项目名称不能为空' });
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO projects (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(409).json({ error: '项目名称已存在' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// 删除项目（仅 admin）
router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  // 级联删除所有关联数据
  db.prepare('DELETE FROM documents WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM objectives WHERE project_name = (SELECT name FROM projects WHERE id = ?)').run(req.params.id);
  db.prepare('DELETE FROM baselines WHERE project_name = (SELECT name FROM projects WHERE id = ?)').run(req.params.id);
  db.prepare('DELETE FROM daily_reports WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM mobile_photos WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM mobile_issues WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM mobile_progress WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM project_experiences WHERE project_name = (SELECT name FROM projects WHERE id = ?)').run(req.params.id);
  db.prepare('DELETE FROM stakeholders WHERE project_name = (SELECT name FROM projects WHERE id = ?)').run(req.params.id);
  // 删除项目本身
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(500).json({ error: '删除失败，请重试' });
  }
  res.json({ success: true });
});

export default router;
