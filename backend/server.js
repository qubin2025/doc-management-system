import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { getDb } from './db.js';
import projectsRouter from './routes/projects.js';
import documentsRouter from './routes/documents.js';
import authRouter from './routes/auth.js';
import importRouter from './routes/import.js';
import backupRouter from './routes/backup.js';
import aiRouter from './routes/ai.js';
import kgRouter from './routes/kg.js';
import ragflowRouter from './routes/ragflow.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(isProduction ? (corsOrigin ? {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
} : { origin: false }) : {}));
app.use(morgan(isProduction ? 'combined' : 'short'));
app.use(express.json({ limit: '100mb' }));

// 全局限流
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 200 : 1000,
  message: { error: '请求过于频繁，请稍后重试' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// 安全头
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Initialize database
getDb();

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/import', importRouter);
app.use('/api/backup', backupRouter);
app.use('/api/ai', aiRouter);
app.use('/api/kg', kgRouter);
app.use('/api/ragflow', ragflowRouter);

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

    // 服务健康检查（并发探测）
    const health = {
      // AI模型
      deepseek: !!(process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-')),
      qwen: !!(process.env.QWEN_API_KEY && !process.env.QWEN_API_KEY.includes('your-')),
      zhipu: !!(process.env.ZHIPU_API_KEY && !process.env.ZHIPU_API_KEY.includes('your-')),
      dashscope: !!(process.env.DASHSCOPE_API_KEY && !process.env.DASHSCOPE_API_KEY.includes('your-')),
      // 基础设施
      neo4j: !!process.env.NEO4J_URI,
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

    const [rf, po, lr] = await Promise.all([
      probe('http://localhost:9380/api/v1/version'),
      probe('http://localhost:8001/api/parse/health'),
      probe('http://localhost:8000/api/lightrag/health'),
    ]);
    health.ragflow = rf;
    health.paddleocr = po;
    health.lightrag = lr;

    res.json({
      projects, documents, users, activeUsers,
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

  // Docker → RAGFlow
  let dockerOk = false;
  try { execSync('docker info', { timeout: 3000, stdio: 'ignore' }); dockerOk = true; } catch {}
  if (dockerOk) {
    try {
      const rf = await fetch('http://localhost:9380/api/v1/version', { signal: AbortSignal.timeout(2000) });
      console.log(rf.ok ? '  ✓ RAGFlow(9380): 在线' : '  ⚠ RAGFlow(9380): Docker已就绪但RAGFlow未启动，请执行 docker compose up -d');
    } catch { console.log('  ⚠ RAGFlow(9380): Docker已就绪但RAGFlow未启动，请执行 docker compose up -d'); }

    try {
      const n4j = await fetch('http://localhost:7687', { signal: AbortSignal.timeout(2000) });
      console.log('  ✓ Neo4j(7687): 在线');
    } catch { console.log('  ⚠ Neo4j(7687): 未启动，请启动Neo4j容器'); }
  } else {
    console.log('  - Docker未安装，RAGFlow/Neo4j不可用');
  }

  // Python → OCR + LightRAG
  let pythonOk = false;
  try { execSync('python --version', { timeout: 3000, stdio: 'ignore' }); pythonOk = true; } catch {}
  if (pythonOk) {
    try {
      const po = await fetch('http://localhost:8001/api/parse/health', { signal: AbortSignal.timeout(2000) });
      const pd = await po.json();
      console.log(`  ✓ 文档解析(8001): ${pd.ocr_engine || 'easyocr'}在线`);
    } catch { console.log('  ⚠ 文档解析(8001): Python已安装但未启动，请执行 python services/paddleocr-server/main.py'); }

    try {
      const lr = await fetch('http://localhost:8000/api/lightrag/health', { signal: AbortSignal.timeout(2000) });
      console.log('  ✓ LightRAG(8000): 在线');
    } catch { console.log('  ⚠ LightRAG(8000): Python已安装但未启动，请执行 python services/lightrag-server/main.py'); }
  } else {
    console.log('  - Python未安装，文档解析/LightRAG不可用');
  }

  console.log('─── 启动完成 ───');
});

export default app;
