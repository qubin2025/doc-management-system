import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { kbWorker } from '../services/kbWorker.js';
import { searchVectors, getSearchStats, searchBM25, searchHybrid, rebuildFtsIndex } from '../services/searchService.js';
import { getCacheStats, clearCache, pruneCache } from '../services/embeddingService.js';
import {
  getPendingTasks,
  markTaskDone,
  markTaskFailed,
  getQueueStats,
  cleanupStaleTasks,
  filterTasksByPermission,
  canAccessProject,
} from '../middleware/kbSyncTrigger.js';

const router = Router();

// 知识库同步状态端点 — 供前端增量同步使用
// 返回各项目三张业务表（日报/问题/经验）的最大更新时间

function safeGet(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

// GET /api/kb/sync/status[?projectName=xxx]
// 返回：{ projects: [{ projectName, dailyMaxAt, issueMaxAt, experienceMaxAt, dailyCount, issueCount, experienceCount }] }
router.get('/sync/status', requireAuth, (req, res) => {
  const db = getDb();
  const { projectName } = req.query;

  try {
    // 日报 — 基于 created_at（daily_reports 表无 updated_at）
    const dailyRows = safeGet(() => {
      const sql = projectName
        ? `SELECT p.name as project_name, MAX(dr.created_at) as max_at, COUNT(*) as cnt
           FROM daily_reports dr JOIN projects p ON dr.project_id = p.id
           WHERE p.name = ? AND (dr.deleted = 0 OR dr.deleted IS NULL)
           GROUP BY dr.project_id`
        : `SELECT p.name as project_name, MAX(dr.created_at) as max_at, COUNT(*) as cnt
           FROM daily_reports dr JOIN projects p ON dr.project_id = p.id
           WHERE (dr.deleted = 0 OR dr.deleted IS NULL)
           GROUP BY dr.project_id`;
      return projectName ? db.prepare(sql).all(projectName) : db.prepare(sql).all();
    }, []) || [];

    // 现场问题 — 基于 updated_at
    const issueRows = safeGet(() => {
      const sql = projectName
        ? `SELECT p.name as project_name, MAX(mi.updated_at) as max_at, COUNT(*) as cnt
           FROM mobile_issues mi JOIN projects p ON mi.project_id = p.id
           WHERE p.name = ?
           GROUP BY mi.project_id`
        : `SELECT p.name as project_name, MAX(mi.updated_at) as max_at, COUNT(*) as cnt
           FROM mobile_issues mi JOIN projects p ON mi.project_id = p.id
           GROUP BY mi.project_id`;
      return projectName ? db.prepare(sql).all(projectName) : db.prepare(sql).all();
    }, []) || [];

    // 项目经验 — 基于 updated_at（project_experiences 直接存 project_name）
    const expRows = safeGet(() => {
      const sql = projectName
        ? `SELECT project_name, MAX(updated_at) as max_at, COUNT(*) as cnt
           FROM project_experiences WHERE project_name = ? GROUP BY project_name`
        : `SELECT project_name, MAX(updated_at) as max_at, COUNT(*) as cnt
           FROM project_experiences GROUP BY project_name`;
      return projectName ? db.prepare(sql).all(projectName) : db.prepare(sql).all();
    }, []) || [];

    // 合并为 { projectName → { daily, issue, experience } }
    const map = new Map();
    for (const r of dailyRows) {
      if (!r.project_name) continue;
      const e = map.get(r.project_name) || { projectName: r.project_name };
      e.dailyMaxAt = r.max_at || null;
      e.dailyCount = r.cnt || 0;
      map.set(r.project_name, e);
    }
    for (const r of issueRows) {
      if (!r.project_name) continue;
      const e = map.get(r.project_name) || { projectName: r.project_name };
      e.issueMaxAt = r.max_at || null;
      e.issueCount = r.cnt || 0;
      map.set(r.project_name, e);
    }
    for (const r of expRows) {
      if (!r.project_name) continue;
      const e = map.get(r.project_name) || { projectName: r.project_name };
      e.experienceMaxAt = r.max_at || null;
      e.experienceCount = r.cnt || 0;
      map.set(r.project_name, e);
    }

    const projects = Array.from(map.values()).sort((a, b) =>
      (b.dailyCount || 0) + (b.issueCount || 0) + (b.experienceCount || 0) -
      ((a.dailyCount || 0) + (a.issueCount || 0) + (a.experienceCount || 0))
    );

    res.json({
      success: true,
      projects,
      totalProjects: projects.length,
      totalDaily: projects.reduce((s, p) => s + (p.dailyCount || 0), 0),
      totalIssues: projects.reduce((s, p) => s + (p.issueCount || 0), 0),
      totalExperiences: projects.reduce((s, p) => s + (p.experienceCount || 0), 0),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[kbSync/status] error:', e.message);
    res.status(500).json({ success: false, error: '同步状态查询失败', projects: [] });
  }
});

// GET /api/kb/sync/daily?projectName=xxx[&since=ISO_DATE]
// 返回该项目的日报列表（含子表内容），供前端拆块入库
router.get('/sync/daily', requireAuth, (req, res) => {
  const db = getDb();
  const { projectName, since } = req.query;
  if (!projectName) return res.status(400).json({ error: '缺少 projectName' });

  try {
    const sinceClause = since ? `AND dr.created_at > ?` : '';
    const params = since ? [projectName, since] : [projectName];
    const rows = db.prepare(`
      SELECT dr.id, dr.report_date, dr.weather_day, dr.weather_night, dr.weather_alert, dr.weather_alert_level,
             dr.managers_main, dr.managers_labor, dr.managers_specialty,
             dr.workers_main, dr.workers_labor, dr.workers_specialty, dr.workers_special, dr.workers_total,
             dr.machinery, dr.machinery_total, dr.materials,
             dr.tasks, dr.quality_risks, dr.issues, dr.photos,
             dr.original_text, dr.notes, dr.reported_by, dr.created_at,
             p.name as project_name
      FROM daily_reports dr JOIN projects p ON dr.project_id = p.id
      WHERE p.name = ? AND (dr.deleted = 0 OR dr.deleted IS NULL) ${sinceClause}
      ORDER BY dr.report_date DESC LIMIT 500
    `).all(...params);

    // 解析 JSON 字段
    const parsed = rows.map(r => ({
      ...r,
      machinery: safeParse(r.machinery, []),
      materials: safeParse(r.materials, []),
      tasks: safeParse(r.tasks, []),
      quality_risks: safeParse(r.quality_risks, []),
      issues: safeParse(r.issues, []),
      photos: safeParse(r.photos, []),
    }));

    res.json({ success: true, items: parsed, count: parsed.length });
  } catch (e) {
    console.error('[kbSync/daily] error:', e.message);
    res.status(500).json({ success: false, error: '日报查询失败', items: [] });
  }
});

// GET /api/kb/sync/issues?projectName=xxx[&since=ISO_DATE]
router.get('/sync/issues', requireAuth, (req, res) => {
  const db = getDb();
  const { projectName, since } = req.query;
  if (!projectName) return res.status(400).json({ error: '缺少 projectName' });

  try {
    const sinceClause = since ? `AND mi.updated_at > ?` : '';
    const params = since ? [projectName, since] : [projectName];
    const rows = db.prepare(`
      SELECT mi.id, mi.title, mi.description, mi.severity, mi.status, mi.assignee,
             mi.photo_path, mi.reported_by, mi.created_at, mi.updated_at,
             p.name as project_name
      FROM mobile_issues mi JOIN projects p ON mi.project_id = p.id
      WHERE p.name = ? ${sinceClause}
      ORDER BY mi.created_at DESC LIMIT 500
    `).all(...params);

    res.json({ success: true, items: rows, count: rows.length });
  } catch (e) {
    console.error('[kbSync/issues] error:', e.message);
    res.status(500).json({ success: false, error: '问题查询失败', items: [] });
  }
});

// GET /api/kb/sync/experiences[?projectName=xxx][&since=ISO_DATE]
router.get('/sync/experiences', requireAuth, (req, res) => {
  const db = getDb();
  const { projectName, since } = req.query;

  try {
    const where = [];
    const params = [];
    if (projectName) { where.push('project_name = ?'); params.push(projectName); }
    if (since) { where.push('updated_at > ?'); params.push(since); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT id, project_name, category, title, description, patterns, metrics,
             reference_count, created_at, updated_at
      FROM project_experiences ${whereClause}
      ORDER BY updated_at DESC LIMIT 500
    `).all(...params);

    const parsed = rows.map(r => ({
      ...r,
      patterns: safeParse(r.patterns, []),
      metrics: safeParse(r.metrics, {}),
    }));

    res.json({ success: true, items: parsed, count: parsed.length });
  } catch (e) {
    console.error('[kbSync/experiences] error:', e.message);
    res.status(500).json({ success: false, error: '经验查询失败', items: [] });
  }
});

function safeParse(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

// ========== v5.7 迭代1第3条: 按队列任务拉取单条业务记录 ==========

// GET /api/kb/sync/task/:source/:recordId
// 队列处理器调用 — 按 source + recordId 拉取单条业务记录（含 projectName）
// 返回 record 字段格式与 /sync/daily|issues|experiences 的 items 元素一致，前端可复用 buildChunk
// v5.7 迭代4: 拉取前校验项目访问权限
router.get('/sync/task/:source/:recordId', requireAuth, (req, res) => {
  const db = getDb();
  const { source, recordId } = req.params;
  const username = req.user?.username;

  try {
    // 先获取记录以确定 projectName
    let projectName = null;
    let record = null;

    if (source === 'daily') {
      const r = db.prepare(`
        SELECT p.name as project_name, dr.id, dr.report_date, dr.weather_day, dr.weather_night, dr.weather_alert, dr.weather_alert_level,
               dr.managers_main, dr.managers_labor, dr.managers_specialty,
               dr.workers_main, dr.workers_labor, dr.workers_specialty, dr.workers_special, dr.workers_total,
               dr.machinery, dr.machinery_total, dr.materials,
               dr.tasks, dr.quality_risks, dr.issues, dr.photos,
               dr.original_text, dr.notes, dr.reported_by, dr.created_at
        FROM daily_reports dr JOIN projects p ON dr.project_id = p.id
        WHERE dr.id = ? AND (dr.deleted = 0 OR dr.deleted IS NULL)
      `).get(Number(recordId));
      if (!r) return res.status(404).json({ success: false, error: '日报不存在或已删除', task: null });
      projectName = r.project_name;
      record = {
        ...r,
        machinery: safeParse(r.machinery, []),
        materials: safeParse(r.materials, []),
        tasks: safeParse(r.tasks, []),
        quality_risks: safeParse(r.quality_risks, []),
        issues: safeParse(r.issues, []),
        photos: safeParse(r.photos, []),
      };
    } else if (source === 'issue') {
      const r = db.prepare(`
        SELECT p.name as project_name, mi.id, mi.title, mi.description, mi.severity, mi.status, mi.assignee,
               mi.photo_path, mi.reported_by, mi.created_at, mi.updated_at
        FROM mobile_issues mi JOIN projects p ON mi.project_id = p.id
        WHERE mi.id = ?
      `).get(Number(recordId));
      if (!r) return res.status(404).json({ success: false, error: '问题不存在', task: null });
      projectName = r.project_name;
      record = r;
    } else if (source === 'experience') {
      const r = db.prepare(`
        SELECT id, project_name, category, title, description, patterns, metrics,
               reference_count, created_at, updated_at
        FROM project_experiences WHERE id = ?
      `).get(recordId);
      if (!r) return res.status(404).json({ success: false, error: '经验不存在', task: null });
      projectName = r.project_name;
      record = { ...r, patterns: safeParse(r.patterns, []), metrics: safeParse(r.metrics, {}) };
    } else if (source === 'document') {
      const r = db.prepare(`
        SELECT d.id, d.doc_id, d.file_name, d.upload_time, d.version, d.standard,
               p.name as project_name
        FROM documents d LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.id = ?
      `).get(Number(recordId));
      if (!r) return res.status(404).json({ success: false, error: '文档不存在', task: null });
      projectName = r.project_name || '未知项目';
      record = r;
    } else {
      return res.status(400).json({ success: false, error: `不支持的 source: ${source}` });
    }

    // v5.7 迭代4: 校验项目访问权限
    if (projectName && username) {
      const access = canAccessProject(username, projectName);
      if (!access.allowed && username !== 'admin') {
        console.log(`[kbSync/task] 权限拒绝: user=${username} project=${projectName} reason=${access.reason}`);
        return res.status(403).json({
          success: false,
          error: `无权访问项目 ${projectName}`,
          reason: access.reason,
          task: null,
        });
      }
    }

    return res.json({
      success: true,
      task: { source, recordId: String(recordId), projectName, record },
    });
  } catch (e) {
    console.error('[kbSync/task] error:', e.message);
    res.status(500).json({ success: false, error: '任务记录查询失败', task: null });
  }
});

// ========== v5.7 迭代1: 同步队列端点 ==========

// GET /api/kb/sync/queue?limit=20
// 前端轮询获取待处理同步任务（原子标记为 processing 并返回）
// v5.7 迭代4: 按用户权限过滤，仅返回用户有权访问的项目任务
router.get('/sync/queue', requireAuth, (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const tasks = getPendingTasks(limit);
    // 按权限过滤
    const { filtered, skipped } = filterTasksByPermission(tasks, req.user?.username);
    if (skipped > 0) {
      console.log(`[kbSync/queue] 权限过滤: ${skipped} 条任务因权限不足被过滤`);
    }
    res.json({ success: true, tasks: filtered, count: filtered.length, skipped });
  } catch (e) {
    console.error('[kbSync/queue] error:', e.message);
    res.status(500).json({ success: false, error: '获取队列失败', tasks: [] });
  }
});

// GET /api/kb/sync/queue/stats[?projectName=xxx]
// 返回队列统计（供前端状态指示器展示）
router.get('/sync/queue/stats', requireAuth, (req, res) => {
  try {
    const stats = getQueueStats(req.query.projectName);
    res.json({ success: true, ...stats });
  } catch (e) {
    console.error('[kbSync/queue/stats] error:', e.message);
    res.status(500).json({ success: false, error: '统计失败' });
  }
});

// POST /api/kb/sync/queue/done  body: { taskId }
// 标记任务完成
router.post('/sync/queue/done', requireAuth, (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: '缺少 taskId' });
  const result = markTaskDone(Number(taskId));
  res.json(result);
});

// POST /api/kb/sync/queue/failed  body: { taskId, error }
// 标记任务失败（支持自动重试）
router.post('/sync/queue/failed', requireAuth, (req, res) => {
  const { taskId, error } = req.body;
  if (!taskId) return res.status(400).json({ error: '缺少 taskId' });
  const result = markTaskFailed(Number(taskId), error || 'unknown');
  res.json(result);
});

// POST /api/kb/sync/queue/cleanup
// 清理卡住的 processing 任务（定时调用或手动触发）
router.post('/sync/queue/cleanup', requireAuth, (req, res) => {
  try {
    const resetCount = cleanupStaleTasks();
    res.json({ success: true, resetCount });
  } catch (e) {
    console.error('[kbSync/queue/cleanup] error:', e.message);
    res.status(500).json({ success: false, error: '清理失败' });
  }
});

// ========== v5.9 迭代5.7: 后端语义检索 API ==========

// 计算用户的最高敏感等级（admin=2, 非 admin 查 project_members）
function getUserMaxSensitivity(req) {
  if (req.user?.role === 'admin') return 2;
  try {
    const db = getDb();
    const row = db.prepare(
      'SELECT MAX(sensitivity) as max_sens FROM project_members WHERE user_id = ?'
    ).get(req.user.id);
    return row?.max_sens ?? 0;
  } catch {
    return 0;
  }
}

// POST /api/kb/search
// 语义检索：接收 query embedding，返回 Top-K 最相似文档
router.post('/search', requireAuth, async (req, res) => {
  try {
    const { queryEmbedding, project, topK } = req.body || {};
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return res.status(400).json({ success: false, error: 'queryEmbedding 不能为空' });
    }
    // 5.7: 权限 — 后端自动计算 maxSensitivity，不信任前端传入
    const maxSensitivity = getUserMaxSensitivity(req);
    const results = await searchVectors(queryEmbedding, {
      project: project || null,
      topK: topK || 10,
      maxSensitivity,
    });
    res.json({
      success: true,
      results,
      total: results.length,
      query: {
        dimension: queryEmbedding.length,
        project: project || 'all',
        topK: topK || 10,
        maxSensitivity,
      },
    });
  } catch (e) {
    console.error('[kb/search] error:', e.message);
    res.status(500).json({ success: false, error: '检索失败: ' + e.message });
  }
});

// GET /api/kb/search/stats
// 检索服务统计（向量总数/项目分布/敏感等级分布）
router.get('/search/stats', requireAuth, (req, res) => {
  try {
    const stats = getSearchStats();
    res.json({ success: true, ...stats });
  } catch (e) {
    res.status(500).json({ success: false, error: '统计查询失败' });
  }
});

// ========== v5.11 迭代5.9: 混合检索（向量 + BM25） ==========

// POST /api/kb/search/hybrid
// 混合检索：融合向量搜索 + BM25 全文检索
router.post('/search/hybrid', requireAuth, async (req, res) => {
  try {
    const { queryEmbedding, query, project, topK, alpha } = req.body || {};
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return res.status(400).json({ success: false, error: 'queryEmbedding 不能为空' });
    }
    const maxSensitivity = getUserMaxSensitivity(req);
    const results = await searchHybrid(queryEmbedding, query || '', {
      project: project || null,
      topK: topK || 10,
      alpha: alpha != null ? alpha : 0.7,
      maxSensitivity,
    });
    res.json({
      success: true,
      results,
      total: results.length,
      query: {
        dimension: queryEmbedding.length,
        text: query || '',
        project: project || 'all',
        topK: topK || 10,
        alpha: alpha != null ? alpha : 0.7,
        maxSensitivity,
      },
    });
  } catch (e) {
    console.error('[kb/search/hybrid] error:', e.message);
    res.status(500).json({ success: false, error: '混合检索失败: ' + e.message });
  }
});

// POST /api/kb/search/bm25
// 纯 BM25 全文检索（无需 embedding，适合快速关键词搜索）
router.post('/search/bm25', requireAuth, async (req, res) => {
  try {
    const { query, project, topK } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'query 不能为空' });
    }
    const maxSensitivity = getUserMaxSensitivity(req);
    const results = await searchBM25(query, {
      project: project || null,
      topK: topK || 10,
      maxSensitivity,
    });
    res.json({
      success: true,
      results,
      total: results.length,
      query: { text: query, project: project || 'all', topK: topK || 10, maxSensitivity },
    });
  } catch (e) {
    console.error('[kb/search/bm25] error:', e.message);
    res.status(500).json({ success: false, error: 'BM25 检索失败: ' + e.message });
  }
});

// POST /api/kb/fts/rebuild
// 重建 FTS5 全文索引（仅 admin/manager）
router.post('/fts/rebuild', requireRole('admin', 'project_manager'), (req, res) => {
  try {
    const r = rebuildFtsIndex();
    res.json({ success: true, ...r, message: `FTS5 索引重建完成: ${r.total} 条` });
  } catch (e) {
    console.error('[kb/fts/rebuild] error:', e.message);
    res.status(500).json({ success: false, error: '索引重建失败: ' + e.message });
  }
});

// ========== v5.10 迭代5.8: Embedding 缓存管理 ==========

// GET /api/kb/embedding-cache/stats
// 缓存统计（总数/命中次数/各 type 分布/最旧记录时间）
router.get('/embedding-cache/stats', requireAuth, (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({ success: true, ...stats });
  } catch (e) {
    res.status(500).json({ success: false, error: '缓存统计失败' });
  }
});

// POST /api/kb/embedding-cache/clear
// 清空缓存（仅 admin/manager 可操作）
router.post('/embedding-cache/clear', requireRole('admin', 'project_manager'), (req, res) => {
  try {
    const r = clearCache();
    res.json({ success: true, ...r, message: `已清空 ${r.deleted} 条缓存` });
  } catch (e) {
    res.status(500).json({ success: false, error: '清空失败' });
  }
});

// POST /api/kb/embedding-cache/prune
// 清理过期缓存（仅 admin/manager，可选参数 days=30）
router.post('/embedding-cache/prune', requireRole('admin', 'project_manager'), (req, res) => {
  try {
    const days = parseInt(req.query.days || req.body?.days || '30', 10);
    const r = pruneCache(days);
    res.json({ success: true, ...r, message: `清理完成：未使用 ${r.unused} 条 + 过期 ${r.expired} 条` });
  } catch (e) {
    res.status(500).json({ success: false, error: '清理失败' });
  }
});

// ========== v5.8 迭代5.5: Worker 启动/停止/状态 API ==========

// POST /api/kb/worker/start
// 启动 Worker（仅 admin/manager 可操作）
router.post('/worker/start', requireRole('admin', 'project_manager'), (req, res) => {
  try {
    const before = kbWorker.state;
    kbWorker.start();
    const after = kbWorker.state;
    const action = before === 'stopped' ? 'started' : 'already_running';
    const stats = kbWorker.getStats();
    console.log(`[kbWorker/start] by user=${req.user.username}, action=${action}`);
    res.json({
      success: true,
      action,
      message: action === 'started' ? 'Worker 已启动' : 'Worker 已在运行中',
      worker: {
        workerId: stats.workerId,
        state: stats.state,
        isRunning: stats.isRunning,
      },
    });
  } catch (e) {
    console.error('[kbWorker/start] error:', e.message);
    res.status(500).json({ success: false, error: '启动失败: ' + e.message });
  }
});

// POST /api/kb/worker/stop
// 停止 Worker（仅 admin/manager 可操作）— 异步等待优雅退出完成
router.post('/worker/stop', requireRole('admin', 'project_manager'), async (req, res) => {
  try {
    const before = kbWorker.state;
    if (before === 'stopped') {
      return res.json({
        success: true,
        action: 'already_stopped',
        message: 'Worker 已处于停止状态',
        worker: { state: 'stopped', isRunning: false },
      });
    }
    console.log(`[kbWorker/stop] by user=${req.user.username}, waiting for graceful shutdown...`);
    const t0 = Date.now();
    await kbWorker.stop();
    const elapsedMs = Date.now() - t0;
    const stats = kbWorker.getStats();
    res.json({
      success: true,
      action: 'stopped',
      message: `Worker 已停止（耗时 ${elapsedMs}ms）`,
      elapsedMs,
      worker: {
        workerId: stats.workerId,
        state: stats.state,
        isRunning: stats.isRunning,
      },
    });
  } catch (e) {
    console.error('[kbWorker/stop] error:', e.message);
    res.status(500).json({ success: false, error: '停止失败: ' + e.message });
  }
});

// GET /api/kb/worker/status
// 查询 Worker 状态（所有登录用户可查看，用于前端健康监控）
// 5.13 验证用：SIMULATE_WORKER_DOWN=1 时强制返回 503，模拟后端不可用
router.get('/worker/status', requireAuth, (req, res) => {
  try {
    if (process.env.SIMULATE_WORKER_DOWN === '1') {
      console.warn('[kbWorker/status] SIMULATE_WORKER_DOWN=1, returning 503');
      return res.status(503).json({ success: false, error: '模拟故障: Worker 不可用' });
    }
    const stats = kbWorker.getStats();
    res.json({
      success: true,
      worker: {
        workerId: stats.workerId,
        state: stats.state,
        isRunning: stats.isRunning,
        uptime: stats.uptime,
        inFlightTasks: stats.inFlightTasks,
        pendingBackoff: stats.pendingBackoff,
      },
      stats: stats.stats,
      queue: stats.queue,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[kbWorker/status] error:', e.message);
    res.status(500).json({ success: false, error: '状态查询失败' });
  }
});

// ========== v5.12: localStorage 向量数据迁移到 SQLite ==========

// POST /api/kb/migrate/local-vectors
// 接收前端从 localStorage 读取的 VectorDoc 数组，批量入库到 vector_embeddings + FTS5
// body: { docs: [{ id, text, embedding: number[], metadata: { projectName, fileName, ... } }] }
// 限制：单批 ≤ 200 条（避免请求体过大，前端应分批调用）
router.post('/migrate/local-vectors', requireRole('admin', 'project_manager'), (req, res) => {
  try {
    const { docs } = req.body || {};
    if (!Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({ success: false, error: 'docs 不能为空' });
    }
    if (docs.length > 200) {
      return res.status(400).json({
        success: false,
        error: `单批最多 200 条，当前 ${docs.length} 条，请分批调用`,
      });
    }
    const db = getDb();
    const insertVec = db.prepare(
      `INSERT OR REPLACE INTO vector_embeddings
        (id, project, doc_id, doc_name, chunk_index, text, embedding, dimension, sensitivity, metadata, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    const insertFts = db.prepare(
      `INSERT OR REPLACE INTO vector_embeddings_fts (text, external_id) VALUES (?, ?)`
    );
    // 先删除已有 FTS5 索引（同 external_id 前缀的旧记录）
    const deleteFts = db.prepare(`DELETE FROM vector_embeddings_fts WHERE external_id = ?`);

    let inserted = 0;
    let skipped = 0;
    const errors = [];
    const tx = db.transaction((rows) => {
      for (const d of rows) {
        try {
          if (!d || !d.id || !d.text || !Array.isArray(d.embedding) || d.embedding.length === 0) {
            skipped++;
            errors.push({ id: d?.id || 'unknown', reason: 'invalid fields' });
            continue;
          }
          const projectName = d.metadata?.projectName || d.project || 'default';
          const docId = d.metadata?.docId || d.id;
          const docName = d.metadata?.fileName || d.metadata?.docName || d.id;
          const chunkIndex = d.metadata?.chunkIndex ?? 0;
          const sensitivity = d.metadata?.sensitivity ?? 0;
          const buf = Buffer.from(new Float32Array(d.embedding).buffer);
          insertVec.run(
            d.id, projectName, docId, docName, chunkIndex,
            String(d.text).slice(0, 8000), buf, d.embedding.length,
            sensitivity, JSON.stringify(d.metadata || {})
          );
          deleteFts.run(d.id);
          insertFts.run(String(d.text).slice(0, 8000), d.id);
          inserted++;
        } catch (err) {
          skipped++;
          errors.push({ id: d?.id || 'unknown', reason: err.message });
        }
      }
    });
    tx(docs);

    console.log(`[kb/migrate] user=${req.user.username} batch=${docs.length} inserted=${inserted} skipped=${skipped}`);
    res.json({
      success: true,
      inserted,
      skipped,
      errors: errors.slice(0, 10),  // 最多返回前 10 条错误
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error('[kb/migrate/local-vectors] error:', e.message);
    res.status(500).json({ success: false, error: '迁移失败: ' + e.message });
  }
});

export default router;
