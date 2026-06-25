/**
 * 审计日志 + 系统备份 API — v3.0 商业版
 */
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { initAuditTable } from '../middleware/auditLog.js';
import { getDb } from '../db.js';
import { execSync } from 'child_process';

const requireAdmin = requireRole('admin');

// 确保审计表已创建
initAuditTable();
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// GET /api/audit — 查询审计日志
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const { page = 1, limit = 50, action, user_id } = req.query;
  const db = getDb();
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (user_id) { sql += ' AND user_id = ?'; params.push(Number(user_id)); }

  const total = db.prepare(sql.replace('*', 'COUNT(*) as c')).get(...params)?.c || 0;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));

  const logs = db.prepare(sql).all(...params);
  res.json({ logs, total, page: Number(page), limit: Number(limit) });
});

// GET /api/audit/stats — 审计统计
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get()?.c || 0;
  const today = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE date(created_at) = date('now')").get()?.c || 0;
  const topActions = db.prepare('SELECT action, COUNT(*) as c FROM audit_logs GROUP BY action ORDER BY c DESC LIMIT 10').all();
  const failureRate = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE status = 'failure' AND date(created_at) = date('now')").get()?.c || 0;
  res.json({ total, today, topActions, failuresToday: failureRate });
});

// POST /api/backup/create — 创建备份
router.post('/backup/create', requireAuth, requireAdmin, (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const dbPath = process.env.DB_PATH || './data/planning.db';
    const filesPath = process.env.FILES_PATH || './files';

    const backupFile = path.join(backupDir, `backup-${timestamp}.tar.gz`);

    // tar打包数据文件
    try {
      execSync(`tar -czf "${backupFile}" "${dbPath}" "${filesPath}" 2>/dev/null || echo "tar failed"`, { timeout: 30000 });
    } catch {
      // Windows环境: 使用copy
      const dbBackup = path.join(backupDir, `planning-${timestamp}.db`);
      fs.copyFileSync(dbPath, dbBackup);
      return res.json({ ok: true, file: dbBackup, message: 'Windows模式: 仅备份数据库文件' });
    }

    const stat = fs.statSync(backupFile);
    res.json({ ok: true, file: backupFile, size: `${(stat.size / 1024 / 1024).toFixed(1)}MB`, timestamp });
  } catch (e) {
    res.status(500).json({ error: '备份失败: ' + e.message });
  }
});

// GET /api/backup/list — 列出备份
router.get('/backup/list', requireAuth, requireAdmin, (req, res) => {
  const backupDir = path.join(__dirname, '..', 'backups');
  try {
    if (!fs.existsSync(backupDir)) return res.json({ backups: [] });
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') || f.startsWith('planning-'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: `${(stat.size / 1024 / 1024).toFixed(1)}MB`, time: stat.mtime };
      })
      .sort((a, b) => b.time - a.time);
    res.json({ backups: files });
  } catch { res.json({ backups: [] }); }
});

export default router;
