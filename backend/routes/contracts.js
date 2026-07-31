/**
 * 合同管理 API — CRUD + 模板 + 知识沉淀
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db.js';

const router = Router();

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      contract_name TEXT NOT NULL,
      contract_type TEXT DEFAULT '施工合同',
      party_a TEXT DEFAULT '',
      party_b TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      sign_date TEXT DEFAULT '',
      content_text TEXT DEFAULT '',
      review_result TEXT DEFAULT '',
      risk_level TEXT DEFAULT 'medium',
      risk_items TEXT DEFAULT '[]',
      template_id INTEGER,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contract_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '通用',
      description TEXT DEFAULT '',
      content TEXT NOT NULL,
      clauses TEXT DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// GET /api/contracts/list — 合同列表
router.get('/list', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  const { project } = req.query;
  let rows;
  if (project) {
    rows = db.prepare('SELECT * FROM contracts WHERE project_name=? ORDER BY created_at DESC').all(project);
  } else {
    rows = db.prepare('SELECT * FROM contracts ORDER BY created_at DESC LIMIT 200').all();
  }
  res.json(rows.map(r => ({
    ...r,
    risk_items: JSON.parse(r.risk_items || '[]'),
  })));
});

// POST /api/contracts/create — 新建合同
router.post('/create', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  const { project_name, contract_name, contract_type, party_a, party_b, amount, sign_date, content_text } = req.body;
  if (!project_name || !contract_name) return res.status(400).json({ error: '项目名称和合同名称为必填' });
  const r = db.prepare(`INSERT INTO contracts (project_name,contract_name,contract_type,party_a,party_b,amount,sign_date,content_text,created_by)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    project_name, contract_name, contract_type || '施工合同', party_a || '', party_b || '',
    amount || 0, sign_date || '', content_text || '', req.user?.username || 'unknown'
  );
  res.status(201).json({ id: r.lastInsertRowid, message: '合同已创建' });
});

// PUT /api/contracts/:id — 更新合同（含审查结果+自动沉淀知识）
router.put('/:id', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  const { review_result, risk_level, risk_items, content_text, auto_deposit } = req.body;
  const existing = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '合同不存在' });
  db.prepare(`UPDATE contracts SET review_result=?, risk_level=?, risk_items=?, content_text=?, updated_at=datetime('now') WHERE id=?`)
    .run(review_result || existing.review_result, risk_level || existing.risk_level,
      JSON.stringify(risk_items || JSON.parse(existing.risk_items || '[]')),
      content_text || existing.content_text, req.params.id);

  // 自动沉淀知识
  if (auto_deposit && review_result) {
    const riskList = risk_items || JSON.parse(existing.risk_items || '[]');
    const expId = `contract-${req.params.id}-${Date.now()}`;
    db.prepare(`INSERT OR IGNORE INTO project_experiences (id,project_name,category,title,description,patterns,metrics,reference_count)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      expId, existing.project_name, '合同管理',
      `合同审查: ${existing.contract_name}`,
      review_result.slice(0, 500),
      JSON.stringify(riskList.map((r) => ({ type: 'contract-risk', content: r.issue || r.problem || '' }))),
      JSON.stringify({ riskLevel: risk_level || existing.risk_level, amount: existing.amount, autoDeposit: true }),
      1
    );
  }
  res.json({ success: true, message: '合同已更新' + (auto_deposit ? '，知识已自动沉淀' : '') });
});

// DELETE /api/contracts/:id
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  db.prepare('DELETE FROM contracts WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/contracts/:id/template — 从合同生成模板
router.post('/:id/template', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  const contract = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });
  const { name, category } = req.body;
  const r = db.prepare(`INSERT INTO contract_templates (name,category,description,content,clauses,created_by)
    VALUES (?,?,?,?,?,?)`).run(
    name || `${contract.contract_name}模板`, category || contract.contract_type,
    `由合同"${contract.contract_name}"生成`, contract.content_text || '',
    contract.risk_items || '[]', req.user?.username || 'unknown'
  );
  // 同时标记合同
  db.prepare('UPDATE contracts SET template_id=? WHERE id=?').run(r.lastInsertRowid, req.params.id);
  res.status(201).json({ id: r.lastInsertRowid, message: '模板已生成并存入知识库' });
});

// GET /api/contracts/templates — 模板列表
router.get('/templates/list', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  const rows = db.prepare('SELECT * FROM contract_templates ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST /api/contracts/knowledge/deposit — 合同知识沉淀到经验库
router.post('/knowledge/deposit', requireAuth, (req, res) => {
  const db = getDb(); ensureTables(db);
  const { contract_id } = req.body;
  const contract = db.prepare('SELECT * FROM contracts WHERE id=?').get(contract_id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });

  // 沉淀到 project_experiences
  const riskItems = JSON.parse(contract.risk_items || '[]');
  const expId = `contract-${contract.id}-${Date.now()}`;
  db.prepare(`INSERT OR IGNORE INTO project_experiences (id,project_name,category,title,description,patterns,metrics,reference_count)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    expId, contract.project_name, '合同管理',
    `合同审查: ${contract.contract_name}`,
    contract.review_result || `合同类型: ${contract.contract_type}, 风险等级: ${contract.risk_level}`,
    JSON.stringify(riskItems.map((r) => ({ type: 'contract-risk', content: r.issue || r.problem || '' }))),
    JSON.stringify({ riskLevel: contract.risk_level, amount: contract.amount }),
    1
  );
  res.json({ success: true, expId, message: '合同知识已沉淀到经验库' });
});

export default router;
