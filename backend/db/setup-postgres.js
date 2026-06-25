/**
 * SQLite → PostgreSQL 迁移执行脚本
 * 用法: node backend/db/setup-postgres.js
 * 需要: PG_CONNECTION_STRING 环境变量
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connStr = process.env.PG_CONNECTION_STRING || 'postgresql://postgres:postgres@localhost:5432/doc_mgmt';

async function migrate() {
  console.log('开始 PostgreSQL 迁移...');
  const client = new pg.Client({ connectionString: connStr });
  await client.connect();

  // 执行迁移SQL
  const sql = fs.readFileSync(path.join(__dirname, 'migrate-to-postgres.sql'), 'utf-8');
  await client.query(sql);
  console.log('✅ 表结构创建完成');

  // 从 SQLite 导入数据
  try {
    const Database = (await import('better-sqlite3')).default;
    const sqlite = new Database(path.join(__dirname, '..', 'data', 'planning.db'));

    // 用户
    const users = sqlite.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await client.query('INSERT INTO users (username, password_hash, display_name, role, is_active) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING',
        [u.username, u.password_hash, u.username, u.role, u.is_active]);
    }
    console.log(`  ✓ ${users.length} 用户`);

    // 项目
    const projects = sqlite.prepare('SELECT * FROM projects').all();
    for (const p of projects) {
      await client.query('INSERT INTO projects (name, created_at) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [p.name, p.created_at]);
    }
    console.log(`  ✓ ${projects.length} 项目`);

    sqlite.close();
  } catch (e) {
    console.log('  ⚠ SQLite数据导入跳过:', e.message.slice(0, 60));
  }

  await client.end();
  console.log('✅ PostgreSQL 迁移完成！');
}

migrate().catch(e => { console.error('❌ 迁移失败:', e.message); process.exit(1); });
