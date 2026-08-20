/**
 * v5.7 迭代1: 知识库同步触发中间件
 *
 * 职责：
 * 1. 提供 enqueueKbSync() — 业务路由写入数据后调用，将同步任务入队
 * 2. 提供 getPendingTasks() — 前端轮询获取待处理任务
 * 3. 提供 markTaskDone/markTaskFailed — 前端同步完成后更新状态
 * 4. 提供 cleanupStaleTasks() — 定时清理卡住的 processing 任务
 *
 * 设计原则（审批通过）：
 * - 用队列解耦提交与入库：业务写入立即返回，入库异步执行
 * - 前端轮询队列 → 调用 kbSyncService 执行实际向量化入库
 * - 失败自动重试（max_retries=3），超限标记 failed
 * - 保留手动【同步业务数据】按钮作为兜底入口
 */

import { getDb } from '../db.js';

// 同步源类型枚举
export const SYNC_SOURCE = Object.freeze({
  DAILY: 'daily',
  ISSUE: 'issue',
  EXPERIENCE: 'experience',
  DOCUMENT: 'document',
});

// 任务状态枚举
export const TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
});

// 轮询批次大小
const BATCH_SIZE = 20;
// processing 超时阈值（分钟），超时后重置为 pending
const STALE_THRESHOLD_MIN = 5;

/**
 * 入队：业务路由写入数据成功后调用
 * @param {string} projectName - 项目名称
 * @param {string} source - 同步源（daily/issue/experience/document）
 * @param {string|number} recordId - 业务记录 ID
 * @param {string} action - upsert 或 delete
 * @param {number} priority - 优先级（0=普通，1=高）
 * @returns {{ success: boolean, taskId?: number, error?: string }}
 */
