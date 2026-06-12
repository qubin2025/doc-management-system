// 数据库备份脚本 — cron: 0 2 * * 0 node scripts/backup-db.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');
const FILES_PATH = process.env.FILES_PATH || path.join(__dirname, '..', 'files');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const date = new Date().toISOString().split('T')[0];
fs.mkdirSync(path.join(BACKUP_DIR, date), { recursive: true });

// 备份数据库
if (fs.existsSync(DB_PATH)) {
  fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, date, 'planning.db'));
  console.log(`[${new Date().toISOString()}] 数据库已备份: ${date}/planning.db`);
}

// 备份文件目录
if (fs.existsSync(FILES_PATH)) {
  fs.cpSync(FILES_PATH, path.join(BACKUP_DIR, date, 'files'), { recursive: true });
  console.log(`[${new Date().toISOString()}] 文件已备份: ${date}/files`);
}

// 保留最近30天备份，删除更早的
const dirs = fs.readdirSync(BACKUP_DIR).sort();
if (dirs.length > 30) {
  for (const d of dirs.slice(0, dirs.length - 30)) {
    fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
    console.log(`[${new Date().toISOString()}] 清理旧备份: ${d}`);
  }
}
