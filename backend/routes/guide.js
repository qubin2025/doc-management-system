/**
 * 指南模块 API — 进度/表单持久化
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db.js';

const router = Router();

// POST /api/guide/progress — 保存章节工作项完成进度
router.post('/progress', requireAuth, (req, res) => {
  const { projectName, chapterId, completedItems } = req.body;
  if (!projectName || !chapterId) return res.status(400).json({ error: '缺少参数' });
  try {
    const db = getDb();
    db.prepare(`INSERT INTO guide_progress (project_name, chapter_id, completed_items) VALUES (?,?,?)
      ON CONFLICT(project_name, chapter_id) DO UPDATE SET completed_items=excluded.completed_items, updated_at=datetime('now')`)
      .run(projectName, chapterId, JSON.stringify(completedItems || []));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guide/progress?project=X&chapter=Y — 读取进度
router.get('/progress', requireAuth, (req, res) => {
  const { project, chapter } = req.query;
  if (!project || !chapter) return res.status(400).json({ error: '缺少参数' });
  try {
    const row = getDb().prepare('SELECT completed_items FROM guide_progress WHERE project_name=? AND chapter_id=?').get(project, chapter);
    res.json({ completedItems: row ? JSON.parse(row.completed_items) : [] });
  } catch (e) { res.json({ completedItems: [] }); }
});

// POST /api/guide/forms — 保存表单内容
router.post('/forms', requireAuth, (req, res) => {
  const { projectName, chapterId, code, content } = req.body;
  if (!projectName || !chapterId || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const db = getDb();
    db.prepare(`INSERT INTO guide_forms (project_name, chapter_id, form_code, content) VALUES (?,?,?,?)
      ON CONFLICT(project_name, chapter_id, form_code) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`)
      .run(projectName, chapterId, code, typeof content === 'string' ? content : JSON.stringify(content));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guide/forms?project=X&chapter=Y&code=Z — 读取表单
router.get('/forms', requireAuth, (req, res) => {
  const { project, chapter, code } = req.query;
  if (!project || !chapter || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const row = getDb().prepare('SELECT content FROM guide_forms WHERE project_name=? AND chapter_id=? AND form_code=?').get(project, chapter, code);
    res.json({ content: row ? row.content : '' });
  } catch (e) { res.json({ content: '' }); }
});

export default router;
