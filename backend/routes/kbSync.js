import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

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

export default router;
