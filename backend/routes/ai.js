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

export default router;
