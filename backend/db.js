import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'planning.db');

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      doc_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_data TEXT,
      file_path TEXT,
      upload_time TEXT NOT NULL DEFAULT (datetime('now')),
      uploader TEXT NOT NULL DEFAULT '未知',
      version TEXT NOT NULL DEFAULT 'V1.0',
      standard TEXT NOT NULL DEFAULT 'DB11/T695-2025',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','project_manager','construction_unit','viewer')),
      permissions TEXT DEFAULT '{"can_upload":true,"can_download":true,"can_use_ai":false}', -- AI权限默认关闭,管理员审批后开启
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_doc_id ON documents(doc_id);
    CREATE INDEX IF NOT EXISTS idx_documents_standard ON documents(standard);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

    -- P0-4: 目标管理体系
    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      level TEXT NOT NULL CHECK(level IN ('root','phase','deliverable','work-item')),
      weight REAL DEFAULT 0,
      progress REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'not-started' CHECK(status IN ('not-started','in-progress','completed')),
      linked_work_item_ids TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_objectives_project ON objectives(project_name);
    CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives(parent_id);

    -- P0-4: 三大基线快照
    CREATE TABLE IF NOT EXISTS baselines (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      baseline_type TEXT NOT NULL CHECK(baseline_type IN ('scope','schedule','cost')),
      version INTEGER NOT NULL DEFAULT 1,
      snapshot TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT NOT NULL,
      FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_baselines_project ON baselines(project_name);
    CREATE INDEX IF NOT EXISTS idx_baselines_active ON baselines(project_name, is_active);

    -- P0-2/P0-4: 知识加工产物索引
    CREATE TABLE IF NOT EXISTS knowledge_artifacts (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      artifact_type TEXT NOT NULL CHECK(artifact_type IN ('chunk','summary','graph','category','qa-pair')),
      source_type TEXT NOT NULL CHECK(source_type IN ('document','form','work-item','ai-generated')),
      source_id TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      vector_id TEXT,
      confidence REAL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_project ON knowledge_artifacts(project_name);
    CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_type ON knowledge_artifacts(project_name, artifact_type);

    -- P0-4: 操作审计日志
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('create','update','delete','view','export','import')),
      target_type TEXT NOT NULL CHECK(target_type IN ('project','objective','baseline','document','work-item','form','configuration')),
      target_id TEXT NOT NULL,
      detail TEXT DEFAULT '{}',
      ip_address TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_project ON audit_log(project_name);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

    -- v4.4: 手机端照片
    CREATE TABLE IF NOT EXISTS mobile_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      watermark_data TEXT DEFAULT '{}',
      location TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      poi TEXT DEFAULT '',
      address TEXT DEFAULT '',
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mobile_photos_project ON mobile_photos(project_id);

    -- v4.4: 手机端水印模板
    CREATE TABLE IF NOT EXISTS mobile_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      template_data TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- v4.4: 现场问题管理
    CREATE TABLE IF NOT EXISTS mobile_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      severity TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'reported',
      assignee TEXT DEFAULT '',
      photo_path TEXT DEFAULT '',
      reported_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- v4.4: 手机端进度快报
    CREATE TABLE IF NOT EXISTS mobile_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      plan_item_id TEXT NULL,
      title TEXT NOT NULL,
      percentage REAL DEFAULT 0,
      note TEXT DEFAULT '',
      reported_by TEXT NOT NULL,
      match_status TEXT DEFAULT 'unmatched',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- v4.4: 项目日报 (8段曙光模板)
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      report_date TEXT NOT NULL,
      weather_day TEXT DEFAULT '',
      weather_night TEXT DEFAULT '',
      weather_alert TEXT DEFAULT '',
      weather_alert_level TEXT DEFAULT '',
      managers_main INTEGER DEFAULT 0,
      managers_labor INTEGER DEFAULT 0,
      managers_specialty INTEGER DEFAULT 0,
      workers_main INTEGER DEFAULT 0,
      workers_labor INTEGER DEFAULT 0,
      workers_specialty INTEGER DEFAULT 0,
      workers_special INTEGER DEFAULT 0,
      workers_total INTEGER DEFAULT 0,
      machinery TEXT DEFAULT '[]',
      machinery_total INTEGER DEFAULT 0,
      materials TEXT DEFAULT '[]',
      tasks TEXT DEFAULT '[]',
      quality_risks TEXT DEFAULT '[]',
      issues TEXT DEFAULT '[]',
      photos TEXT DEFAULT '[]',
      original_text TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      reported_by TEXT NOT NULL,
      deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, report_date)
    );
    CREATE TABLE IF NOT EXISTS daily_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      report_date TEXT NOT NULL,
      worker_type TEXT NOT NULL,
      count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_machinery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      report_date TEXT NOT NULL,
      name TEXT NOT NULL,
      spec TEXT DEFAULT '',
      count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      report_date TEXT NOT NULL,
      area TEXT DEFAULT '',
      description TEXT NOT NULL,
      workers INTEGER DEFAULT 0,
      today_pct TEXT DEFAULT '',
      total_pct TEXT DEFAULT '',
      schedule_deviation TEXT DEFAULT '',
      contractor TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS daily_risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      report_date TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT DEFAULT '',
      detail TEXT DEFAULT '',
      status TEXT DEFAULT '',
      impact_days INTEGER DEFAULT 0
    );

    -- v4.4: 项目经验库
    CREATE TABLE IF NOT EXISTS project_experiences (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      patterns TEXT DEFAULT '[]',
      metrics TEXT DEFAULT '{}',
      reference_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- v4.4: 干系人管理
    CREATE TABLE IF NOT EXISTS stakeholders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      org TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS guide_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      completed_items TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_name, chapter_id)
    );
    CREATE TABLE IF NOT EXISTS guide_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      form_code TEXT NOT NULL,
      content TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_name, chapter_id, form_code)
    );
    CREATE TABLE IF NOT EXISTS ai_review_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      review_type TEXT NOT NULL,
      file_name TEXT DEFAULT '',
      results TEXT DEFAULT '[]',
      report TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 迁移：旧 daily_reports 表添加 deleted 列
  try { db.exec('ALTER TABLE daily_reports ADD COLUMN deleted INTEGER DEFAULT 0'); } catch {}

  // 迁移：给旧 users 表添加缺失列（如果旧表已存在则 ALTER）
  migrateSchema(db);

  // 插入默认用户
  seedUsers(db);
}

