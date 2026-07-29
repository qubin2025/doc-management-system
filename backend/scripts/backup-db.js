/**
 * 数据库 + 文件备份脚本
 * 用法: node scripts/backup-db.js
 * cron: 0 2 * * * cd /app/backend && node scripts/backup-db.js
 * 保留: 30天
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');
const FILES_PATH = process.env.FILES_PATH || path.join(__dirname, '..', 'files');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP_DAYS = parseInt(process.env.BACKUP_KEEP_DAYS || '30', 10);

const now = new Date();
const date = now.toISOString().split('T')[0];
const dateDir = path.join(BACKUP_DIR, date);

try {
  fs.mkdirSync(dateDir, { recursive: true });

  // 备份数据库
  if (fs.existsSync(DB_PATH)) {
    const dest = path.join(dateDir, 'planning.db');
    fs.copyFileSync(DB_PATH, dest);
    const size = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(`[${now.toISOString()}] DB backed up: ${date}/planning.db (${size} KB)`);
  } else {
    console.warn(`[${now.toISOString()}] DB not found: ${DB_PATH}`);
  }

  // 备份上传文件
  if (fs.existsSync(FILES_PATH)) {
    fs.cpSync(FILES_PATH, path.join(dateDir, 'files'), { recursive: true });
    console.log(`[${now.toISOString()}] Files backed up: ${date}/files`);
  }

  // 清理过期备份
  const dirs = fs.readdirSync(BACKUP_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000);
  let deleted = 0;
  for (const d of dirs) {
    if (new Date(d) < cutoff) {
      fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
      deleted++;
    }
  }
  if (deleted > 0) console.log(`[${now.toISOString()}] Cleaned ${deleted} old backups (keeping ${KEEP_DAYS} days)`);
  console.log(`[${now.toISOString()}] Total backups: ${dirs.length - deleted}`);

} catch (e) {
  console.error(`[${now.toISOString()}] Backup FAILED: ${e.message}`);
  process.exit(1);
}
