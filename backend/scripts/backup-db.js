/**
 * 数据库 + 文件备份脚本
 * 用法: node scripts/backup-db.js
 * cron: 0 2 * * * cd /app/backend && node scripts/backup-db.js
 * 保留: 30 天
 *
 * 环境变量:
 *   DB_PATH              - SQLite 数据库路径（默认 ../data/planning.db）
 *   FILES_PATH           - files 根目录（默认 ../files）
 *   BACKUP_DIR           - 备份根目录（默认 ../backups）
 *   BACKUP_KEEP_DAYS     - 备份保留天数（默认 30）
 *   FEISHU_WEBHOOK_URL   - 飞书告警 webhook (可选)
 *   FEISHU_ALERT_LEVEL   - 告警级别: error(默认)/always/never
 *
 * 退出码:
 *   0 - 成功
 *   1 - 失败（数据库/文件操作错误）
 *   2 - 部分失败（备份完成但清理过期备份失败）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { shouldAlert, sendFeishuAlert, ALERT_HOSTNAME, FEISHU_ALERT_LEVEL } from '../lib/feishuAlert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');
const FILES_PATH = process.env.FILES_PATH || path.join(__dirname, '..', 'files');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP_DAYS = parseInt(process.env.BACKUP_KEEP_DAYS || '30', 10);

const T_START = Date.now();

function log(stage, msg, level = 'info') {
  const ts = new Date().toISOString();
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2) + 's';
  const prefix = level === 'error' ? '✗' : level === 'warn' ? '!' : '✓';
  console.log(`[${ts}][+${elapsed}][${stage}] ${prefix} ${msg}`);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

async function main() {
  log('init', `backup-db v1.1 starting`);
  log('init', `config: DB_PATH=${DB_PATH}`);
  log('init', `config: FILES_PATH=${FILES_PATH}`);
  log('init', `config: BACKUP_DIR=${BACKUP_DIR}`);
  log('init', `config: KEEP_DAYS=${KEEP_DAYS}`);
  log('init', `config: FEISHU_ALERT_LEVEL=${FEISHU_ALERT_LEVEL}`);

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const dateDir = path.join(BACKUP_DIR, date);
  const errors = [];
  let dbSize = 0, filesBackedUp = false, dbBackedUp = false;

  log('check', `backup date: ${date}, target: ${dateDir}`);

  try {
    fs.mkdirSync(dateDir, { recursive: true });
    log('mkdir', `backup directory ready`);
  } catch (e) {
    log('mkdir', `failed: ${e.message}`, 'error');
    return finalize(1, errors, { dbBackedUp, filesBackedUp, dbSize, deleted: 0, total: 0 });
  }

  // 备份数据库
  if (fs.existsSync(DB_PATH)) {
    try {
      const dest = path.join(dateDir, 'planning.db');
      fs.copyFileSync(DB_PATH, dest);
      dbSize = fs.statSync(dest).size;
      dbBackedUp = true;
      log('db', `DB backed up: ${date}/planning.db (${formatSize(dbSize)})`);
    } catch (e) {
      log('db', `DB backup failed: ${e.message}`, 'error');
      errors.push({ name: 'planning.db', reason: e.message });
    }
  } else {
    log('db', `DB not found: ${DB_PATH}`, 'warn');
    errors.push({ name: 'planning.db', reason: 'database file not found' });
  }

  // 备份上传文件
  if (fs.existsSync(FILES_PATH)) {
    try {
      fs.cpSync(FILES_PATH, path.join(dateDir, 'files'), { recursive: true });
      filesBackedUp = true;
      log('files', `Files backed up: ${date}/files`);
    } catch (e) {
      log('files', `Files backup failed: ${e.message}`, 'error');
      errors.push({ name: 'files', reason: e.message });
    }
  } else {
    log('files', `FILES_PATH not found: ${FILES_PATH}`, 'warn');
  }

  // 清理过期备份
  let deleted = 0, total = 0;
  try {
    const dirs = fs.readdirSync(BACKUP_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    total = dirs.length;
    const cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000);
    log('cleanup', `scanning ${total} backup dirs, cutoff: ${cutoff.toISOString().split('T')[0]}`);

    for (const d of dirs) {
      if (new Date(d) < cutoff) {
        fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
        deleted++;
      }
    }

    if (deleted > 0) {
      log('cleanup', `Cleaned ${deleted} old backups (keeping ${KEEP_DAYS} days)`);
    } else {
      log('cleanup', `no old backups to clean`);
    }
    log('cleanup', `total backups remaining: ${total - deleted}`);
  } catch (e) {
    log('cleanup', `cleanup failed: ${e.message}`, 'error');
    errors.push({ name: 'cleanup', reason: e.message });
  }

  const exitCode = errors.length === 0 ? 0 : (dbBackedUp || filesBackedUp ? 2 : 1);
  return finalize(exitCode, errors, { dbBackedUp, filesBackedUp, dbSize, deleted, total: total - deleted });
}

async function finalize(exitCode, errors, stats) {
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2);
  const status = exitCode === 0 ? 'success' : (exitCode === 2 ? 'partial_failed' : 'failed');
  log('done', `backup ${status}, elapsed ${elapsed}s, exit=${exitCode}`);

  const summary = {
    taskName: '数据库备份任务',
    hostname: ALERT_HOSTNAME,
    finishedAt: new Date().toISOString(),
    elapsed: elapsed + 's',
    exitCode,
    status,
    metrics: {
      '数据库备份': stats.dbBackedUp ? `✓ ${formatSize(stats.dbSize)}` : '✗ 失败',
      '文件备份': stats.filesBackedUp ? '✓ 完成' : '✗ 失败',
      '清理过期备份': stats.deleted > 0 ? `✓ 删除 ${stats.deleted} 个` : '✓ 无需清理',
      '当前备份总数': stats.total,
      '错误数': errors.length,
    },
    errorDetails: errors,
    note: `KEEP_DAYS=${KEEP_DAYS} | DB_PATH=${path.basename(DB_PATH)}`,
  };

  if (shouldAlert(summary.status, exitCode)) {
    await sendFeishuAlert(summary, (msg, lvl) => log('alert', msg, lvl));
  }

  process.exit(exitCode);
}

main().catch(async (e) => {
  log('fatal', `uncaught error: ${e.message}`, 'error');
  console.error(e.stack);
  const summary = {
    taskName: '数据库备份任务',
    hostname: ALERT_HOSTNAME,
    finishedAt: new Date().toISOString(),
    elapsed: ((Date.now() - T_START) / 1000).toFixed(2) + 's',
    exitCode: 1,
    status: 'failed',
    metrics: { '错误': e.message },
    errorDetails: [{ name: '(uncaught)', reason: e.message }],
    note: 'uncaught exception',
  };
  if (shouldAlert('failed', 1)) {
    await sendFeishuAlert(summary, (msg, lvl) => log('alert', msg, lvl));
  }
  process.exit(1);
});