function migrateSchema(db) {
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('display_name')) {
    try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''"); } catch {}
  }
  if (!cols.includes('permissions')) {
    try { db.exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{\"can_upload\":true,\"can_download\":true,\"can_use_ai\":false}'"); } catch {}
  }
  if (!cols.includes('is_active')) {
    try { db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1"); } catch {}
  }
  if (!cols.includes('updated_at')) {
    try { db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))"); } catch {}
  }

  const docCols = db.prepare("PRAGMA table_info(documents)").all().map(c => c.name);
  if (!docCols.includes('file_path')) {
    try { db.exec("ALTER TABLE documents ADD COLUMN file_path TEXT"); } catch {}
  }
}

function seedUsers(db) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    const insert = db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role, permissions) VALUES (?, ?, ?, ?, ?)'
    );
    insert.run('admin', hash, '系统管理员', 'admin', '{"can_upload":true,"can_download":true,"can_use_ai":true}');
    insert.run('管理员', hash, '系统管理员', 'admin', '{"can_upload":true,"can_download":true,"can_use_ai":true}');

    // 8 个初始用户
    const defaultUsers = [
      ['user1', '施工负责人', 'project_manager', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user2', '监理工程师', 'project_manager', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user3', '建设单位代表', 'construction_unit', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user4', '资料员', 'viewer', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user5', '项目经理', 'project_manager', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user6', '施工员', 'viewer', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user7', '造价员', 'viewer', '{"can_upload":false,"can_download":true,"can_use_ai":false}'],
      ['user8', '资料管理员', 'construction_unit', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
    ];
    for (const [u, dn, r, p] of defaultUsers) {
      insert.run(u, hash, dn, r, p);
    }
  } else {
    // 迁移旧密码（plaintext → bcrypt）
    const oldUsers = db.prepare('SELECT id, password_hash FROM users').all();
    for (const u of oldUsers) {
      if (u.password_hash.length < 40) {
        const newHash = bcrypt.hashSync(u.password_hash, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, u.id);
      }
    }
  }
}

export default getDb;
