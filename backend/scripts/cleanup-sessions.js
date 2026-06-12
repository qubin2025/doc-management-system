// 定时清理过期会话 — cron: 0 3 * * * node scripts/cleanup-sessions.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');

const db = new Database(DB_PATH);
const result = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
console.log(`[${new Date().toISOString()}] 清理过期会话: ${result.changes} 条`);
db.close();
