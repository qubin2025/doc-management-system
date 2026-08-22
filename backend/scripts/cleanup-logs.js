/**
 * 日志清理脚本
 *
 * 功能：删除 logs/ 目录下超过保留天数的日志文件
 * 用法: node scripts/cleanup-logs.js
 * cron: 0 5 * * * cd /app/backend && node scripts/cleanup-logs.js  (每天凌晨5点)
 *
 * 环境变量:
 *   LOG_DIR      - 日志目录（默认 ../logs）
 *   KEEP_DAYS    - 保留天数（默认 30）
 *   DRY_RUN      - 设为 '1' 时只打印不删除
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const KEEP_DAYS = parseInt(process.env.KEEP_DAYS || '30', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

const T_START = Date.now();

function log(stage, msg, level = 'info') {
  const ts = new Date().toISOString();
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2) + 's';
  const prefix = level === 'error' ? '✗' : level === 'warn' ? '!' : level === 'ok' ? '✓' : '→';
  console.log(`[${ts}][+${elapsed}][${stage}] ${prefix} ${msg}`);
}

function main() {
  log('init', `cleanup-logs v1.0 starting`);
  log('init', `config: LOG_DIR=${LOG_DIR}  KEEP_DAYS=${KEEP_DAYS}  DRY_RUN=${DRY_RUN}`);

  if (!fs.existsSync(LOG_DIR)) {
    log('warn', `logs directory not found: ${LOG_DIR}`, 'warn');
    log('done', 'nothing to clean');
    process.exit(0);
  }

  const cutoffTime = Date.now() - (KEEP_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDate = new Date(cutoffTime).toISOString().slice(0, 10);
  log('check', `cutoff date: ${cutoffDate} (files older than this will be deleted)`);

  const files = fs.readdirSync(LOG_DIR);
  const logFiles = files.filter(f => /\.(log|txt)$/i.test(f));

  log('scan', `found ${logFiles.length} log files in ${LOG_DIR}`);

  let deletedCount = 0;
  let deletedSize = 0;
  let keptCount = 0;

  for (const file of logFiles) {
    const filePath = path.join(LOG_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;

      if (mtime < cutoffTime) {
        const sizeKB = (stat.size / 1024).toFixed(1);
        if (DRY_RUN) {
          log('clean', `[DRY_RUN] 将删除: ${file} (${sizeKB} KB, mtime=${new Date(mtime).toISOString().slice(0,10)})`);
        } else {
          fs.unlinkSync(filePath);
          log('clean', `已删除: ${file} (${sizeKB} KB)`, 'ok');
        }
        deletedCount++;
        deletedSize += stat.size;
      } else {
        keptCount++;
      }
    } catch (e) {
      log('clean', `处理文件失败 ${file}: ${e.message}`, 'warn');
    }
  }

  log('done', '═══════════════════════════════════════');
  log('done', `清理完成: 删除 ${deletedCount} 个文件 (${(deletedSize / 1024 / 1024).toFixed(2)} MB), 保留 ${keptCount} 个文件`);
  log('done', `耗时: ${((Date.now() - T_START) / 1000).toFixed(2)}s`);
  log('done', '═══════════════════════════════════════');

  process.exit(0);
}

main();
