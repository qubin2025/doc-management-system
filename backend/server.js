import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// 简单内存缓存 (60s TTL, 用于高频只读API)
const apiCache = new Map();
function cacheMiddleware(ttlMs = 60000) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = req.originalUrl;
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.time < ttlMs) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      apiCache.set(key, { data, time: Date.now() });
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    next();
  };
}
import { getDb } from './db.js';
import projectsRouter from './routes/projects.js';
import documentsRouter from './routes/documents.js';
import authRouter from './routes/auth.js';
import importRouter from './routes/import.js';
import backupRouter from './routes/backup.js';
import aiRouter from './routes/ai.js';
import aiAdminRouter from './routes/ai_admin.js';
import kgRouter from './routes/kg.js';
import kgGraphragRouter from './routes/kg_graphrag.js';
import ragflowRouter from './routes/ragflow.js';
import objectivesRouter from './routes/objectives.js';
import mcpRouter from './routes/mcp.js';
import baselinesRouter from './routes/baselines.js';
import auditRouter from './routes/audit.js';
import exportRouter from './routes/export.js';
import syncRouter from './routes/sync.js';
import mobileRouter from './routes/mobile.js';
import dataRouter from './routes/data.js';
import experienceRouter from './routes/experience.js';
import contractsRouter from './routes/contracts.js';
import guideRouter from './routes/guide.js';
import stakeholdersRouter from './routes/stakeholders.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN;

// 安全头（生产环境全面启用）
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// CORS — 生产白名单，开发全开
app.use(cors(isProduction ? {
  origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : false,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400,
} : { origin: true, credentials: true }));

app.use(morgan(isProduction ? 'combined' : 'short'));
app.use(express.json({ limit: isProduction ? '10mb' : '100mb' }));

