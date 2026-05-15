import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// 获取所有项目
router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, name, created_at, updated_at FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// 创建项目
router.post('/', (req, res) => {
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

// 删除项目
router.delete('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
