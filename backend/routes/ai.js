import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { sanitizeText } from '../utils/sanitize.js';
import { getDb } from '../db.js';
import { MODEL_SYSTEM_PROMPTS, DEFAULT_SYSTEM_PROMPT, FILE_UNDERSTANDING_PROMPT, IMAGE_UNDERSTANDING_PROMPT } from '../config/aiPrompts.js';
import { SAFETY_CHECKLIST, VISION_SAFETY_PROMPT } from '../config/safetyChecklist.js';

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
  },
  'deepseek-v4-pro': {
    name: 'DeepSeek-V4 Pro',
    endpoint: 'https://api.deepseek.com/chat/completions',
    key: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  },
  'deepseek-r1': {
    name: 'DeepSeek-R1',
    endpoint: 'https://api.deepseek.com/chat/completions',
    key: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-reasoner',
  },
  'qwen-turbo': {
    name: '通义千问(云端)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    key: process.env.QWEN_API_KEY,
    model: 'qwen-plus',
  },
  'glm-4-flash': {
    name: '智谱GLM-4',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: process.env.ZHIPU_API_KEY,
    model: 'glm-4-flash',
  },
  'glm-4v': {
    name: '智谱GLM-4V(视觉)',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: process.env.ZHIPU_API_KEY,
    model: 'glm-4v',
    vision: true,
  },
  'glm-4-plus': {
    name: '智谱GLM-4 Plus',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: process.env.ZHIPU_API_KEY,
    model: 'glm-4-plus',
  },
  'ollama-qwen': {
    name: 'Ollama通义(本地)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    key: 'ollama',
    model: 'qwen2.5:7b',
  },
  'ollama-llama': {
    name: 'Ollama Llama3(本地)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    key: 'ollama',
    model: 'llama3.1:8b',
  },
};

// GET /api/ai/models — 列出可用模型
router.get('/models', requireAuth, (req, res) => {
  const available = Object.entries(MODELS).map(([id, cfg]) => {
    let status = 'unknown';
    if (id.startsWith('deepseek')) status = cfg.key && !cfg.key.includes('your-') ? 'online' : 'offline';
    else if (id === 'qwen-turbo') status = cfg.key && !cfg.key.includes('your-') ? 'online' : 'offline';
    else if (id.startsWith('glm-4')) status = cfg.key && !cfg.key.includes('your-') ? 'online' : 'offline';
    else if (id.startsWith('ollama')) status = 'optional';
    return { id, name: cfg.name, status };
  });
  res.json({ models: available });
});

// POST /api/ai/vision-safety — 工地安全巡检（照片→安全标准对标）
router.post('/vision-safety', requireAuth, requirePermission('can_use_ai'), async (req, res) => {
  const { imageBase64, projectName, checklistIds } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '缺少图片数据' });

  const glmVisionRes = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4v',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: VISION_SAFETY_PROMPT.replace('{checklist}',
            (checklistIds?.length ? SAFETY_CHECKLIST.filter(c => checklistIds.includes(c.id)) : SAFETY_CHECKLIST)
              .map(c => `- [${c.id}] ${c.item} (${c.standard}): ${c.check}`).join('\n')
          )},
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!glmVisionRes.ok) {
    return res.status(502).json({ error: `GLM-4V调用失败: HTTP ${glmVisionRes.status}` });
  }
  const data = await glmVisionRes.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 尝试解析JSON输出
  try {
    const json = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    return res.json({ ok: true, model: 'glm-4v', report: json });
  } catch {
    return res.json({ ok: true, model: 'glm-4v', report: { summary: content.slice(0, 200), raw: content } });
  }
});

