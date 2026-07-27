import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// GET 获取项目全部目标（返回WBS树）
router.get('/', requireAuth, (req, res) => {
  const { project } = req.query;
  if (!project) return res.status(400).json({ error: '缺少 project 参数' });
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM objectives WHERE project_name = ? ORDER BY created_at ASC'
  ).all(project);
  const items = rows.map(r => ({
    id: r.id,
    projectName: r.project_name,
    parentId: r.parent_id,
    title: r.title,
    description: r.description,
    level: r.level,
    weight: r.weight,
    progress: r.progress,
    status: r.status,
    linkedWorkItemIds: JSON.parse(r.linked_work_item_ids || '[]'),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  // 构建树形结构
  const buildTree = (parentId) => {
    return items
      .filter(o => o.parentId === parentId)
      .map(o => ({ ...o, children: buildTree(o.id) }));
  };
  const tree = buildTree(null);

  // 统计
  const total = items.length;
  const completed = items.filter(o => o.status === 'completed').length;
  const inProgress = items.filter(o => o.status === 'in-progress').length;
  const avgProgress = total > 0
    ? items.reduce((s, o) => s + o.progress, 0) / total
    : 0;

  res.json({
    tree,
    items,
    stats: { total, completed, inProgress,
      notStarted: total - completed - inProgress,
      overallProgress: Math.round(avgProgress * 100) / 100 },
  });
});

// POST 创建目标节点
router.post('/', requireRole('admin', 'project_manager'), (req, res) => {
  const {
    projectName, parentId, title, description, level, weight,
    linkedWorkItemIds,
  } = req.body;
  if (!projectName || !title || !level) {
    return res.status(400).json({ error: 'projectName, title, level 必填' });
  }
  const db = getDb();
  const id = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(
    `INSERT INTO objectives (id, project_name, parent_id, title, description, level, weight, linked_work_item_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectName, parentId || null, title, description || '', level, weight || 0,
    JSON.stringify(linkedWorkItemIds || []));

  // 如果parentId存在且为null，不尝试更新父节点
  const row = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);

  logAudit(projectName, req.user?.username || 'unknown', 'create', 'objective', id,
    { title, level, parentId });

  res.status(201).json({
    id: row.id, projectName: row.project_name, parentId: row.parent_id,
    title: row.title, description: row.description, level: row.level,
    weight: row.weight, progress: row.progress, status: row.status,
    linkedWorkItemIds: JSON.parse(row.linked_work_item_ids || '[]'),
    createdAt: row.created_at, updatedAt: row.updated_at,
  });
});

// PUT 更新目标节点
router.put('/:id', requireRole('admin', 'project_manager'), (req, res) => {
  const { id } = req.params;
  const { title, description, weight, status, linkedWorkItemIds } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '目标不存在' });

  const updates = [];
  const params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (weight !== undefined) { updates.push('weight = ?'); params.push(weight); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (linkedWorkItemIds !== undefined) {
    updates.push('linked_work_item_ids = ?');
    params.push(JSON.stringify(linkedWorkItemIds));
  }
  updates.push("updated_at = datetime('now')");
  params.push(id);

  if (updates.length === 1) return res.status(400).json({ error: '没有要更新的字段' });

  db.prepare(`UPDATE objectives SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  logAudit(existing.project_name, req.user?.username || 'unknown', 'update', 'objective', id,
    { changed: Object.keys(req.body) });

  res.json({ success: true });
});

// PUT 更新目标进度
router.put('/:id/progress', requireAuth, (req, res) => {
  const { id } = req.params;
  const { progress } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '目标不存在' });

  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  const newStatus = p >= 1 ? 'completed' : p > 0 ? 'in-progress' : 'not-started';
  db.prepare(
    "UPDATE objectives SET progress = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(p, newStatus, id);

  res.json({ success: true, progress: p, status: newStatus });
});

// POST 关联工作项
router.post('/:id/link', requireRole('admin', 'project_manager'), (req, res) => {
  const { id } = req.params;
  const { workItemId } = req.body;
  if (!workItemId) return res.status(400).json({ error: 'workItemId 必填' });
  const db = getDb();

  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '目标不存在' });

  const ids = JSON.parse(existing.linked_work_item_ids || '[]');
  if (!ids.includes(workItemId)) {
    ids.push(workItemId);
    db.prepare(
      "UPDATE objectives SET linked_work_item_ids = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(ids), id);
  }
  res.json({ success: true, linkedWorkItemIds: ids });
});

// DELETE 取消关联工作项
router.delete('/:id/link/:workItemId', requireRole('admin', 'project_manager'), (req, res) => {
  const { id, workItemId } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '目标不存在' });

  const ids = JSON.parse(existing.linked_work_item_ids || '[]').filter(wid => wid !== workItemId);
  db.prepare(
    "UPDATE objectives SET linked_work_item_ids = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(ids), id);
  res.json({ success: true, linkedWorkItemIds: ids });
});

