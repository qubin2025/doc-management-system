-- ============================================
-- SQLite → PostgreSQL 迁移脚本 v3.0
-- 多租户架构: 每个租户独立 Schema
-- 用法: psql -U postgres -d doc_mgmt -f migrate-to-postgres.sql
-- ============================================

-- 1. 创建数据库
-- CREATE DATABASE doc_mgmt ENCODING 'UTF8';

-- 2. 用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    display_name VARCHAR(128),
    email VARCHAR(256),
    phone VARCHAR(32),
    role VARCHAR(32) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    tenant_id INTEGER REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 会话表
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- 4. 审计日志表
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(256),
    detail TEXT,
    ip VARCHAR(64),
    user_agent TEXT,
    status VARCHAR(16) DEFAULT 'success',
    tenant_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_time ON audit_logs(created_at);

-- 5. 项目表
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    standard VARCHAR(64) DEFAULT 'DB11/T695-2025',
    details JSONB DEFAULT '{}',
    tenant_id INTEGER REFERENCES tenants(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, tenant_id)
);

-- 6. 文档表
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(512) NOT NULL,
    filepath VARCHAR(1024),
    filesize BIGINT DEFAULT 0,
    version VARCHAR(16) DEFAULT 'V1.0',
    uploader VARCHAR(128),
    uploader_id INTEGER,
    tenant_id INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 用量统计表
CREATE TABLE usage_stats (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_calls INTEGER DEFAULT 0,
    ai_tokens INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    UNIQUE(tenant_id, date)
);

-- 8. 计费表
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) UNIQUE,
    plan VARCHAR(32) DEFAULT 'free',
    status VARCHAR(16) DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    max_projects INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 1,
    price_monthly DECIMAL(10,2) DEFAULT 0
);
