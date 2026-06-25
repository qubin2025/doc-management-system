/**
 * 审计日志中间件 — v3.0 商业版
 * 记录所有敏感操作: 谁(IP/用户) + 何时 + 做了什么 + 结果
 */
import { getDb } from '../db.js';

function initAuditTable() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    detail TEXT,
    ip TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at)`);
}

export function auditLog(action, resource, detail) {
  return (req, res, next) => {
    const origEnd = res.end;
    res.end = function (...args) {
      try {
        const db = getDb();
        const stmt = db.prepare(`INSERT INTO audit_logs (user_id, username, action, resource, detail, ip, user_agent, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(
          req.user?.id || null,
          req.user?.username || 'anonymous',
          action,
          resource || req.originalUrl,
          typeof detail === 'function' ? detail(req) : (detail || ''),
          req.ip || req.connection?.remoteAddress || '',
          req.headers?.['user-agent'] || '',
          res.statusCode < 400 ? 'success' : 'failure',
        );
      } catch {}
      origEnd.apply(res, args);
    };
    next();
  };
}

// 启动时建表
initAuditTable();

export { initAuditTable };
