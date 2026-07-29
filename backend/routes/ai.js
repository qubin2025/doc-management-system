import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { sanitizeText, summarizePrompt, estimateCost } from '../utils/sanitize.js';
import { getDb } from '../db.js';

const router = Router();

// ── GraphRAG 图检索（轻量集成，直接复用 kg.js 的 Neo4j 连接） ──
let _neo4jMod = null;
let _kgDriver = null;
let _kgInitPromise = null;

async function _ensureKgDriver() {
  if (_kgDriver) return;
  if (_kgInitPromise) return _kgInitPromise;
  _kgInitPromise = (async () => {
    try {
      _neo4jMod = await import('neo4j-driver');
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
      _kgDriver = _neo4jMod.default.driver(uri, _neo4jMod.default.auth.basic(user, pwd), {
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 5,
      });
      const s = _kgDriver.session();
      try { await s.run('RETURN 1'); } finally { await s.close(); }
    } catch {
      _kgDriver = null;
    } finally {
      _kgInitPromise = null;
    }
  })();
  return _kgInitPromise;
}

function _kgInt(n) {
  if (_neo4jMod?.default?.int) return _neo4jMod.default.int(n);
  return Math.floor(n);
}

/**
 * 从 Neo4j 知识图谱中检索与关键词相关的上下文（用于注入 AI prompt）
 * @returns {string} 格式化文本，若 Neo4j 不可用返回空字符串
 */
async function fetchGraphRAGContext(keyword, depth = 2) {
  await _ensureKgDriver();
  if (!_kgDriver) return '';
  const session = _kgDriver.session();
  try {
    // 种子节点匹配
    const seedR = await session.run(
      'MATCH (n:Node) WHERE n.label CONTAINS $kw RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props ORDER BY n.label LIMIT $limit',
      { kw: keyword, limit: _kgInt(10) }
    );
    const seeds = seedR.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));
    if (seeds.length === 0) return '';

    // 获取所有边
    const edgeR = await session.run('MATCH (a:Node)-[r]->(b:Node) RETURN a.id AS from, b.id AS to, type(r) AS type, r.label AS label');
    const edges = edgeR.records.map(r => ({
      from: r.get('from'), to: r.get('to'), type: r.get('type'), label: r.get('label') || ''
    }));

    // BFS 图遍历
    const adj = new Map();
    for (const e of edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from).push(e.to);
      adj.get(e.to).push(e.from);
    }
    const visited = new Set(seeds.map(s => s.id));
    let frontier = [...visited];
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const id of frontier) {
        for (const nb of (adj.get(id) || [])) {
          if (!visited.has(nb)) { visited.add(nb); next.push(nb); }
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }

    // 获取子图节点
    const nodeR = await session.run(
      'MATCH (n:Node) WHERE n.id IN $ids RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props',
      { ids: [...visited] }
    );
    const nodes = nodeR.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));

    // 格式化上下文
    const seedIds = new Set(seeds.map(s => s.id));
    const lines = ['【知识图谱关联上下文 — 以下标准/规范条款与当前审查内容相关，请参考】'];
    for (const n of nodes) {
      let props = {};
      try { if (n.props) props = typeof n.props === 'object' ? n.props : JSON.parse(n.props); } catch {}
      const mark = seedIds.has(n.id) ? '★' : '·';
      const desc = props.description || props.summary || '';
      const std = props.standard ? `[${props.standard}]` : '';
      lines.push(`${mark} [${n.type}] ${std} ${n.label}${desc ? ' — ' + desc : ''}`);
    }

    // 关联关系
    const subEdges = edges.filter(e => visited.has(e.from) && visited.has(e.to));
    if (subEdges.length > 0 && subEdges.length <= 20) {
      lines.push('');
      lines.push('【关联关系】');
      for (const e of subEdges) {
        const fn = nodes.find(n => n.id === e.from);
        const tn = nodes.find(n => n.id === e.to);
        lines.push(`${fn?.label || e.from} → ${e.type} → ${tn?.label || e.to}`);
      }
    }
    return lines.join('\n');
  } catch (e) {
    console.warn('[GraphRAG] 检索失败:', e.message);
    return '';
  } finally {
    await session.close();
  }
}

/**
 * 从消息中提取审查关键词（用于 GraphRAG 检索）
 */
function extractReviewKeywords(messages) {
  if (!messages?.length) return null;
  const fullText = messages.map(m => m.content || '').join(' ');
  // 检测审查意图
  const reviewPatterns = [
    { re: /(施工.*审查|施工.*方案|施工组织设计)/i, kw: '施工质量' },
    { re: /(合同.*审查|合同.*条款|合同.*风险)/i, kw: '合同管理' },
    { re: /(招标.*审查|投标.*审查|招投标)/i, kw: '造价管理' },
    { re: /(安全.*检查|安全.*管理|安全.*措施)/i, kw: '施工安全' },
    { re: /(质量.*验收|质量.*检查|质量.*控制)/i, kw: '施工质量' },
    { re: /(监理.*规划|监理.*细则|监理.*报告)/i, kw: '监理管理' },
    { re: /(资料.*管理|资料.*归档|资料.*整理)/i, kw: '资料管理' },
    { re: /(混凝土|钢筋|模板|结构)/i, kw: '混凝土' },
  ];
  for (const { re, kw } of reviewPatterns) {
    if (re.test(fullText)) return kw;
  }
  // 未匹配到特定关键词，尝试提取通用术语
  const keywords = ['施工', '安全', '质量', '验收', '合同', '监理', '招标', '投标', '造价', '工期', '变更', '索赔'];
  const found = keywords.filter(k => fullText.includes(k));
  return found.length > 0 ? found.slice(0, 3).join(' ') : null;
}

