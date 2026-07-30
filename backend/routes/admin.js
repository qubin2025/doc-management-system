/**
 * 管理员端点 — API KEY 在线配置 / 系统信息
 * 存储: backend/data/apikey.json (gitignored), .env 为默认值
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', 'data', 'apikey.json');

const KEY_NAMES = ['DEEPSEEK_API_KEY', 'ZHIPU_API_KEY', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY'];

function loadOverrides() {
  try { if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { /* ignore */ }
  return {};
}

function saveOverrides(data: Record<string, string>) {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function maskKey(key: string) {
  if (!key || key.length < 12) return '(未配置)';
  return key.slice(0, 6) + '***' + key.slice(-4);
}

/** 获取有效 API KEY（覆盖优先于 .env） */
export function getApiKey(name: string): string {
  const overrides = loadOverrides();
  return overrides[name] || process.env[name] || '';
}

const router = Router();

// GET — 查看 KEY 状态（脱敏）
router.get('/apikey', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const overrides = loadOverrides();
  const keys = KEY_NAMES.map(name => {
    const envVal = process.env[name] || '';
    const overrideVal = overrides[name] || '';
    const effective = overrideVal || envVal;
    return {
      name,
      source: overrideVal ? '在线配置' : (envVal ? '.env文件' : '未配置'),
      masked: maskKey(effective),
      configured: !!effective,
    };
  });
  res.json({ keys });
});

// PUT — 更新 KEY
router.put('/apikey', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name, value } = req.body;
  if (!name || !KEY_NAMES.includes(name)) {
    return res.status(400).json({ error: `无效的KEY名称，可选: ${KEY_NAMES.join(', ')}` });
  }
  if (!value || value.length < 10) {
    return res.status(400).json({ error: 'KEY值不能为空且至少10个字符' });
  }
  const overrides = loadOverrides();
  overrides[name] = String(value);
  saveOverrides(overrides);
  res.json({ success: true, name, message: `${name} 已更新，重启后端生效` });
});

// DELETE — 删除在线配置（回退到 .env）
router.delete('/apikey/:name', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name } = req.params;
  if (!KEY_NAMES.includes(name)) return res.status(400).json({ error: '无效的KEY名称' });
  const overrides = loadOverrides();
  delete overrides[name];
  saveOverrides(overrides);
  res.json({ success: true, message: `${name} 在线配置已删除，回退到.env` });
});

// GET — 系统信息（版本+运行状态）
router.get('/system', requireAuth, (_req, res) => {
  res.json({
    version: '5.1.0',
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    env: process.env.NODE_ENV || 'development',
  });
});

export default router;
