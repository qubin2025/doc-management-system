import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { sanitizeText } from '../utils/sanitize.js';
import { getDb } from '../db.js';

const router = Router();
const DEEPSEEK_BASE = 'https://api.deepseek.com';

// 简单内存限流
const rateMap = new Map();
const RATE_LIMIT = 20;       // 每分钟20次
const RATE_WINDOW = 60000;   // 1分钟

function checkRate(userId) {
  const now = Date.now();
  const record = rateMap.get(userId);
  if (!record || now - record.windowStart > RATE_WINDOW) {
    rateMap.set(userId, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// 构建项目上下文
function buildProjectContext(projectName, standard) {
  if (!projectName) return '';
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName);
  if (!project) return '';

  let query = 'SELECT doc_id, file_name, uploader, upload_time, version FROM documents WHERE project_id = ?';
  const params = [project.id];
  if (standard) { query += ' AND standard = ?'; params.push(standard); }
  query += ' ORDER BY doc_id, upload_time DESC LIMIT 100';

  const docs = db.prepare(query).all(...params);
  if (docs.length === 0) return `当前项目"${projectName}"暂无上传资料。`;

  let ctx = `当前项目"${projectName}"共有 ${docs.length} 条文档记录。\n`;
  ctx += '文档列表：\n';
  for (const d of docs) {
    ctx += `  [${d.doc_id}] ${d.file_name} (上传者:${d.uploader}, 版本:${d.version}, 时间:${d.upload_time})\n`;
  }
  return sanitizeText(ctx);
}

// AI 聊天
router.post('/chat', requirePermission('can_use_ai'), async (req, res) => {
  const { messages, context, projectName, standard } = req.body;

  if (!req.user.permissions?.can_use_ai) {
    return res.status(403).json({ error: 'AI 功能未授权' });
  }

  if (!checkRate(req.user.id)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后重试' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI 服务未配置' });
  }

  // 构建消息列表
  const msgs = [
    { role: 'system', content: '你是一个全过程工程咨询管理平台的AI助手。你帮助用户分析工程资料、项目进展、施工质量管理等。回答专业、简洁、准确。' },
  ];

  // 加入项目上下文
  const ctx = projectName ? buildProjectContext(projectName, standard) : (context || '');
  if (ctx) {
    msgs.push({ role: 'system', content: `当前项目资料信息：\n${sanitizeText(ctx)}` });
  }

  // 用户历史消息
  if (messages && Array.isArray(messages)) {
    msgs.push(...messages.map(m => ({ role: m.role, content: sanitizeText(m.content) })));
  }

  try {
    const resp = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: msgs,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('DeepSeek API error:', data);
      return res.status(502).json({ error: 'AI 服务异常：' + (data.error?.message || resp.status) });
    }

    const reply = data.choices?.[0]?.message?.content || '(无回复)';
    res.json({ reply });
  } catch (e) {
    if (e.name === 'TimeoutError') {
      res.status(504).json({ error: 'AI 响应超时' });
    } else {
      res.status(500).json({ error: 'AI 请求失败：' + e.message });
    }
  }
});

// Embedding 向量化代理（通义 text-embedding-v1）
router.post('/embed', requirePermission('can_use_ai'), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '缺少text参数' });
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Embedding服务未配置' });

  try {
    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'text-embedding-v1', input: { texts: [text] }, parameters: { text_type: 'document' } }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: 'Embedding API错误: ' + JSON.stringify(data) });
    res.json({ embedding: data.output?.embeddings?.[0]?.embedding || [] });
  } catch (e) {
    res.status(500).json({ error: 'Embedding请求失败: ' + e.message });
  }
});

// 视觉模型代理（GLM-4V）
router.post('/vision', requirePermission('can_use_ai'), async (req, res) => {
  const { messages, images } = req.body;
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) return res.status(503).json({ error: '视觉模型未配置' });

  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'glm-4v', messages, temperature: 0.7, max_tokens: 2000 }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: '视觉模型错误' });
    res.json({ reply: data.choices?.[0]?.message?.content || '' });
  } catch (e) {
    res.status(500).json({ error: '视觉模型请求失败: ' + e.message });
  }
});

// 表单填写代理
router.post('/fill-form', requirePermission('can_use_ai'), async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: '缺少prompt参数' });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI服务未配置' });

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2000 }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: 'AI服务异常' });
    res.json({ reply: data.choices?.[0]?.message?.content || '' });
  } catch (e) {
    res.status(500).json({ error: '表单填写请求失败: ' + e.message });
  }
});

export default router;
