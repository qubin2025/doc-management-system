/**
 * 数据清理脚本 — 清除测试数据，重置为初始状态
 * 用法: node scripts/clean-test-data.js
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'data', 'planning.db');

console.log(`清理数据库: ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// 清除测试项目（保留 seed 数据中的项目）
const testProjects = db.prepare("SELECT id, name FROM projects WHERE name LIKE '%test%' OR name LIKE '%demo%'").all();
for (const p of testProjects) {
  console.log(`  删除项目: ${p.name}`);
  db.prepare('DELETE FROM projects WHERE id = ?').run(p.id);
}

// 清除测试用户的会话
db.prepare("DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE is_active=1)").run();

// 重置 admin 密码为默认值
const bcrypt = await import('bcrypt');
const defaultHash = bcrypt.hashSync('admin123', 10);
db.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin' OR username = '管理员'").run(defaultHash);

// 清理知识加工产物
db.prepare("DELETE FROM knowledge_artifacts WHERE project_name LIKE '%test%' OR confidence < 0.3").run();

// VACUUM 回收空间
db.exec('VACUUM');

console.log('✓ 数据清理完成');
console.log('  默认账户: admin / admin123');
db.close();
