import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { enqueueKbSync, SYNC_SOURCE } from '../middleware/kbSyncTrigger.js';

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
      // v5.6 FIX: 重命名前先检查"其他项目"是否已经占用了 newName(id <> project.id)
      // 之前不做此检查,靠 SQLite UNIQUE 兜底报错 409,但无法区分是真正的冲突还是 FK 错误
      const newNameTrimmed = newName.trim();
      const existing = db.prepare('SELECT id FROM projects WHERE name = ? AND id <> ?').get(newNameTrimmed, project.id);
      if (existing) {
        return res.status(409).json({
          error: '项目名称已存在',
          conflict: { projectId: existing.id, name: newNameTrimmed }
        });
      }
      // 重命名需级联更新所有引用 project_name 的子表
      // 临时关闭外键约束检查（SQLite 不支持 ON UPDATE CASCADE，需手动级联）
      db.pragma('foreign_keys = OFF');
      const tx = db.transaction(() => {
        // v5.6: 补全所有 project_name 关联的子表重命名级联(共 13 张)
        const childTables = [
          'objectives', 'baselines', 'knowledge_artifacts', 'stakeholders',
          'guide_progress', 'guide_forms', 'project_config', 'audit_log', 'project_experiences',
          'ai_review_history', 'contracts', 'project_data',
        ];
        for (const t of childTables) {
          try { db.prepare(`UPDATE ${t} SET project_name = ? WHERE project_name = ?`).run(newNameTrimmed, oldName); } catch (_) {}
        }
        // 更新父表
        db.prepare("UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?").run(newNameTrimmed, project.id);
        // 更新详情（同一事务内）
        if (hasDetails) {
          db.prepare("UPDATE projects SET details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(details), project.id);
        }
      });
      tx();
      db.pragma('foreign_keys = ON');
      console.log(`[projects] 重命名: ${oldName} → ${newName.trim()}` + (hasDetails ? ' + 更新详情' : ''));
    } else if (hasDetails) {
      // 仅更新详情（无重命名，无需关闭外键）
      db.prepare("UPDATE projects SET details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(details), project.id);
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

// v5.6: 删除项目（仅 admin）— 完整级联所有项目关联数据 + 事务包裹 + 返回删除的项目名给前端清理本地缓存
router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const projectId = project.id;
  const projectName = project.name;
  let deletedCounts = {};

  try {
    const tx = db.transaction(() => {
      // ========== 路径 3 提前执行: value_metrics (通过 objectives → project_name) ==========
      // 必须在路径 2 删除 objectives 之前执行并计数,避免漏统计
      try {
        const objIds = db.prepare("SELECT id FROM objectives WHERE project_name = ?").all(projectName).map(r => r.id);
        if (objIds.length > 0) {
          const ph = objIds.map(() => '?').join(',');
          const r = db.prepare(`DELETE FROM value_metrics WHERE objective_id IN (${ph})`).run(...objIds);
          deletedCounts.value_metrics = r.changes;
        } else { deletedCounts.value_metrics = 0; }
      } catch (e) { deletedCounts.value_metrics = 'SKIP:' + e.message.split('\n')[0]; }

      // ========== 路径 1 + 1.5 组合: 先查 daily_ids → 再删 daily 子表 → 最后删 daily_reports ==========
      // v5.6: 顺序至关重要:必须先拿到 daily_ids,再删除 daily_x4 子表,最后才能删除 daily_reports (父表)
      const dailyIds = db.prepare('SELECT id FROM daily_reports WHERE project_id = ?').all(projectId).map(r => r.id);
      if (dailyIds.length > 0) {
        const placeholders = dailyIds.map(() => '?').join(',');
        const deleteDailyChild = (table) => {
          try {
            const r = db.prepare(`DELETE FROM ${table} WHERE daily_id IN (${placeholders})`).run(...dailyIds);
            deletedCounts[table] = r.changes;
          } catch (e) { deletedCounts[table] = 'SKIP:' + e.message.split('\n')[0]; }
        };
        ['daily_machinery', 'daily_progress', 'daily_risks', 'daily_workers'].forEach(deleteDailyChild);
      } else {
        // 写入 0,确保 deletedCounts keys 完整,便于前端/用户做一致性校验
        deletedCounts.daily_machinery = 0;
        deletedCounts.daily_progress = 0;
        deletedCounts.daily_risks = 0;
        deletedCounts.daily_workers = 0;
      }

      // ========== 路径 1 主删除: project_id 关联表 (6 张) ==========
      // 注意:daily_reports 必须在 daily_x4 删除后执行(因为子表依赖 daily_id 外键)
      const deleteById = (table) => {
        try {
          const r = db.prepare(`DELETE FROM ${table} WHERE project_id = ?`).run(projectId);
          deletedCounts[table] = r.changes;
        } catch (e) { deletedCounts[table] = 'SKIP:' + e.message.split('\n')[0]; }
      };
      ['documents', 'mobile_issues', 'mobile_photos', 'mobile_progress'].forEach(deleteById);
      // daily_reports 放在最后(在路径 1.5 删除完子表之后)
      deleteById('daily_reports');
      try { const r = db.prepare('DELETE FROM progress_reports WHERE project_id = ?').run(projectId); deletedCounts.progress_reports = r.changes; } catch (e) { deletedCounts.progress_reports = 'SKIP'; }

      // ========== 路径 2: project_name 关联表 (13 张) ==========
      const deleteByName = (table) => {
        try {
          const r = db.prepare(`DELETE FROM ${table} WHERE project_name = ?`).run(projectName);
          deletedCounts[table] = r.changes;
        } catch (e) { deletedCounts[table] = 'SKIP:' + e.message.split('\n')[0]; }
      };
      [
        // v3.0 P0 核心表 (objectives 放在路径 2 最后,因其删除会 FK CASCADE 到 value_metrics)
        'baselines', 'knowledge_artifacts', 'objectives',
        // v3.0+ 关联表
        'stakeholders', 'guide_progress', 'guide_forms', 'project_config',
        'project_experiences', 'ai_review_history', 'contracts', 'project_data',
        // v5.6 用户明确要求:即使审计合规也清理(用户要求「删除所有」避免混淆)
        'audit_log',
      ].forEach(deleteByName);

      // ========== 最后:删除项目本身 ==========
      const r = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      deletedCounts.projects = r.changes;
      if (r.changes === 0) throw new Error('删除项目主表失败,0 rows affected');
    });

    tx();

    console.log(`[projects] 删除成功 admin=${req.user?.username} id=${projectId} name="${projectName}"`,
      'cleanedCounts:', JSON.stringify(deletedCounts));

    // v5.7 迭代2: 项目删除联动 — 入队 delete action，前端 processor 清理向量库
    try {
      const r = enqueueKbSync(projectName, SYNC_SOURCE.DOCUMENT, '__PROJECT__', 'delete', 10);
      console.log(`[kbSync][project] 删除联动入队: projectName=${projectName}, recordId=__PROJECT__, action=delete, result=${JSON.stringify(r)}`);
    } catch (e) {
      console.error('[kbSync][project] 删除联动入队失败:', e.message);
    }

    // v5.6: 返回 deletedProjectName + deletedProjectId 给前端做本地化清理(localStorage/IndexedDB/向量库/知识图谱)
    res.json({
      success: true,
      deletedProjectId: projectId,
      deletedProjectName: projectName,
      deletedCounts,
    });
  } catch (e) {
    console.error('[projects] 删除失败:', e.message, 'rollback.');
    res.status(500).json({ error: '删除失败:' + e.message });
  }
});

