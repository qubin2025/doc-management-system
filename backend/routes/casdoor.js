/**
 * Casdoor OAuth 认证适配器 — v3.0 商业版
 * 支持: 微信/支付宝/手机号/企业微信/钉钉
 */
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();
const CASDOOR_URL = process.env.CASDOOR_URL || 'http://localhost:8002';
const CASDOOR_CLIENT_ID = process.env.CASDOOR_CLIENT_ID || '';
const CASDOOR_CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET || '';
const CASDOOR_ORG = process.env.CASDOOR_ORG || 'built-in';
const CASDOOR_APP = process.env.CASDOOR_APP || 'app-built-in';

// GET /api/casdoor/config — 返回Casdoor配置给前端
router.get('/config', (req, res) => {
  const available = !!(CASDOOR_CLIENT_ID && CASDOOR_CLIENT_SECRET);
  res.json({
    available,
    serverUrl: CASDOOR_URL,
    clientId: CASDOOR_CLIENT_ID,
    organization: CASDOOR_ORG,
    application: CASDOOR_APP,
    redirectUri: `${req.protocol}://${req.get('host')}/api/casdoor/callback`,
  });
});

// GET /api/casdoor/callback — OAuth回调
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: '缺少授权码' });

  try {
    // 用code换token
    const tokenResp = await fetch(`${CASDOOR_URL}/api/login/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CASDOOR_CLIENT_ID,
        client_secret: CASDOOR_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenResp.json();

    // 获取用户信息
    const userResp = await fetch(`${CASDOOR_URL}/api/userinfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const casdoorUser = await userResp.json();

    // 查找或创建本地用户
    const db = getDb();
    let localUser = db.prepare('SELECT * FROM users WHERE username = ?').get(casdoorUser.name || casdoorUser.sub);
    if (!localUser) {
      // 自动注册(Casdoor用户)
      const hash = `casdoor:${casdoorUser.sub}`;
      const r = db.prepare('INSERT INTO users (username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, 1)').run(
        casdoorUser.name || casdoorUser.sub, hash, casdoorUser.displayName || '', 'project_manager'
      );
      localUser = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    }

    // 生成session token
    const { v4: uuidv4 } = await import('uuid');
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(localUser.id, token, expires);

    // 重定向到前端
    const frontendUrl = req.cookies?.redirect || '/';
    res.redirect(`${frontendUrl}?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: localUser.id, username: localUser.username, role: localUser.role }))}`);
  } catch (e) {
    res.status(500).json({ error: 'Casdoor认证失败: ' + e.message });
  }
});

export default router;