// 认证端点限流（防暴力破解：每分钟5次）
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '登录尝试过于频繁，请1分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 请求错误日志
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const ms = Date.now() - start;
    if (_res.statusCode >= 400) {
      console.warn(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${_res.statusCode} (${ms}ms)`);
    }
  });
  next();
});

// 全局限流 — 生产环境更严格
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 100 : 500,
  message: { error: '请求过于频繁，请稍后重试' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Initialize database
getDb();

// 生产模式：静态文件 + PWA 入口
import { existsSync } from 'fs';
const distPath = resolve(__dirname, '..', 'dist');
if (isProduction && existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '7d' }));
  // /mobile → mobile.html（PWA 入口）
  app.get('/mobile', (_req, res) => res.sendFile(resolve(distPath, 'mobile.html')));
}

// 健康检查端点
app.get('/api/health', async (_req, res) => {
  const services = { db: false, neo4j: false, ragflow: false, ai: false };
  try { const { getDb } = await import('./db.js'); getDb().prepare('SELECT 1').get(); services.db = true; } catch {}
  try { const r = await fetch('http://localhost:7474', { signal: AbortSignal.timeout(2000) }); services.neo4j = r.ok; } catch {}
  try { const r = await fetch('http://localhost:9380/api/v1/version', { signal: AbortSignal.timeout(2000) }); services.ragflow = r.ok; } catch {}
  services.ai = !!process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-');
  const allOk = Object.values(services).every(Boolean);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    version: '5.1.0',
    uptime: process.uptime(),
    services,
    timestamp: new Date().toISOString(),
  });
});

// Routes — 高频只读路由添加60s缓存
app.use('/api/projects', cacheMiddleware(60000), projectsRouter);
app.use('/api/kg', cacheMiddleware(30000), kgRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/import', importRouter);
app.use('/api/backup', backupRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai', aiAdminRouter);
app.use('/api/kg', kgRouter);
app.use('/api/kg', kgGraphragRouter);
app.use('/api/ragflow', ragflowRouter);
app.use('/api/objectives', objectivesRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/baselines', baselinesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/export', exportRouter);
app.use('/api/sync', syncRouter);
app.use('/api/mobile', mobileRouter);
app.use('/api/data', dataRouter);
app.use('/api/experience', experienceRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/guide', guideRouter);
app.use('/api/stakeholders', stakeholdersRouter);
app.use('/api/admin', adminRouter);

// Health check（无需登录）
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: '工程资料管理系统 API', version: '1.7.0', uptime: process.uptime() });
});

// 系统统计（管理员可见）
app.get('/api/stats', async (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const documents = db.prepare('SELECT COUNT(*) as c FROM documents').get().c;
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const activeUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active=1').get().c;
    let objectives = 0, baselines = 0, artifacts = 0, auditLogs = 0;
    try {
      objectives = db.prepare('SELECT COUNT(*) as c FROM objectives').get().c;
      baselines = db.prepare('SELECT COUNT(*) as c FROM baselines').get().c;
      artifacts = db.prepare('SELECT COUNT(*) as c FROM knowledge_artifacts').get().c;
      auditLogs = db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c;
    } catch { /* 新表可能尚未创建 */ }

    // 服务健康检查（并发探测）
    const health = {
      // AI模型
      deepseek: !!(process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-')),
      qwen: !!(process.env.QWEN_API_KEY && !process.env.QWEN_API_KEY.includes('your-')),
      zhipu: !!(process.env.ZHIPU_API_KEY && !process.env.ZHIPU_API_KEY.includes('your-')),
      dashscope: !!(process.env.DASHSCOPE_API_KEY && !process.env.DASHSCOPE_API_KEY.includes('your-')),
      // 基础设施
      neo4j: false,
      ragflow: false,
      paddleocr: false,
      lightrag: false,
    };

    // 并发探测外部服务（2秒超时）
    const probe = async (url) => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(url, { signal: ctrl.signal });
        return r.ok;
      } catch { return false; }
    };

    const [rf, po, lr, n4j] = await Promise.all([
      probe('http://localhost:9380/api/v1/version'),
      probe('http://localhost:8001/api/parse/health'),
      probe('http://localhost:8000/api/lightrag/health'),
      probe(process.env.NEO4J_URI ? process.env.NEO4J_URI.replace('bolt://', 'http://').replace(':7687', ':7474') : ''),
    ]);
    health.ragflow = rf;
    health.paddleocr = po;
    health.lightrag = lr;
    health.neo4j = n4j;

    res.json({
      projects, documents, users, activeUsers,
      objectives, baselines, artifacts, auditLogs,
      health,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch { res.json({ projects: 0, documents: 0, users: 0, activeUsers: 0 }); }
});

// 启动时环境检查
import { execSync } from 'child_process';

app.listen(PORT, async () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ DB: ${process.env.DB_PATH || 'backend/data/planning.db (default)'}`);
  console.log(`✓ Files: ${process.env.FILES_PATH || 'backend/files/ (default)'}`);

  // 必填环境检查
  console.log('─── 环境检查 ───');
  const checks = [
    { key: 'DEEPSEEK_API_KEY', name: 'AI引擎(DeepSeek)', required: true },
    { key: 'NEO4J_URI', name: '知识图谱(Neo4j)', required: false },
  ];
  for (const c of checks) {
    const ok = process.env[c.key] && !process.env[c.key].includes('your-');
    console.log(ok ? `  ✓ ${c.name}` : `  ⚠ ${c.name}: ${c.required ? '必填! AI功能不可用' : '可选，离线模式'}`);
  }

  // 可选服务检查：条件满足时要求启动
  console.log('─── 可选服务 ───');

  // Docker → RAGFlow + Neo4j
  let dockerOk = false;
  try { execSync('docker info', { timeout: 3000, stdio: 'ignore' }); dockerOk = true; } catch {}
  if (dockerOk) {
    // RAGFlow
    try {
      const rf = await fetch('http://localhost:9380/api/v1/version', { signal: AbortSignal.timeout(2000) });
      console.log(rf.ok ? '  ✓ RAGFlow(9380): 在线' : '  ⚠ RAGFlow(9380): Docker已就绪但RAGFlow未启动');
    } catch { console.log('  ⚠ RAGFlow(9380): 未启动 → docker compose -p docmgmt up -d ragflow'); }

    // Neo4j — 自动重试3次（Docker刚启动时Neo4j需要预热）
    let neo4jOk = false;
    for (let i = 0; i < 3; i++) {
      try {
        const n4j = await fetch('http://localhost:7474', { signal: AbortSignal.timeout(3000) });
        if (n4j.ok) { console.log('  ✓ Neo4j(7474): 在线 · GraphRAG可用'); neo4jOk = true; break; }
      } catch {}
      if (i < 2) await new Promise(r => setTimeout(r, 2000));
    }
    if (!neo4jOk) console.log('  ⚠ Neo4j(7474): 未连接 → docker compose -p docmgmt up -d neo4j');
  } else {
    console.log('  - Docker未运行: 启动Docker Desktop后执行 docker compose -p docmgmt up -d neo4j ragflow');
  }

  // Python → OCR + LightRAG
  let pythonOk = false;
  try { execSync('python --version', { timeout: 3000, stdio: 'ignore' }); pythonOk = true; } catch {}
  if (pythonOk) {
    try {
      const po = await fetch('http://localhost:8001/api/parse/health', { signal: AbortSignal.timeout(2000) });
      const pd = await po.json();
      console.log(`  ✓ 文档解析(8001): ${pd.ocr_engine || 'easyocr'}在线`);
    } catch { console.log('  ⚠ 文档解析(8001): 未启动 → python services/paddleocr-server/main.py'); }

    try {
      const lr = await fetch('http://localhost:8000/api/lightrag/health', { signal: AbortSignal.timeout(2000) });
      console.log('  ✓ LightRAG(8000): 在线');
    } catch { console.log('  ⚠ LightRAG(8000): 未启动 → python services/lightrag-server/main.py'); }
  } else {
    console.log('  - Python未安装，文档解析/LightRAG不可用');
  }

  // Ollama 本地AI
  try {
    const ol = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (ol.ok) {
      const tags = await ol.json();
      const models = (tags.models || []).map(m => m.name).join(', ');
      console.log(`  ✓ Ollama(11434): 在线 · ${models || '无模型'}`);
    }
  } catch { console.log('  - Ollama(11434): 未启动 · 本地AI模型不可用'); }

  console.log('─── 启动完成 ───');
});

// ── 全局异常捕获 ──
process.on('uncaughtException', (err) => {
  console.error(`[FATAL ${new Date().toISOString()}] Uncaught: ${err.message}\n${err.stack}`);
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[FATAL ${new Date().toISOString()}] Unhandled Rejection:`, reason);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM — graceful shutdown`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] SIGINT — graceful shutdown`);
  process.exit(0);
});

export default app;