// v5.7 迭代4: 项目成员管理 CRUD API
// 获取项目成员列表
router.get('/:projectId/members', requireAuth, (req, res) => {
  const db = getDb();
  const pid = Number(req.params.projectId);
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  // 只有项目成员才能查看成员列表
  const currentUser = req.user?.username;
  const isMember = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND username = ?'
  ).get(pid, currentUser);
  const userGlobalRole = req.user?.role;

  if (!isMember && userGlobalRole !== 'admin') {
    return res.status(403).json({ error: '无权查看该项目成员' });
  }

  const members = db.prepare(`
    SELECT pm.id, pm.username, pm.display_name, pm.role, pm.sensitivity, pm.joined_at
    FROM project_members pm WHERE pm.project_id = ? ORDER BY pm.role, pm.username
  `).all(pid);

  res.json({ projectId: pid, projectName: project.name, members });
});

// 添加项目成员（仅 admin 或项目 admin 角色可操作）
router.post('/:projectId/members', requireAuth, (req, res) => {
  const db = getDb();
  const pid = Number(req.params.projectId);
  const { username, role = 'member', sensitivity = 0 } = req.body;

  if (!username) return res.status(400).json({ error: '缺少 username' });
  if (!['admin', 'manager', 'member', 'viewer'].includes(role)) {
    return res.status(400).json({ error: '无效 role，应为 admin/manager/member/viewer' });
  }

  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  // 权限校验：全局 admin 或项目 admin 可添加成员
  const currentUser = req.user?.username;
  const userGlobalRole = req.user?.role;
  const projectAdmin = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND username = ? AND role = ?'
  ).get(pid, currentUser, 'admin');

  if (!projectAdmin && userGlobalRole !== 'admin') {
    return res.status(403).json({ error: '无权添加成员' });
  }

  // 检查目标用户是否存在
  const targetUser = db.prepare('SELECT username, display_name FROM users WHERE username = ?').get(username);
  if (!targetUser) return res.status(404).json({ error: `用户 ${username} 不存在` });

  try {
    const result = db.prepare(`
      INSERT INTO project_members (project_id, username, display_name, role, sensitivity)
      VALUES (?, ?, ?, ?, ?)
    `).run(pid, username, targetUser.display_name || username, role, sensitivity);

    res.status(201).json({ id: result.lastInsertRowid, projectId: pid, username, role, sensitivity });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(409).json({ error: '该用户已是项目成员' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// 更新成员角色/敏感等级
router.put('/:projectId/members/:memberId', requireAuth, (req, res) => {
  const db = getDb();
  const pid = Number(req.params.projectId);
  const memberId = Number(req.params.memberId);
  const { role, sensitivity } = req.body;

  const currentUser = req.user?.username;
  const userGlobalRole = req.user?.role;
  const projectAdmin = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND username = ? AND role = ?'
  ).get(pid, currentUser, 'admin');

  if (!projectAdmin && userGlobalRole !== 'admin') {
    return res.status(403).json({ error: '无权修改成员' });
  }

  const member = db.prepare(
    'SELECT * FROM project_members WHERE id = ? AND project_id = ?'
  ).get(memberId, pid);
  if (!member) return res.status(404).json({ error: '成员记录不存在' });

  const updates = [];
  const params = [];
  if (role) {
    if (!['admin', 'manager', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: '无效 role' });
    }
    updates.push('role = ?');
    params.push(role);
  }
  if (sensitivity !== undefined) {
    updates.push('sensitivity = ?');
    params.push(sensitivity);
  }
  if (updates.length === 0) return res.status(400).json({ error: '无更新内容' });

  params.push(memberId);
  db.prepare(`UPDATE project_members SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  res.json({ success: true, id: memberId });
});

// 删除项目成员
router.delete('/:projectId/members/:memberId', requireAuth, (req, res) => {
  const db = getDb();
  const pid = Number(req.params.projectId);
  const memberId = Number(req.params.memberId);

  const currentUser = req.user?.username;
  const userGlobalRole = req.user?.role;
  const projectAdmin = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND username = ? AND role = ?'
  ).get(pid, currentUser, 'admin');

  if (!projectAdmin && userGlobalRole !== 'admin') {
    return res.status(403).json({ error: '无权删除成员' });
  }

  // 不能删除自己的 admin 角色（防止锁定）
  const member = db.prepare(
    'SELECT * FROM project_members WHERE id = ? AND project_id = ?'
  ).get(memberId, pid);
  if (!member) return res.status(404).json({ error: '成员记录不存在' });
  if (member.username === currentUser && member.role === 'admin') {
    return res.status(400).json({ error: '不能删除自己的管理员身份' });
  }

  const r = db.prepare('DELETE FROM project_members WHERE id = ? AND project_id = ?').run(memberId, pid);
  res.json({ success: true, changes: r.changes });
});

// 获取当前用户参与的所有项目（带角色信息）
router.get('/members/my', requireAuth, (req, res) => {
  const db = getDb();
  const username = req.user?.username;

  const memberships = db.prepare(`
    SELECT pm.project_id, pm.role, pm.sensitivity, pm.joined_at, p.name as project_name
    FROM project_members pm
    JOIN projects p ON pm.project_id = p.id
    WHERE pm.username = ?
    ORDER BY pm.joined_at DESC
  `).all(username);

  res.json({ username, memberships });
});

export default router;