export function enqueueKbSync(projectName, source, recordId, action = 'upsert', priority = 0) {
  if (!projectName || !source || !recordId) {
    return { success: false, error: '参数缺失: projectName/source/recordId 必填' };
  }
  const validSources = Object.values(SYNC_SOURCE);
  if (!validSources.includes(source)) {
    return { success: false, error: `无效 source: ${source}，应为 ${validSources.join('/')}` };
  }

  try {
    const db = getDb();
    // 幂等检查：同项目+同源+同记录+pending/processing 状态不重复入队
    const existing = db.prepare(
      `SELECT id FROM kb_sync_queue
       WHERE project_name = ? AND source = ? AND record_id = ? AND action = ?
         AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`
    ).get(projectName, source, String(recordId), action);

    if (existing) {
      // 已有待处理任务，更新优先级（取较高值）
      if (priority > 0) {
        db.prepare('UPDATE kb_sync_queue SET priority = MAX(priority, ?) WHERE id = ?')
          .run(priority, existing.id);
      }
      return { success: true, taskId: existing.id, deduplicated: true };
    }

    const result = db.prepare(
      `INSERT INTO kb_sync_queue (project_name, source, record_id, action, priority)
       VALUES (?, ?, ?, ?, ?)`
    ).run(projectName, source, String(recordId), action, priority);

    return { success: true, taskId: Number(result.lastInsertRowid) };
  } catch (e) {
    console.error('[kbSyncTrigger] enqueue 失败:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 批量入队：适用于一次提交多条记录的场景
 * @param {Array<{projectName: string, source: string, recordId: string|number, action?: string, priority?: number}>} tasks
 * @returns {{ enqueued: number, deduplicated: number, failed: number }}
 */
export function enqueueBatchKbSync(tasks) {
  let enqueued = 0, deduplicated = 0, failed = 0;
  for (const t of tasks) {
    const r = enqueueKbSync(t.projectName, t.source, t.recordId, t.action || 'upsert', t.priority || 0);
    if (r.success) {
      if (r.deduplicated) deduplicated++;
      else enqueued++;
    } else {
      failed++;
    }
  }
  return { enqueued, deduplicated, failed };
}

/**
 * 获取待处理任务（前端轮询调用）
 * 将 pending 任务原子地标记为 processing 并返回
 * @param {number} limit - 批次大小
 * @returns {Array} 待处理任务列表
 */
export function getPendingTasks(limit = BATCH_SIZE) {
  try {
    const db = getDb();
    // 原子操作：选取 pending → 标记 processing → 返回
    const tx = db.transaction(() => {
      const tasks = db.prepare(
        `SELECT id, project_name, source, record_id, action, priority, created_at
         FROM kb_sync_queue
         WHERE status = 'pending'
         ORDER BY priority DESC, created_at ASC
         LIMIT ?`
      ).all(limit);

      if (tasks.length === 0) return [];

      const ids = tasks.map(t => t.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(
        `UPDATE kb_sync_queue SET status = 'processing' WHERE id IN (${placeholders})`
      ).run(...ids);

      return tasks;
    });
    return tx();
  } catch (e) {
    console.error('[kbSyncTrigger] getPending 失败:', e.message);
    return [];
  }
}

/**
 * 标记任务完成
 * @param {number} taskId - 任务 ID
 */
export function markTaskDone(taskId) {
  try {
    const db = getDb();
    db.prepare(
      `UPDATE kb_sync_queue SET status = 'done', processed_at = datetime('now') WHERE id = ?`
    ).run(taskId);
    return { success: true };
  } catch (e) {
    console.error('[kbSyncTrigger] markDone 失败:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 标记任务失败（支持自动重试）
 * @param {number} taskId - 任务 ID
 * @param {string} errorMsg - 错误信息
 */
export function markTaskFailed(taskId, errorMsg) {
  try {
    const db = getDb();
    const task = db.prepare(
      'SELECT retry_count, max_retries FROM kb_sync_queue WHERE id = ?'
    ).get(taskId);

    if (!task) return { success: false, error: '任务不存在' };

    if (task.retry_count + 1 < task.max_retries) {
      // 重试次数未满，重置为 pending 等待重试
      db.prepare(
        `UPDATE kb_sync_queue
         SET status = 'pending', retry_count = retry_count + 1, error_msg = ?
         WHERE id = ?`
      ).run(errorMsg?.slice(0, 500) || 'unknown error', taskId);
      return { success: true, retried: true, retryCount: task.retry_count + 1 };
    } else {
      // 重试次数已满，标记为 failed
      db.prepare(
        `UPDATE kb_sync_queue
         SET status = 'failed', error_msg = ?, processed_at = datetime('now')
         WHERE id = ?`
      ).run(errorMsg?.slice(0, 500) || 'max retries exceeded', taskId);
      return { success: true, retried: false, failed: true };
    }
  } catch (e) {
    console.error('[kbSyncTrigger] markFailed 失败:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 清理卡住的 processing 任务（超时未完成的）
 * 由定时任务调用，将超过 STALE_THRESHOLD_MIN 分钟的 processing 重置为 pending
 * @returns {number} 重置的任务数
 */
export function cleanupStaleTasks() {
  try {
    const db = getDb();
    const result = db.prepare(
      `UPDATE kb_sync_queue
       SET status = 'pending'
       WHERE status = 'processing'
         AND created_at < datetime('now', ?)`
    ).run(`-${STALE_THRESHOLD_MIN} minutes`);
    return result.changes;
  } catch (e) {
    console.error('[kbSyncTrigger] cleanup 失败:', e.message);
    return 0;
  }
}

/**
 * 获取队列统计（供前端状态指示器展示）
 * @param {string} projectName - 可选，按项目过滤
 * @returns {{ pending: number, processing: number, done: number, failed: number, total: number }}
 */
export function getQueueStats(projectName) {
  try {
    const db = getDb();
    const where = projectName ? `WHERE project_name = ?` : '';
    const params = projectName ? [projectName] : [];
    const row = db.prepare(
      `SELECT
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) as processing,
         SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
         SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
         COUNT(*) as total
       FROM kb_sync_queue ${where}`
    ).get(...params);
    return {
      pending: row.pending || 0,
      processing: row.processing || 0,
      done: row.done || 0,
      failed: row.failed || 0,
      total: row.total || 0,
    };
  } catch (e) {
    console.error('[kbSyncTrigger] stats 失败:', e.message);
    return { pending: 0, processing: 0, done: 0, failed: 0, total: 0 };
  }
}

// ========== v5.7 迭代4: 权限校验辅助函数 ==========

/**
 * 检查用户是否有指定项目的访问权限
 * @param {string} username - 用户名
 * @param {string} projectName - 项目名称
 * @returns {{ allowed: boolean, role?: string, sensitivity?: number, reason?: string }}
 */
export function canAccessProject(username, projectName) {
  if (!username || !projectName) {
    return { allowed: false, reason: '参数缺失' };
  }
  try {
    const db = getDb();
    // 全局 admin 拥有所有权限
    const user = db.prepare('SELECT role FROM users WHERE username = ?').get(username);
    if (!user) return { allowed: false, reason: '用户不存在' };
    if (user.role === 'admin') return { allowed: true, role: 'admin', sensitivity: 2 };

    // 查找项目 ID
    const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName);
    if (!project) return { allowed: false, reason: '项目不存在' };

    // 查找项目成员记录
    const member = db.prepare(
      'SELECT role, sensitivity FROM project_members WHERE project_id = ? AND username = ?'
    ).get(project.id, username);

    if (!member) return { allowed: false, reason: '非项目成员' };

    return { allowed: true, role: member.role, sensitivity: member.sensitivity || 0 };
  } catch (e) {
    console.error('[kbSyncTrigger] canAccess 失败:', e.message);
    return { allowed: false, reason: '系统错误' };
  }
}

/**
 * 按用户权限过滤队列任务
 * 仅返回用户有权访问的项目对应的任务
 * @param {Array} tasks - 原始任务列表
 * @param {string} username - 当前用户名
 * @returns {{ filtered: Array, skipped: number }}
 */
export function filterTasksByPermission(tasks, username) {
  if (!tasks || tasks.length === 0) return { filtered: [], skipped: 0 };

  try {
    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE username = ?').get(username);
    if (!user) return { filtered: [], skipped: tasks.length };

    // admin 看到所有任务
    if (user.role === 'admin') return { filtered: tasks, skipped: 0 };

    // 获取用户参与的所有项目
    const projectIds = new Set();
    const memberships = db.prepare(
      `SELECT pm.project_id FROM project_members pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.username = ?`
    ).all(username);
    memberships.forEach(m => projectIds.add(m.project_id));

    // 过滤任务：仅保留用户参与的项目
    const filtered = tasks.filter(task => {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(task.project_name);
      return project && projectIds.has(project.id);
    });

    return { filtered, skipped: tasks.length - filtered.length };
  } catch (e) {
    console.error('[kbSyncTrigger] filterTasks 失败:', e.message);
    return { filtered: [], skipped: tasks.length };
  }
}

/**
 * 获取用户可以访问的项目名称列表（用于前端展示）
 * @param {string} username
 * @returns {Array<{project_name: string, role: string, sensitivity: number}>}
 */
export function getUserProjects(username) {
  try {
    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE username = ?').get(username);
    if (!user) return [];

    if (user.role === 'admin') {
      // admin 看到所有项目
      return db.prepare(`
        SELECT p.name as project_name, 'admin' as role, 2 as sensitivity
        FROM projects p
      `).all();
    }

    return db.prepare(`
      SELECT p.name as project_name, pm.role, pm.sensitivity
      FROM project_members pm
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.username = ?
      ORDER BY pm.role, p.name
    `).all(username);
  } catch (e) {
    console.error('[kbSyncTrigger] getUserProjects 失败:', e.message);
    return [];
  }
}
