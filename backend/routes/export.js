import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// GET 导出项目完整数据
router.get('/project/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  const db = getDb();

  // 收集所有项目数据
  const project = db.prepare('SELECT * FROM projects WHERE name = ?').get(name);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const objectives = db.prepare('SELECT * FROM objectives WHERE project_name = ?').all(name);
  const baselines = db.prepare('SELECT * FROM baselines WHERE project_name = ?').all(name);
  const documents = db.prepare('SELECT * FROM documents WHERE project_id = ?').all(project.id);
  const auditLogs = db.prepare('SELECT * FROM audit_log WHERE project_name = ?').all(name);

  logAudit(name, req.user?.username || 'unknown', 'export', 'project', name);

  res.json({
    version: '4.0',
    exportedAt: new Date().toISOString(),
    project,
    objectives,
    baselines,
    documents: documents.map(d => ({ ...d, file_data: d.file_data ? '[BASE64_OMITTED]' : null })),
    auditLogs,
    note: '完整文件数据请使用 /api/backup/project/:id 下载',
  });
});

// GET 健康检查增强版
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '4.0.0',
    uptime: Math.floor(process.uptime()),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
});

export default router;