// DELETE 删除目标节点（级联删除子节点）
router.delete('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '目标不存在' });

  // 递归删除所有子节点
  const deleteChildren = (parentId) => {
    const children = db.prepare('SELECT id FROM objectives WHERE parent_id = ?').all(parentId);
    for (const child of children) {
      deleteChildren(child.id);
      db.prepare('DELETE FROM objectives WHERE id = ?').run(child.id);
    }
  };
  deleteChildren(id);
  db.prepare('DELETE FROM objectives WHERE id = ?').run(id);

  logAudit(existing.project_name, req.user?.username || 'unknown', 'delete', 'objective', id,
    { title: existing.title });

  res.json({ success: true });
});

// ===== 价值度量链 =====

// GET 项目价值看板统计
router.get('/value-stats', requireAuth, (req, res) => {
  const { project } = req.query;
  if (!project) return res.status(400).json({ error: '缺少 project 参数' });
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS value_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
      metric_name TEXT NOT NULL,
      metric_unit TEXT DEFAULT '',
      target_value REAL DEFAULT 0,
      current_value REAL DEFAULT 0,
      weight REAL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const metrics = db.prepare(
    `SELECT vm.*, o.title as obj_title, o.status as obj_status FROM value_metrics vm
     JOIN objectives o ON vm.objective_id = o.id
     WHERE o.project_name = ? ORDER BY vm.updated_at DESC`
  ).all(project);

  // 聚合统计
  let totalTarget = 0, totalCurrent = 0;
  const byObjective = {};
  for (const m of metrics) {
    totalTarget += (m.target_value || 0) * (m.weight || 1);
    totalCurrent += (m.current_value || 0) * (m.weight || 1);
    if (!byObjective[m.objective_id]) {
      byObjective[m.objective_id] = { title: m.obj_title, status: m.obj_status, metrics: [], achievedRate: 0 };
    }
    byObjective[m.objective_id].metrics.push({
      id: m.id, name: m.metric_name, unit: m.metric_unit,
      target: m.target_value, current: m.current_value, weight: m.weight,
    });
  }

  for (const key of Object.keys(byObjective)) {
    const obj = byObjective[key];
    const totalT = obj.metrics.reduce((s, x) => s + x.target * x.weight, 0);
    const totalC = obj.metrics.reduce((s, x) => s + x.current * x.weight, 0);
    obj.achievedRate = totalT > 0 ? Math.round(totalC / totalT * 100) : 0;
  }

  res.json({
    projectName: project,
    totalMetrics: metrics.length,
    overallRate: totalTarget > 0 ? Math.round(totalCurrent / totalTarget * 100) : 0,
    objectives: Object.values(byObjective),
    raw: metrics.map(m => ({
      id: m.id, objectiveId: m.objective_id, objTitle: m.obj_title,
      metricName: m.metric_name, metricUnit: m.metric_unit,
      targetValue: m.target_value, currentValue: m.current_value, weight: m.weight,
    })),
  });
});

// POST 保存/更新价值指标
router.post('/value-metric', requireAuth, (req, res) => {
  const { objectiveId, metricName, metricUnit, targetValue, currentValue, weight } = req.body;
  if (!objectiveId || !metricName) return res.status(400).json({ error: '缺少必要参数' });
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS value_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
      metric_name TEXT NOT NULL,
      metric_unit TEXT DEFAULT '',
      target_value REAL DEFAULT 0,
      current_value REAL DEFAULT 0,
      weight REAL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const existing = db.prepare(
    'SELECT id FROM value_metrics WHERE objective_id = ? AND metric_name = ?'
  ).get(objectiveId, metricName);

  if (existing) {
    db.prepare(
      `UPDATE value_metrics SET metric_unit = ?, target_value = ?, current_value = ?, weight = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(metricUnit || '', targetValue || 0, currentValue || 0, weight ?? 1, existing.id);
  } else {
    db.prepare(
      `INSERT INTO value_metrics (objective_id, metric_name, metric_unit, target_value, current_value, weight)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(objectiveId, metricName, metricUnit || '', targetValue || 0, currentValue || 0, weight ?? 1);
  }

  res.json({ success: true });
});

// PUT 更新指标当前值（Agent自动调用）
router.put('/value-metric/:id', requireAuth, (req, res) => {
  const { currentValue } = req.body;
  if (currentValue === undefined) return res.status(400).json({ error: '缺少 currentValue' });
  const db = getDb();
  db.prepare(
    `UPDATE value_metrics SET current_value = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(currentValue, req.params.id);
  res.json({ success: true });
});

export default router;
