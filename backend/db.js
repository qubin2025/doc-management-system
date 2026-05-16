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
      permissions TEXT DEFAULT '{"can_upload":true,"can_download":true,"can_use_ai":false}',
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
  `);

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
      ['user1', '施工负责人', 'project_manager', '{"can_upload":true,"can_download":true,"can_use_ai":true}'],
      ['user2', '监理工程师', 'project_manager', '{"can_upload":true,"can_download":true,"can_use_ai":true}'],
      ['user3', '建设单位代表', 'construction_unit', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user4', '资料员', 'viewer', '{"can_upload":true,"can_download":true,"can_use_ai":false}'],
      ['user5', '项目经理', 'project_manager', '{"can_upload":true,"can_download":true,"can_use_ai":true}'],
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
