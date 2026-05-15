import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?').get(username);

  if (!user || user.password_hash !== password) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role
  });
});

// 注册
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, password, 'user');
    res.status(201).json({ id: result.lastInsertRowid, username });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(409).json({ error: '用户名已存在' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

export default router;
