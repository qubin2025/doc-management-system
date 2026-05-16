import { Router } from 'express';
import { getDb } from '../db.js';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const SESSION_HOURS = 24;

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash, display_name, role, permissions, is_active FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  if (!user.is_active) {
    return res.status(403).json({ error: '账号已被禁用' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  // 创建 session
  const token = uuid();
  const expires = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    },
    permissions: JSON.parse(user.permissions || '{}'),
  });
});

// 获取当前用户
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    },
    permissions: req.user.permissions,
  });
});

// 登出
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

// ====== 用户管理（仅 admin） ======

// 列出所有用户
router.get('/users', requireRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, username, display_name, role, permissions, is_active, created_at FROM users ORDER BY id'
  ).all();
  res.json(users.map(u => ({ ...u, permissions: JSON.parse(u.permissions || '{}') })));
});

// 创建用户
router.post('/users', requireRole('admin'), (req, res) => {
  const { username, password, displayName, role, permissions } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role, permissions) VALUES (?, ?, ?, ?, ?)'
    ).run(
      username,
      hash,
      displayName || username,
      role || 'viewer',
      JSON.stringify(permissions || { can_upload: true, can_download: true, can_use_ai: false })
    );
    res.status(201).json({ id: result.lastInsertRowid, username });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(409).json({ error: '用户名已存在' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// 更新用户
router.put('/users/:id', requireRole('admin'), (req, res) => {
  const { username, password, displayName, role, permissions, isActive } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  if (username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.params.id);
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  }
  if (displayName !== undefined) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, req.params.id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (permissions) db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), req.params.id);
  if (isActive !== undefined) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, req.params.id);
  db.prepare('UPDATE users SET updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// 删除用户
router.delete('/users/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
