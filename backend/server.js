import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { getDb } from './db.js';
import projectsRouter from './routes/projects.js';
import documentsRouter from './routes/documents.js';
import authRouter from './routes/auth.js';
import importRouter from './routes/import.js';
import backupRouter from './routes/backup.js';

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

// Health check
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: '工程资料管理系统 API' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
