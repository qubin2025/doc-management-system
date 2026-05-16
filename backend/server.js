import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { getDb } from './db.js';
import projectsRouter from './routes/projects.js';
import documentsRouter from './routes/documents.js';
import authRouter from './routes/auth.js';
import importRouter from './routes/import.js';
import backupRouter from './routes/backup.js';
import aiRouter from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('short'));
app.use(express.json({ limit: '100mb' }));

// Initialize database
getDb();

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/import', importRouter);
app.use('/api/backup', backupRouter);
app.use('/api/ai', aiRouter);

// Health check（无需登录）
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: '工程资料管理系统 API' });
});

// 启动时环境检查
const ENV_CHECKS = [
  { key: 'DB_PATH', warn: '未设置数据库路径，使用默认路径 backend/data/planning.db' },
  { key: 'FILES_PATH', warn: '未设置文件存储路径，使用默认路径 backend/files/' },
  { key: 'DEEPSEEK_API_KEY', warn: '未设置 AI 密钥，大模型功能不可用' },
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
