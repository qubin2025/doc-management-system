-- PostgreSQL 迁移DDL — 从 SQLite 迁移到 PostgreSQL
-- 用法: psql -U postgres -d doc_mgmt -f scripts/migrate-to-pg.sql

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_data TEXT,
  file_path TEXT,
  upload_time TIMESTAMP NOT NULL DEFAULT NOW(),
  uploader TEXT NOT NULL DEFAULT '未知',
  version TEXT NOT NULL DEFAULT 'V1.0',
  standard TEXT NOT NULL DEFAULT 'DB11/T695-2025',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc ON documents(doc_id);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','project_manager','construction_unit','viewer')),
  permissions JSONB DEFAULT '{"can_upload":true,"can_download":true,"can_use_ai":false}',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
  parent_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  level TEXT NOT NULL CHECK(level IN ('root','phase','deliverable','work-item')),
  weight REAL DEFAULT 0,
  progress REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not-started' CHECK(status IN ('not-started','in-progress','completed')),
  linked_work_item_ids JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
  baseline_type TEXT NOT NULL CHECK(baseline_type IN ('scope','schedule','cost')),
  version INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_artifacts (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  vector_id TEXT,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  project_name TEXT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_project ON audit_log(project_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- 默认管理员
INSERT INTO users (username, password_hash, display_name, role, permissions)
VALUES ('admin', '$2b$10$placeholder_hash_replace_after_bcrypt', '系统管理员', 'admin', '{"can_upload":true,"can_download":true,"can_use_ai":true}')
ON CONFLICT (username) DO NOTHING;