import { checkRate, trackUsage } from '../lib/ratelimit.js';

function buildProjectContext(projectName, standard) {
  if (!projectName) return '';
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName);
  if (!project) return '';
  const docs = db.prepare('SELECT filename FROM documents WHERE project_id = ? ORDER BY id DESC LIMIT 10').all(project.id);
  return docs.map(d => d.filename).join(', ');
}

// ========== 模型配置（延迟加载，确保dotenv已执行） ==========
function getModels() { return {
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
}; }

// GET /api/ai/models — 列出可用模型（含真实探测）
router.get('/models', requireAuth, async (req, res) => {
  // 探测本地Ollama
  let ollamaOnline = false;
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    ollamaOnline = r.ok;
  } catch {}

  const available = Object.entries(getModels()).map(([id, cfg]) => {
    let status = 'unknown';
    const hasKey = (k) => k && !k.includes('your-') && k.length > 20;
    if (id.startsWith('deepseek')) status = hasKey(cfg.key) ? 'online' : 'offline';
    else if (id === 'qwen-turbo') status = hasKey(cfg.key) ? 'online' : 'offline';
    else if (id === 'glm-4-flash') status = hasKey(cfg.key) ? 'online' : 'offline';
    else if (id.startsWith('ollama')) status = ollamaOnline ? 'online' : 'offline';
    return { id, name: cfg.name, status };
  });
  res.json({ models: available });
});

// POST /api/ai/vision — 后端代理视觉模型（GLM-4V/千问VL）
router.post('/vision', requireAuth, requirePermission('can_use_ai'), async (req, res) => {
  const { image, prompt, model: vModel } = req.body;
  if (!image || !prompt) return res.status(400).json({ error: '缺少 image 或 prompt' });

  const preferredModel = vModel || 'glm-4v';
  const candidates = preferredModel === 'auto'
    ? ['glm-4v', 'qwen-vl-max']
    : [preferredModel, ...(preferredModel === 'glm-4v' ? ['qwen-vl-max'] : ['glm-4v'])];

  for (const m of candidates) {
    const key = m === 'glm-4v' ? process.env.ZHIPU_API_KEY : process.env.QWEN_API_KEY;
    const endpoint = m === 'glm-4v'
      ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
      : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    const modelId = m === 'glm-4v' ? 'glm-4v' : 'qwen-vl-max';
    if (!key) continue;

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: modelId,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } },
            ],
          }],
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (resp.ok) {
        const d = await resp.json();
        const reply = d.choices?.[0]?.message?.content || '';
        if (reply) return res.json({ reply, model: m });
      }
    } catch (e) { /* next candidate */ }
  }
  res.status(500).json({ error: '视觉模型调用失败，所有可用模型均不可达' });
});

// POST /api/ai/chat
router.post('/chat', requireAuth, requirePermission('can_use_ai'), async (req, res) => {
  if (!checkRate(req.user?.id)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后' });
  }

  const { messages, context, projectName, standard, model: reqModel } = req.body;
  // 自动检测图片 → 切换为视觉模型
  const hasImage = messages?.some(m => m.content?.includes('[图片:') || m.content?.includes('data:image/') || m.content?.includes('图像识别'));
  let requestedModel = reqModel || 'deepseek-chat';
  if (hasImage && (requestedModel === 'auto' || requestedModel === 'deepseek-chat')) {
    requestedModel = 'deepseek-v4-pro';
    console.log('[AI] 检测到图片内容，自动切换为视觉模型 deepseek-v4-pro');
  }

  // Build context msgs
  const ctxMsgs = [];
  const ctx = projectName ? buildProjectContext(projectName, standard) : (context || '');
  if (ctx) {
    ctxMsgs.push({ role: 'system', content: `当前项目资料信息：\n${sanitizeText(ctx)}` });
  }

  // GraphRAG 审查增强：检测审查意图，注入知识图谱关联标准条款
  const reviewKw = extractReviewKeywords(messages);
  if (reviewKw) {
    try {
      const kgContext = await fetchGraphRAGContext(reviewKw);
      if (kgContext) {
        ctxMsgs.push({ role: 'system', content: kgContext });
        logger.info(`[GraphRAG] 审查增强已激活，关键词: ${reviewKw}`);
      }
    } catch (e) {
      // GraphRAG 不可用不影响主流程
      console.warn(`[GraphRAG] 增强跳过: ${e.message}`);
    }
  }

  const userMsgs = (messages && Array.isArray(messages)) ? messages.map(m => ({ role: m.role, content: sanitizeText(m.content) })) : [];

  // Try requested model, fallback to offline if all fail
  tryChat(requestedModel, ctxMsgs, userMsgs)
    .then(reply => {
      const promptLen = req.body.messages?.reduce((s, m) => s + (m.content?.length || 0), 0) || 0;
      trackUsage(req.user?.username || 'unknown', promptLen, requestedModel);
      const cost = estimateCost(promptLen, requestedModel);
      res.json({ reply, model: requestedModel, cost });
    })
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
    const cfg = getModels()[mid];
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
