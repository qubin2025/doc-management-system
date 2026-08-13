import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// 获取所有项目（所有登录用户可读）— v5.2: 包含 details JSON
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, name, created_at, updated_at, details FROM projects ORDER BY created_at DESC').all();
  res.json(projects.map(p => ({
    ...p,
    details: (() => { try { return JSON.parse(p.details || '{}'); } catch { return {}; } })(),
  })));
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

// v5.2: 更新项目（重命名 + 更新详情）— PUT /api/projects/:projectName
router.put('/:projectName', requireRole('admin', 'project_manager'), (req, res) => {
  const oldName = req.params.projectName;
  const { newName, details } = req.body;
  const db = getDb();
  try {
    const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(oldName);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const hasRename = newName && newName.trim() && newName.trim() !== oldName;
    const hasDetails = details !== undefined;

    if (hasRename) {
      // 重命名需级联更新所有引用 project_name 的子表
      // 临时关闭外键约束检查（SQLite 不支持 ON UPDATE CASCADE，需手动级联）
      db.pragma('foreign_keys = OFF');
      const tx = db.transaction(() => {
        const newNameTrimmed = newName.trim();
        // 先更新子表，再更新父表
        const childTables = [
          'objectives', 'baselines', 'knowledge_artifacts', 'stakeholders',
          'guide_progress', 'guide_forms', 'project_config', 'audit_log', 'project_experiences',
        ];
        for (const t of childTables) {
          db.prepare(`UPDATE ${t} SET project_name = ? WHERE project_name = ?`).run(newNameTrimmed, oldName);
        }
        // 更新父表
        db.prepare('UPDATE projects SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newNameTrimmed, project.id);
        // 更新详情（同一事务内）
        if (hasDetails) {
          db.prepare('UPDATE projects SET details = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(details), project.id);
        }
      });
      tx();
      db.pragma('foreign_keys = ON');
      console.log(`[projects] 重命名: ${oldName} → ${newName.trim()}` + (hasDetails ? ' + 更新详情' : ''));
    } else if (hasDetails) {
      // 仅更新详情（无重命名，无需关闭外键）
      db.prepare('UPDATE projects SET details = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(details), project.id);
      console.log(`[projects] 更新详情: ${oldName}`);
    } else {
      return res.status(400).json({ error: '无更新内容' });
    }
    res.json({ success: true });
  } catch (e) {
    db.pragma('foreign_keys = ON');
    if (e.message.includes('UNIQUE')) {
      res.status(409).json({ error: '项目名称已存在' });
    } else {
      console.error('[projects] 更新失败:', e.message);
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
