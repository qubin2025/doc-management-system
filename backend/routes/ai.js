import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { sanitizeText } from '../utils/sanitize.js';
import { getDb } from '../db.js';

const router = Router();

// 简单内存限流
const rateMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60000;

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

function buildProjectContext(projectName, standard) {
  if (!projectName) return '';
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName);
  if (!project) return '';
  const docs = db.prepare('SELECT filename FROM documents WHERE project_id = ? ORDER BY id DESC LIMIT 10').all(project.id);
  return docs.map(d => d.filename).join(', ');
}

// ========== 模型配置 ==========
const MODELS = {
  'deepseek-chat': {
    name: 'DeepSeek-V3',
    endpoint: 'https://api.deepseek.com/chat/completions',
    key: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    system: '你是全过程工程咨询管理平台的AI助手，回答专业、简洁、准确。',
  },
  'deepseek-v4-pro': {
    name: 'DeepSeek-V4 Pro',
    endpoint: 'https://api.deepseek.com/chat/completions',
    key: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    system: '你是全过程工程咨询管理平台的AI专家助手。你具备高级图文理解能力，可以精准分析工程图纸、施工照片、合同扫描件等图片内容。回答专业、深入、准确。',
    vision: true,
  },
  'deepseek-r1': {
    name: 'DeepSeek-R1',
    endpoint: 'https://api.deepseek.com/chat/completions',
    key: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-reasoner',
    system: '你是全过程工程咨询管理平台的AI助手，推理严谨、分析深入。',
  },
  'qwen-turbo': {
    name: '通义千问(云端)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    key: process.env.QWEN_API_KEY,
    model: 'qwen-plus',
    system: '你是全过程工程咨询管理平台的AI助手。',
  },
  'glm-4-flash': {
    name: '智谱GLM-4',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: process.env.ZHIPU_API_KEY,
    model: 'glm-4-flash',
    system: '你是全过程工程咨询管理平台的AI助手。',
  },
  'ollama-qwen': {
    name: 'Ollama通义(本地)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    key: 'ollama',
    model: 'qwen2.5:7b',
    system: '你是全过程工程咨询管理平台的AI助手。',
  },
  'ollama-llama': {
    name: 'Ollama Llama3(本地)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    key: 'ollama',
    model: 'llama3.1:8b',
    system: '你是全过程工程咨询管理平台的AI助手。',
  },
};

// GET /api/ai/models — 列出可用模型
router.get('/models', requireAuth, (req, res) => {
  const available = Object.entries(MODELS).map(([id, cfg]) => {
    let status = 'unknown';
    const hasKey = (k) => k && !k.includes('your-') && k.length > 20;
    if (id.startsWith('deepseek')) status = hasKey(cfg.key) ? 'online' : 'offline';
    else if (id === 'qwen-turbo') status = cfg.key && !cfg.key.includes('your-') ? 'online' : 'offline';
    else if (id === 'glm-4-flash') status = cfg.key && !cfg.key.includes('your-') ? 'online' : 'offline';
    else if (id.startsWith('ollama')) status = 'optional';
    return { id, name: cfg.name, status };
  });
  res.json({ models: available });
});

// POST /api/ai/chat
router.post('/chat', requireAuth, requirePermission('can_use_ai'), (req, res) => {
  if (!checkRate(req.user?.id)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后' });
  }

  const { messages, context, projectName, standard, model: reqModel } = req.body;
  // 自动检测图片 → 切换为视觉模型
  const hasImage = messages?.some(m => m.content?.includes('[图片:') || m.content?.includes('data:image/') || m.content?.includes('图像识别'));
  let requestedModel = reqModel || 'deepseek-chat';
  if (hasImage && (requestedModel === 'auto' || requestedModel === 'deepseek-chat')) {
    requestedModel = 'deepseek-v4-pro';
    logger.info('检测到图片内容，自动切换为视觉模型 deepseek-v4-pro');
  }

  // Build context msgs
  const ctxMsgs = [];
  const ctx = projectName ? buildProjectContext(projectName, standard) : (context || '');
  if (ctx) {
    ctxMsgs.push({ role: 'system', content: `当前项目资料信息：\n${sanitizeText(ctx)}` });
  }
  const userMsgs = (messages && Array.isArray(messages)) ? messages.map(m => ({ role: m.role, content: sanitizeText(m.content) })) : [];

  // Try requested model, fallback to offline if all fail
  tryChat(requestedModel, ctxMsgs, userMsgs)
    .then(reply => res.json({ reply, model: requestedModel }))
    .catch(async e1 => {
      // 如果不是auto且primary失败, 尝试auto
      if (requestedModel !== 'auto') {
        try {
          const reply = await tryChat('auto', ctxMsgs, userMsgs);
          return res.json({ reply, model: 'auto', note: `自动降级，原模型不可用: ${e1.message?.slice(0,60)}` });
        } catch (e2) {
          return res.status(500).json({ error: `AI调用失败: ${e1.message?.slice(0,80)}` });
        }
      }
      res.status(500).json({ error: `AI不可用: ${e1.message?.slice(0,80)}` });
    });
});

async function tryChat(modelId, ctxMsgs, userMsgs) {
  // auto模式: 按优先级 DeepSeek->DeepSeekR1->OllamaQwen->OllamaLlama
  const candidates = modelId === 'auto'
    ? ['deepseek-v4-pro', 'deepseek-chat', 'deepseek-r1', 'qwen-turbo', 'glm-4-flash', 'ollama-qwen', 'ollama-llama']
    : [modelId];

  for (const mid of candidates) {
    const cfg = MODELS[mid];
    if (!cfg) continue;
    if (mid.startsWith('deepseek') && !cfg.key) continue;

    try {
      const msgs = [
        { role: 'system', content: cfg.system },
        ...ctxMsgs,
        ...userMsgs,
      ];
      const body = {
        model: cfg.model || 'deepseek-chat',
        messages: msgs,
        max_tokens: 4096,
        temperature: 0.3,
      };

      const resp = await fetch(cfg.endpoint + '?t=' + Date.now(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.key}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (!resp.ok) {
        const err = await resp.text().catch(() => '');
        throw new Error(`${mid} HTTP ${resp.status}: ${err.slice(0, 80)}`);
      }
      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content || '';
      if (!reply) throw new Error(`${mid} 返回空内容`);
      return reply;
    } catch (e) {
      // Continue to next candidate
      if (modelId !== 'auto') throw e;
    }
  }
  throw new Error('所有模型均不可用');
}

export default router;
