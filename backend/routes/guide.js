/**
 * 指南模块 API — 进度/表单/样本/成果/AI提示词 持久化
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

// ===== 样本文件 / 成果文件 / AI提示词 =====

/**
 * POST /api/guide/sample-files — 保存某表单的样本文件列表（整组覆盖）
 * body: { projectName, chapterId, code, sampleFiles: FormSampleFile[] }
 */
router.post('/sample-files', requireAuth, (req, res) => {
  const { projectName, chapterId, code, sampleFiles } = req.body;
  if (!projectName || !chapterId || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const db = getDb();
    db.prepare(`INSERT INTO guide_forms (project_name, chapter_id, form_code, sample_files) VALUES (?,?,?,?)
      ON CONFLICT(project_name, chapter_id, form_code) DO UPDATE SET sample_files=excluded.sample_files, updated_at=datetime('now')`)
      .run(projectName, chapterId, code, JSON.stringify(sampleFiles || []));
    console.log(`[guide] 样本文件保存: project=${projectName} chapter=${chapterId} code=${code} count=${(sampleFiles || []).length}`);
    res.json({ success: true, count: (sampleFiles || []).length });
  } catch (e) {
    console.error(`[guide] 样本文件保存失败:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/guide/sample-files?project=X&chapter=Y&code=Z — 读取样本文件
 */
router.get('/sample-files', requireAuth, (req, res) => {
  const { project, chapter, code } = req.query;
  if (!project || !chapter || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const row = getDb().prepare('SELECT sample_files FROM guide_forms WHERE project_name=? AND chapter_id=? AND form_code=?').get(project, chapter, code);
    const sampleFiles = row && row.sample_files ? JSON.parse(row.sample_files) : [];
    res.json({ sampleFiles });
  } catch (e) {
    console.error(`[guide] 样本文件读取失败:`, e.message);
    res.json({ sampleFiles: [] });
  }
});

/**
 * POST /api/guide/artifacts — 保存某表单的成果文件列表（整组覆盖，含版本号）
 * body: { projectName, chapterId, code, artifacts: FormArtifact[] }
 */
router.post('/artifacts', requireAuth, (req, res) => {
  const { projectName, chapterId, code, artifacts } = req.body;
  if (!projectName || !chapterId || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const db = getDb();
    db.prepare(`INSERT INTO guide_forms (project_name, chapter_id, form_code, artifacts) VALUES (?,?,?,?)
      ON CONFLICT(project_name, chapter_id, form_code) DO UPDATE SET artifacts=excluded.artifacts, updated_at=datetime('now')`)
      .run(projectName, chapterId, code, JSON.stringify(artifacts || []));
    console.log(`[guide] 成果文件保存: project=${projectName} chapter=${chapterId} code=${code} count=${(artifacts || []).length}`);
    res.json({ success: true, count: (artifacts || []).length });
  } catch (e) {
    console.error(`[guide] 成果文件保存失败:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/guide/artifacts?project=X&chapter=Y&code=Z — 读取成果文件
 */
router.get('/artifacts', requireAuth, (req, res) => {
  const { project, chapter, code } = req.query;
  if (!project || !chapter || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const row = getDb().prepare('SELECT artifacts FROM guide_forms WHERE project_name=? AND chapter_id=? AND form_code=?').get(project, chapter, code);
    const artifacts = row && row.artifacts ? JSON.parse(row.artifacts) : [];
    res.json({ artifacts });
  } catch (e) {
    console.error(`[guide] 成果文件读取失败:`, e.message);
    res.json({ artifacts: [] });
  }
});

/**
 * POST /api/guide/ai-prompt — 保存某表单的 AI 提示词
 * body: { projectName, chapterId, code, aiPrompt: string }
 */
router.post('/ai-prompt', requireAuth, (req, res) => {
  const { projectName, chapterId, code, aiPrompt } = req.body;
  if (!projectName || !chapterId || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const db = getDb();
    db.prepare(`INSERT INTO guide_forms (project_name, chapter_id, form_code, ai_prompt) VALUES (?,?,?,?)
      ON CONFLICT(project_name, chapter_id, form_code) DO UPDATE SET ai_prompt=excluded.ai_prompt, updated_at=datetime('now')`)
      .run(projectName, chapterId, code, typeof aiPrompt === 'string' ? aiPrompt : '');
    console.log(`[guide] AI提示词保存: project=${projectName} chapter=${chapterId} code=${code} len=${(aiPrompt || '').length}`);
    res.json({ success: true });
  } catch (e) {
    console.error(`[guide] AI提示词保存失败:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/guide/ai-prompt?project=X&chapter=Y&code=Z — 读取 AI 提示词
 */
router.get('/ai-prompt', requireAuth, (req, res) => {
  const { project, chapter, code } = req.query;
  if (!project || !chapter || !code) return res.status(400).json({ error: '缺少参数' });
  try {
    const row = getDb().prepare('SELECT ai_prompt FROM guide_forms WHERE project_name=? AND chapter_id=? AND form_code=?').get(project, chapter, code);
    res.json({ aiPrompt: row ? (row.ai_prompt || '') : '' });
  } catch (e) {
    console.error(`[guide] AI提示词读取失败:`, e.message);
    res.json({ aiPrompt: '' });
  }
});

/**
 * GET /api/guide/all-forms?project=X&chapter=Y — 一次读取某章节全部表单数据（含样本/成果/提示词）
 * 用于初始化加载，减少请求数
 */
router.get('/all-forms', requireAuth, (req, res) => {
  const { project, chapter } = req.query;
  if (!project || !chapter) return res.status(400).json({ error: '缺少参数' });
  try {
    const rows = getDb().prepare('SELECT form_code, content, sample_files, artifacts, ai_prompt FROM guide_forms WHERE project_name=? AND chapter_id=?').all(project, chapter);
    const result = {};
    rows.forEach(r => {
      result[r.form_code] = {
        content: r.content || '',
        sampleFiles: (() => { try { return JSON.parse(r.sample_files || '[]'); } catch { return []; } })(),
        artifacts: (() => { try { return JSON.parse(r.artifacts || '[]'); } catch { return []; } })(),
        aiPrompt: r.ai_prompt || '',
      };
    });
    res.json({ forms: result });
  } catch (e) {
    console.error(`[guide] 全表单读取失败:`, e.message);
    res.json({ forms: {} });
  }
});

export default router;
