import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// GET 获取项目所有基线
router.get('/', requireAuth, (req, res) => {
  const { project } = req.query;
  if (!project) return res.status(400).json({ error: '缺少 project 参数' });
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM baselines WHERE project_name = ? ORDER BY created_at DESC'
  ).all(project);
  res.json(rows.map(r => ({
    id: r.id, projectName: r.project_name, baselineType: r.baseline_type,
    version: r.version, snapshot: JSON.parse(r.snapshot), description: r.description,
    isActive: !!r.is_active, createdAt: r.created_at, createdBy: r.created_by,
  })));
});

// POST 创建基线快照
router.post('/', requireRole('admin', 'project_manager'), (req, res) => {
  const { projectName, baselineType, snapshot, description } = req.body;
  if (!projectName || !baselineType || !snapshot) {
    return res.status(400).json({ error: 'projectName, baselineType, snapshot 必填' });
  }
  const db = getDb();
  // 设为非活跃
  db.prepare("UPDATE baselines SET is_active = 0 WHERE project_name = ? AND baseline_type = ?")
    .run(projectName, baselineType);
  // 新基线
  const maxVer = db.prepare(
    'SELECT MAX(version) as v FROM baselines WHERE project_name = ? AND baseline_type = ?'
  ).get(projectName, baselineType)?.v || 0;
  const id = `bl-${Date.now()}`;
  db.prepare(
    'INSERT INTO baselines (id, project_name, baseline_type, version, snapshot, description, is_active, created_by) VALUES (?,?,?,?,?,?,1,?)'
  ).run(id, projectName, baselineType, maxVer + 1, JSON.stringify(snapshot), description || '', req.user?.username || 'unknown');
  logAudit(projectName, req.user?.username || 'unknown', 'create', 'baseline', id, { baselineType, version: maxVer + 1 });
  res.status(201).json({ success: true, id, version: maxVer + 1 });
});

// DELETE 删除基线
router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const bl = db.prepare('SELECT * FROM baselines WHERE id = ?').get(req.params.id);
  if (!bl) return res.status(404).json({ error: '基线不存在' });
  db.prepare('DELETE FROM baselines WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
