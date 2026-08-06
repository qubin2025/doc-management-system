/**
 * AI 管理端点 — 用量统计 / 用户解冻 / 质量评分
 * 依赖 ai.js 共享的 dailyUsage / DAILY_LIMIT / DAILY_COST_LIMIT
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { dailyUsage, DAILY_LIMIT, DAILY_COST_LIMIT } from '../lib/ratelimit.js';

const router = Router();

// GET 管理员查看AI用量
router.get('/stats', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const today = new Date().toISOString().slice(0, 10);
  const stats = [];
  dailyUsage.forEach((v, k) => {
    if (v.date === today) stats.push({ userId: k, ...v });
  });
  res.json({
    today,
    totalCalls: stats.reduce((s, u) => s + u.count, 0),
    totalCost: +stats.reduce((s, u) => s + u.cost, 0).toFixed(2),
    users: stats.sort((a, b) => b.count - a.count),
    frozenUsers: stats.filter(u => u.frozen).map(u => u.userId),
    limit: { dailyCalls: DAILY_LIMIT, dailyCost: DAILY_COST_LIMIT },
  });
});

// POST 管理员解冻用户
router.post('/unfreeze', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { userId } = req.body;
  const record = dailyUsage.get(userId);
  if (record) { record.frozen = false; record.count = 0; record.cost = 0; }
  res.json({ success: true });
});

// POST AI输出质量评分
router.post('/rate', requireAuth, (req, res) => {
  const { module, context, rating, resultPreview, feedback } = req.body;
  if (!module || !rating) return res.status(400).json({ error: '缺少评分参数' });

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      module TEXT NOT NULL,
      context TEXT DEFAULT '',
      rating TEXT NOT NULL CHECK(rating IN ('up','down')),
      result_preview TEXT DEFAULT '',
      feedback TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_ratings_module ON ai_ratings(module);
    CREATE INDEX IF NOT EXISTS idx_ai_ratings_created ON ai_ratings(created_at);
  `);

  db.prepare(
    `INSERT INTO ai_ratings (user_id, module, context, rating, result_preview, feedback)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.user?.username || 'unknown', module, context || '', rating,
    (resultPreview || '').slice(0, 500), (feedback || '').slice(0, 500));

  res.json({ success: true });
});

// GET AI评分统计（管理员）
router.get('/ratings', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const db = getDb();
  try {
    const summary = db.prepare(
      `SELECT module, rating, COUNT(*) as cnt FROM ai_ratings GROUP BY module, rating`
    ).all();
    const recent = db.prepare(
      `SELECT * FROM ai_ratings ORDER BY created_at DESC LIMIT 50`
    ).all();

    const stats = {};
    for (const s of summary) {
      if (!stats[s.module]) stats[s.module] = { up: 0, down: 0, total: 0 };
      stats[s.module][s.rating] = s.cnt;
      stats[s.module].total += s.cnt;
    }

    res.json({
      summary: stats,
      recent: recent.map(r => ({ ...r, resultPreview: undefined, result_preview: undefined })),
    });
  } catch { res.json({ summary: {}, recent: [] }); }
});

// POST 审查历史保存
router.post('/review/history', requireAuth, (req, res) => {
  const { projectName, reviewType, fileName, results, report } = req.body;
  if (!projectName || !reviewType) return res.status(400).json({ error: '缺少参数' });
  try {
    getDb().prepare(`INSERT INTO ai_review_history (user_id, project_name, review_type, file_name, results, report)
      VALUES (?,?,?,?,?,?)`).run(
      req.user?.username || 'unknown', projectName, reviewType, fileName || '',
      JSON.stringify(results || []), (report || '').slice(0, 5000)
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET 审查历史
router.get('/review/history', requireAuth, (req, res) => {
  const { project, type } = req.query;
  let sql = 'SELECT * FROM ai_review_history WHERE 1=1';
  const params: any[] = [];
  if (project) { sql += ' AND project_name=?'; params.push(project); }
  if (type) { sql += ' AND review_type=?'; params.push(type); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  try {
    const rows = getDb().prepare(sql).all(...params);
    res.json(rows.map((r: any) => ({ ...r, results: JSON.parse(r.results || '[]') })));
  } catch (e) { res.json([]); }
});

export default router;
