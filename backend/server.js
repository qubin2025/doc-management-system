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

// Health check（无需登录）
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: '工程资料管理系统 API', version: '1.7.0', uptime: process.uptime() });
});

// 系统统计（管理员可见）
app.get('/api/stats', (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const documents = db.prepare('SELECT COUNT(*) as c FROM documents').get().c;
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const activeUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active=1').get().c;
    res.json({
      projects, documents, users, activeUsers,
      neo4j: !!process.env.NEO4J_URI,
      ai: !!process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-'),
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch { res.json({ projects: 0, documents: 0, users: 0, activeUsers: 0 }); }
});

// 启动时环境检查
const ENV_CHECKS = [
  { key: 'DB_PATH', warn: '未设置数据库路径，使用默认路径 backend/data/planning.db' },
  { key: 'FILES_PATH', warn: '未设置文件存储路径，使用默认路径 backend/files/' },
  { key: 'DEEPSEEK_API_KEY', warn: '未设置 AI 密钥，大模型功能不可用' },
  { key: 'NEO4J_URI', warn: '未配置 Neo4j，知识图谱使用离线模式（localStorage）' },
];

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ DB: ${process.env.DB_PATH || 'backend/data/planning.db (default)'}`);
  console.log(`✓ Files: ${process.env.FILES_PATH || 'backend/files/ (default)'}`);
  for (const check of ENV_CHECKS) {
    if (!process.env[check.key]) {
      console.log(`⚠ ${check.warn}`);
    }
  }
});

export default app;
