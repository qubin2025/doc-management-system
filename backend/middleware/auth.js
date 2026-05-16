import { getDb } from '../db.js';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const db = getDb();
  const session = db.prepare(
    'SELECT s.user_id, s.expires_at, u.username, u.role, u.permissions, u.is_active FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
  ).get(token);

  if (!session) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  if (!session.is_active) {
    return res.status(403).json({ error: '账号已被禁用' });
  }

  req.user = {
    id: session.user_id,
    username: session.username,
    role: session.role,
    permissions: JSON.parse(session.permissions || '{}'),
  };

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: '权限不足' });
      }
      next();
    });
  };
}

export function requirePermission(perm) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.user.role === 'admin') return next();
      if (req.user.permissions?.[perm]) return next();
      return res.status(403).json({ error: '权限不足' });
    });
  };
}
