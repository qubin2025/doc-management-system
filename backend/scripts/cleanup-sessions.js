/**
 * 定时清理过期会话
 *
 * 用法: node scripts/cleanup-sessions.js
 * cron: 0 3 * * * cd /app/backend && node scripts/cleanup-sessions.js
 *
 * 环境变量:
 *   DB_PATH              - SQLite 数据库路径（默认 ../data/planning.db）
 *   FEISHU_WEBHOOK_URL   - 飞书告警 webhook (可选)
 *   FEISHU_ALERT_LEVEL   - 告警级别: error(默认)/always/never
 *
 * 退出码:
 *   0 - 成功
 *   1 - 失败（数据库错误）
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { shouldAlert, sendFeishuAlert, ALERT_HOSTNAME, FEISHU_ALERT_LEVEL } from '../lib/feishuAlert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');

const T_START = Date.now();

function log(stage, msg, level = 'info') {
  const ts = new Date().toISOString();
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2) + 's';
  const prefix = level === 'error' ? '✗' : level === 'warn' ? '!' : '✓';
  console.log(`[${ts}][+${elapsed}][${stage}] ${prefix} ${msg}`);
}

async function main() {
  log('init', `cleanup-sessions v1.1 starting`);
  log('init', `config: DB_PATH=${DB_PATH}`);
  log('init', `config: FEISHU_ALERT_LEVEL=${FEISHU_ALERT_LEVEL}`);

  let db;
  let deleted = 0;
  let beforeCount = 0;
  const errors = [];

  try {
    db = new Database(DB_PATH, { readonly: false });

    // 清理前统计
    const stats = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE expires_at < datetime('now')").get();
    beforeCount = stats?.c || 0;
    log('check', `expired sessions to clean: ${beforeCount}`);

    const result = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    deleted = result.changes;
    log('delete', `deleted ${deleted} expired sessions`);

    // 清理后剩余会话数
    const remaining = db.prepare("SELECT COUNT(*) as c FROM sessions").get();
    log('check', `remaining sessions: ${remaining?.c || 0}`);

    db.close();
    return finalize(0, errors, { beforeCount, deleted, remaining: remaining?.c || 0 });
  } catch (e) {
    log('fatal', `cleanup failed: ${e.message}`, 'error');
    errors.push({ name: 'sessions', reason: e.message });
    if (db) {
      try { db.close(); } catch {}
    }
    return finalize(1, errors, { beforeCount, deleted, remaining: -1 });
  }
}

async function finalize(exitCode, errors, stats) {
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2);
  const status = exitCode === 0 ? 'success' : 'failed';
  log('done', `cleanup ${status}, elapsed ${elapsed}s, exit=${exitCode}`);

  const summary = {
    taskName: '会话清理任务',
    hostname: ALERT_HOSTNAME,
    finishedAt: new Date().toISOString(),
    elapsed: elapsed + 's',
    exitCode,
    status,
    metrics: {
      '过期会话数': stats.beforeCount,
      '已删除': stats.deleted,
      '剩余总会话': stats.remaining < 0 ? '查询失败' : stats.remaining,
      '错误数': errors.length,
    },
    errorDetails: errors,
    note: `DB_PATH=${path.basename(DB_PATH)}`,
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
    taskName: '会话清理任务',
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
