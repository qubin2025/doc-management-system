/**
 * 定期清理日报上传临时文件
 *
 * 用法: node scripts/cleanup-daily-uploads.js
 * cron: 0 4 * * * cd /app/backend && node scripts/cleanup-daily-uploads.js
 *
 * 环境变量:
 *   FILES_PATH              - files 根目录（默认 ../files）
 *   KEEP_DAYS               - 保留天数（默认 7）
 *   DRY_RUN=1               - 预演模式，只打印不删除
 *   FEISHU_WEBHOOK_URL      - 飞书告警 webhook (可选，未配置则跳过)
 *   FEISHU_ALERT_LEVEL      - 告警触发级别: error(默认)/always/never
 *   ALERT_HOSTNAME          - 告警显示的主机名 (默认 os.hostname)
 *
 * 退出码:
 *   0 - 成功
 *   1 - 致命错误（目录读取失败等）
 *   2 - 部分文件删除失败（见 errors 统计）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { shouldAlert, sendFeishuAlert, FEISHU_ALERT_LEVEL, ALERT_HOSTNAME } from '../lib/feishuAlert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_PATH = process.env.FILES_PATH || path.join(__dirname, '..', 'files');
const DAILY_DIR = path.join(FILES_PATH, 'daily-uploads');
const KEEP_DAYS = parseInt(process.env.KEEP_DAYS || '7', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

const DAILY_FILENAME_RE = /^daily-\d+-[a-z0-9]+\.[a-z0-9]+$/i;
const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png',
  '.dwg', '.zip', '.rar',
  '.txt', '.csv',
]);

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
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function ageBucket(ms) {
  const days = ms / 86400000;
  if (days < 1) return '<1d';
  if (days < 3) return '1-3d';
  if (days < 7) return '3-7d';
  if (days < 14) return '7-14d';
  if (days < 30) return '14-30d';
  return '30d+';
}

function buildSummary(scanned, deleted, skipped, freed, errors, exitCode) {
  return {
    taskName: '日报清理任务',
    hostname: ALERT_HOSTNAME,
    finishedAt: new Date().toISOString(),
    elapsed: ((Date.now() - T_START) / 1000).toFixed(2) + 's',
    exitCode,
    metrics: {
      '扫描文件数': scanned,
      '删除文件数': deleted,
      '跳过文件数': skipped,
      '释放空间': formatSize(freed),
      '错误数': errors.length,
    },
    errorDetails: errors,
    status: exitCode === 0 ? 'success' : (exitCode === 2 ? 'partial_failed' : 'failed'),
    note: `KEEP_DAYS=${KEEP_DAYS} | DRY_RUN=${DRY_RUN}`,
  };
}

async function main() {
  log('init', `daily-uploads cleanup v1.1 starting`);
  log('init', `config: FILES_PATH=${FILES_PATH}`);
  log('init', `config: DAILY_DIR=${DAILY_DIR}`);
  log('init', `config: KEEP_DAYS=${KEEP_DAYS}`);
  log('init', `config: DRY_RUN=${DRY_RUN}`);
  log('init', `config: ALLOWED_EXT=${[...ALLOWED_EXT].join(',')}`);
  log('init', `config: FEISHU_ALERT_LEVEL=${FEISHU_ALERT_LEVEL}`);

  const now = Date.now();
  const cutoff = now - KEEP_DAYS * 86400000;
  log('check', `cutoff timestamp: ${cutoff} (${new Date(cutoff).toISOString()})`);

  if (!fs.existsSync(DAILY_DIR)) {
    log('check', `daily-uploads directory not found, nothing to do`, 'warn');
    return finalize(0, 0, 0, 0, 0, []);
  }

  let files;
  try {
    files = fs.readdirSync(DAILY_DIR, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name);
    log('scan', `readdir ok, found ${files.length} entries`);
  } catch (e) {
    log('scan', `readdir failed: ${e.message}`, 'error');
    return finalize(0, 0, 0, 0, 1, [{ name: '(readdir)', reason: e.message }]);
  }

  let scanned = 0, deleted = 0, skipped = 0, freed = 0;
  let skippedName = 0, skippedExt = 0, skippedFresh = 0;
  const errors = [];
  const ageBuckets = {};

  log('loop', `start iterating ${files.length} files`);

  for (const name of files) {
    scanned++;

    if (!DAILY_FILENAME_RE.test(name)) {
      skippedName++; skipped++;
      if (scanned <= 5 || scanned % 50 === 0) log('loop', `#${scanned} skip(non-matching name): ${name}`, 'warn');
      continue;
    }

    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      skippedExt++; skipped++;
      if (scanned <= 5 || scanned % 50 === 0) log('loop', `#${scanned} skip(ext ${ext}): ${name}`, 'warn');
      continue;
    }

    const fp = path.join(DAILY_DIR, name);
    const resolved = path.resolve(fp);
    if (!resolved.startsWith(DAILY_DIR + path.sep)) {
      errors.push({ name, reason: 'path escape', stage: 'path-check' });
      log('loop', `#${scanned} PATH ESCAPE: ${name} -> ${resolved}`, 'error');
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(fp);
    } catch (e) {
      errors.push({ name, reason: `stat failed: ${e.message}`, stage: 'stat' });
      log('loop', `#${scanned} stat failed: ${name} - ${e.message}`, 'error');
      continue;
    }

    const bucket = ageBucket(now - stat.mtimeMs);
    ageBuckets[bucket] = ageBuckets[bucket] || { count: 0, size: 0 };
    ageBuckets[bucket].count++;
    ageBuckets[bucket].size += stat.size;

    if (stat.mtimeMs > cutoff) {
      skippedFresh++; skipped++;
      continue;
    }

    const ageDays = ((now - stat.mtimeMs) / 86400000).toFixed(1);
    const action = DRY_RUN ? '[DRY-RUN] would delete' : 'deleting';
    log('loop', `#${scanned} ${action}: ${name} (${formatSize(stat.size)}, ${ageDays}d old, mtime=${new Date(stat.mtimeMs).toISOString()})`);

    if (DRY_RUN) {
      deleted++; freed += stat.size;
      continue;
    }

    try {
      fs.unlinkSync(fp);
      deleted++;
      freed += stat.size;
    } catch (e) {
      errors.push({ name, reason: `delete failed: ${e.message}`, stage: 'unlink' });
      log('loop', `#${scanned} unlink failed: ${name} - ${e.message}`, 'error');
    }
  }

  log('summary', `scan complete`);
  log('summary', `  scanned:     ${scanned}`);
  log('summary', `  deleted:     ${deleted}`);
  log('summary', `  skipped:     ${skipped} (name=${skippedName}, ext=${skippedExt}, fresh=${skippedFresh})`);
  log('summary', `  freed:       ${formatSize(freed)}`);
  log('summary', `  errors:      ${errors.length}`);
  log('summary', `  age distribution:`);
  for (const b of ['<1d', '1-3d', '3-7d', '7-14d', '14-30d', '30d+']) {
    if (ageBuckets[b]) log('summary', `    ${b.padEnd(8)}: ${ageBuckets[b].count} files, ${formatSize(ageBuckets[b].size)}`);
  }

  if (errors.length > 0) {
    log('summary', `  error details:`);
    for (const e of errors.slice(0, 20)) log('summary', `    - ${e.name} [${e.stage}]: ${e.reason}`, 'error');
    if (errors.length > 20) log('summary', `    ... and ${errors.length - 20} more errors`, 'warn');
  }

  const exitCode = (errors.length > 0 && !DRY_RUN) ? 2 : 0;
  return finalize(scanned, deleted, skipped, freed, exitCode, errors);
}

async function finalize(scanned, deleted, skipped, freed, exitCode, errors) {
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2);
  log('done', `cleanup ${exitCode === 0 ? 'success' : (exitCode === 2 ? 'partial_failed' : 'failed')}, elapsed ${elapsed}s, exit=${exitCode}`);

  const summary = buildSummary(scanned, deleted, skipped, freed, errors, exitCode);
  if (shouldAlert(summary.status, exitCode)) {
    await sendFeishuAlert(summary, (msg, lvl) => log('alert', msg, lvl));
  }
  process.exit(exitCode);
}

main().catch(async (e) => {
  log('fatal', `uncaught error: ${e.message}`, 'error');
  console.error(e.stack);
  const summary = buildSummary(0, 0, 0, 0, 1, [{ name: '(uncaught)', reason: e.message }]);
  summary.exitCode = 1;
  summary.status = 'failed';
  if (shouldAlert(summary.status, 1)) {
    await sendFeishuAlert(summary, (msg, lvl) => log('alert', msg, lvl));
  }
  process.exit(1);
});
