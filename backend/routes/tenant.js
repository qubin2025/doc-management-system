/**
 * 多租户 + 用量统计 + 计费 API — v3.0 商业版
 */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getDb } from '../db.js';

const router = Router();

// 初始化表结构
function initTenantTables() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT,
    domain TEXT,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    max_projects INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 1,
    owner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER UNIQUE REFERENCES tenants(id),
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    price_monthly REAL DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    renewed_at DATETIME,
    expires_at DATETIME
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER REFERENCES tenants(id),
    date TEXT DEFAULT (date('now')),
    ai_calls INTEGER DEFAULT 0,
    ai_tokens INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    storage_bytes INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    UNIQUE(tenant_id, date)
  )`);
}
initTenantTables();

// ========== 租户管理 ==========

// GET /api/tenant — 当前租户信息
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const tenant = db.prepare('SELECT * FROM tenants WHERE owner_id = ?').get(req.user.id);
  res.json({ tenant: tenant || null });
});

// GET /api/tenant/all — 所有租户(管理员)
router.get('/all', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const tenants = db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all();
  res.json({ tenants });
});

// POST /api/tenant — 创建租户
router.post('/', requireAuth, (req, res) => {
  const { name, display_name, plan } = req.body;
  if (!name) return res.status(400).json({ error: '租户名称必填' });
  const db = getDb();
  try {
    const r = db.prepare('INSERT INTO tenants (name, display_name, plan, owner_id) VALUES (?, ?, ?, ?)').run(
      name, display_name || name, plan || 'free', req.user.id
    );
    // 同时创建免费订阅
    db.prepare('INSERT INTO subscriptions (tenant_id, plan, status) VALUES (?, ?, ?)').run(r.lastInsertRowid, plan || 'free', 'active');
    res.json({ ok: true, tenant_id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: '租户名已存在: ' + e.message });
  }
});

// PUT /api/tenant/:id — 更新租户配置
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const { plan, max_projects, max_users, max_storage_gb, status } = req.body;
  const db = getDb();
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: '租户不存在' });

  db.prepare(`UPDATE tenants SET
    plan = COALESCE(?, plan),
    max_projects = COALESCE(?, max_projects),
    max_users = COALESCE(?, max_users),
    max_storage_gb = COALESCE(?, max_storage_gb),
    status = COALESCE(?, status)
    WHERE id = ?`).run(plan, max_projects, max_users, max_storage_gb, status, Number(req.params.id));
  res.json({ ok: true });
});

// ========== 用量统计 ==========

// POST /api/tenant/usage/record — 记录一次AI调用
router.post('/usage/record', requireAuth, (req, res) => {
  const db = getDb();
  const tenantId = req.body.tenant_id || 1;
  const type = req.body.type || 'ai_call'; // ai_call | document_upload | token_spend

  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = db.prepare('SELECT id FROM usage_records WHERE tenant_id = ? AND date = ?').get(tenantId, today);
    if (existing) {
      if (type === 'ai_call') db.prepare('UPDATE usage_records SET ai_calls = ai_calls + 1 WHERE id = ?').run(existing.id);
      else if (type === 'document_upload') db.prepare('UPDATE usage_records SET documents_uploaded = documents_uploaded + 1 WHERE id = ?').run(existing.id);
      else if (type === 'token_spend') db.prepare('UPDATE usage_records SET ai_tokens = ai_tokens + ? WHERE id = ?').run(req.body.tokens || 1, existing.id);
    } else {
      db.prepare('INSERT INTO usage_records (tenant_id, date, ai_calls, documents_uploaded) VALUES (?, ?, ?, ?)').run(
        tenantId, today,
        type === 'ai_call' ? 1 : 0,
        type === 'document_upload' ? 1 : 0,
      );
    }
    res.json({ ok: true });
  } catch { res.json({ ok: true }); } // 静默失败
});

// GET /api/tenant/usage — 当前租户用量
router.get('/usage', requireAuth, (req, res) => {
  const db = getDb();
  const tenantId = req.query.tenant_id || 1;
  const today = db.prepare("SELECT * FROM usage_records WHERE tenant_id = ? AND date = date('now')").get(tenantId);
  const month = db.prepare("SELECT SUM(ai_calls) as ai, SUM(documents_uploaded) as docs, SUM(ai_tokens) as tokens FROM usage_records WHERE tenant_id = ? AND date >= date('now', '-30 days')").get(tenantId);
  res.json({ today: today || { ai_calls: 0, documents_uploaded: 0 }, month: month || { ai: 0, docs: 0, tokens: 0 } });
});

// GET /api/tenant/stats — 平台统计(管理员)
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const tenants = db.prepare('SELECT COUNT(*) as c FROM tenants').get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM tenants WHERE status = 'active'").get().c;
  const totalCalls = db.prepare("SELECT COALESCE(SUM(ai_calls),0) as c FROM usage_records WHERE date >= date('now', '-30 days')").get().c;
  res.json({ tenants, activeTenants: active, monthlyAiCalls: totalCalls });
});

export default router;