// POST /api/ai/chat
router.post('/chat', requireAuth, requirePermission('can_use_ai'), async (req, res) => {
  if (!checkRate(req.user?.id)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后' });
  }

  const { messages, context, projectName, standard, model: reqModel, files, folderPath, images } = req.body;
  const requestedModel = reqModel || 'deepseek-chat';

  // 诊断日志: 记录接收到的图片数据
  const bodySize = JSON.stringify(req.body).length;
  const imgCount = (images && Array.isArray(images)) ? images.length : 0;
  console.log(`[IMAGE-IN] model=${requestedModel} body=${(bodySize/1024/1024).toFixed(1)}MB images=${imgCount} sizes=[${images?.map(i=>i?.slice(0,30)||'empty').join(',')}]`);

  // Build system prompt from config
  const systemPrompt = MODEL_SYSTEM_PROMPTS[requestedModel] || DEFAULT_SYSTEM_PROMPT;

  // Project context
  const projectCtx = projectName ? `当前项目: ${projectName}\n${buildProjectContext(projectName, standard) || ''}` : '';

  // File upload content
  let uploadedContent = '';
  if (files && Array.isArray(files) && files.length > 0) {
    uploadedContent = files.map((f, i) => `${i + 1}. 文件名: ${f.name || '未命名'}\n内容: ${sanitizeText(f.content || '').slice(0, 8000)}`).join('\n\n');
  }

  // Image detection in messages + request images
  let hasImage = false;
  let imageText = '';
  let reqImages = images && Array.isArray(images) ? images : [];
  if (messages && Array.isArray(messages)) {
    hasImage = messages.some(m => m.content?.includes('[图片:') || m.content?.includes('data:image'));
  }
  if (reqImages.length > 0) hasImage = true;

  // 图片预处理: 调用EasyOCR提取文字(文本型模型也能理解图片)
  if (hasImage) {
    try {
      const ocrRes = await fetch('http://localhost:8001/api/parse/document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: (messages.find(m => m.content?.includes('data:image'))?.content || '').replace(/data:image\/\w+;base64,/, ''),
          filename: 'chat-upload.png',
          mime_type: 'image/png',
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (ocrRes.ok) {
        const ocrData = await ocrRes.json();
        if (ocrData.ok && ocrData.text?.trim()) {
          imageText = `\n[图片OCR识别结果]:\n${ocrData.text.slice(0, 3000)}\n[请基于以上识别内容回答]`;
        }
      }
    } catch { /* OCR不可用,降级为告知用户 */ }
  }

  // Build final system prompt with context substitution
  const finalSystemPrompt = systemPrompt
    .replace('{projectContext}', projectCtx ? `项目信息:\n${projectCtx}` : '')
    .replace('{uploadedContent}', uploadedContent ? `\n用户上传的文件:\n${uploadedContent}` : '')
    + (imageText ? imageText : (hasImage ? '\n用户上传了一张图片，已自动识别其中的文字内容。' : ''));

  const ctxMsgs = [{ role: 'system', content: finalSystemPrompt }];
  const userMsgs = (messages && Array.isArray(messages)) ? messages.map(m => ({ role: m.role, content: sanitizeText(m.content) })) : [];

  // Try requested model, fallback to offline if all fail
  tryChat(requestedModel, ctxMsgs, userMsgs, reqImages)
    .then(reply => res.json({ reply, model: requestedModel }))
    .catch(async e1 => {
      // 如果不是auto且primary失败, 尝试auto
      if (requestedModel !== 'auto') {
        try {
          const reply = await tryChat('auto', ctxMsgs, userMsgs, reqImages);
          return res.json({ reply, model: 'auto', note: `自动降级，原模型不可用: ${e1.message?.slice(0,60)}` });
        } catch (e2) {
          return res.status(500).json({ error: `AI调用失败: ${e1.message?.slice(0,80)}` });
        }
      }
      res.status(500).json({ error: `AI不可用: ${e1.message?.slice(0,80)}` });
    });
});

async function tryChat(modelId, ctxMsgs, userMsgs, reqImages = []) {
  // auto模式: 智能路由 — 有图片优先视觉模型,无图片优先文本模型
  const hasPics = reqImages.length > 0 || userMsgs.some(m => m.content?.includes('[图片:'));
  const candidates = modelId === 'auto'
    ? (hasPics
        ? ['glm-4v', 'qwen-turbo', 'deepseek-v4-pro', 'deepseek-chat']  // 有图片: 视觉优先
        : ['deepseek-v4-pro', 'deepseek-chat', 'deepseek-r1', 'qwen-turbo', 'glm-4-plus', 'glm-4-flash'])  // 无图片: 文本优先
    : [modelId];

  for (const mid of candidates) {
    const cfg = MODELS[mid];
    if (!cfg) continue;
    if (mid.startsWith('deepseek') && !cfg.key) continue;

    try {
      let msgs = [...ctxMsgs];

      // 视觉模型: 直接构建user消息(不带system前缀, GLM-4V已验证)
      if (cfg.vision) {
        const parts = [];
        let userText = '';
        for (const msg of userMsgs) {
          if (msg.role === 'user') userText += (userText ? '\n' : '') + msg.content;
        }
        if (userText) parts.push({ type: 'text', text: userText });
        const validImages = (reqImages || []).filter(img => img && (img.startsWith('data:image') || img.startsWith('http')));
        for (const img of validImages) parts.push({ type: 'image_url', image_url: { url: img } });
        if (validImages.length > 0) {
          msgs = [{ role: 'user', content: parts }]; // 仅发送user消息(已验证格式)
        } else {
          msgs.push(...userMsgs);
        }
      } else {
        msgs.push(...userMsgs);
      }
      const body = {
        model: cfg.model || 'deepseek-chat',
        messages: msgs,
        max_tokens: cfg.vision ? 2048 : 4096,  // GLM-4V限制2048
        temperature: 0.3,
      };

      const resp = await fetch(cfg.endpoint, {
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
