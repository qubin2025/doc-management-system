/**
 * RAGFlow 知识库引擎代理
 * 后端代理 RAGFlow API，统一认证 + 文档管理 + 检索 + 对话
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// 注意：ESM 模块中 import 会在 dotenv.config() 之前执行，
// 因此不能在模块级读取 process.env，必须在函数内动态读取
function getRagflowConfig() {
  return {
    base: process.env.RAGFLOW_URL || 'http://localhost:9380',
    key: process.env.RAGFLOW_API_KEY || '',
  };
}

// 通用代理函数
async function ragflowProxy(method, path, body, res) {
  try {
    const { base, key } = getRagflowConfig();
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const resp = await fetch(`${base}${path}`, opts);
    const data = await resp.json().catch(() => ({ raw: resp.statusText }));
    res.status(resp.status).json(data);
  } catch (e) {
    // RAGFlow 未部署时降级
    res.json({ available: false, message: 'RAGFlow 知识库引擎未部署，请执行 docker compose -f services/ragflow/docker-compose.yml up -d' });
  }
}

// GET /api/ragflow/health — 检查 RAGFlow 可用性
router.get('/health', requireAuth, async (req, res) => {
  try {
    const { base } = getRagflowConfig();
    const resp = await fetch(`${base}/api/v1/version`);
    if (resp.ok) {
      const data = await resp.json();
      return res.json({ available: true, version: data?.version || 'unknown' });
    }
    res.json({ available: false });
  } catch {
    res.json({ available: false, message: 'RAGFlow 未部署' });
  }
});

// POST /api/ragflow/datasets — 创建知识库
router.post('/datasets', requireAuth, (req, res) =>
  ragflowProxy('POST', '/api/v1/datasets', req.body, res)
);

// GET /api/ragflow/datasets — 列出知识库
router.get('/datasets', requireAuth, (req, res) =>
  ragflowProxy('GET', '/api/v1/datasets', null, res)
);

// POST /api/ragflow/datasets/:id/documents — 上传文档到知识库
router.post('/datasets/:id/documents', requireAuth, (req, res) =>
  ragflowProxy('POST', `/api/v1/datasets/${req.params.id}/documents`, req.body, res)
);

// POST /api/ragflow/retrieval — RAG检索
router.post('/retrieval', requireAuth, (req, res) =>
  ragflowProxy('POST', '/api/v1/retrieval', req.body, res)
);

// POST /api/ragflow/chats — 知识库对话
router.post('/chats', requireAuth, (req, res) =>
  ragflowProxy('POST', '/api/v1/chats', req.body, res)
);

// POST /api/ragflow/chats/:id/completions — 对话补全
router.post('/chats/:id/completions', requireAuth, (req, res) =>
  ragflowProxy('POST', `/api/v1/chats/${req.params.id}/completions`, req.body, res)
);

export default router;
