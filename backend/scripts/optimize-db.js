/**
 * 数据库性能优化脚本
 *
 * 功能：
 *   1. 添加缺失的高频查询索引
 *   2. 清理重复/冗余索引
 *   3. VACUUM（回收空间、整理碎片）
 *   4. ANALYZE（更新查询优化器统计信息）
 *
 * 用法: node scripts/optimize-db.js
 * cron: 0 1 * * 0 cd /app/backend && node scripts/optimize-db.js  (每周日凌晨1点)
 *
 * 环境变量:
 *   DB_PATH  - SQLite 数据库路径（默认 ../data/planning.db）
 *   DRY_RUN  - 设为 '1' 时只打印计划不执行
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');
const DRY_RUN = process.env.DRY_RUN === '1';

const T_START = Date.now();

function log(stage, msg, level = 'info') {
  const ts = new Date().toISOString();
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2) + 's';
  const prefix = level === 'error' ? '✗' : level === 'warn' ? '!' : level === 'ok' ? '✓' : '→';
  console.log(`[${ts}][+${elapsed}][${stage}] ${prefix} ${msg}`);
}

async function main() {
  log('init', `optimize-db v1.0 starting`);
  log('init', `config: DB_PATH=${DB_PATH}  DRY_RUN=${DRY_RUN}`);

  if (!fs.existsSync(DB_PATH)) {
    log('fatal', `database not found: ${DB_PATH}`, 'error');
    process.exit(1);
  }

  const dbSizeBefore = fs.statSync(DB_PATH).size;
  log('check', `database size before: ${(dbSizeBefore / 1024 / 1024).toFixed(2)} MB`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // ═══════════════════════════════════════════════════════════
  // 1. 添加缺失的高频查询索引
  // ═══════════════════════════════════════════════════════════
  log('phase', '1/4: 添加缺失索引');

  const missingIndexes = [
    // users: 登录查询高频
    { name: 'idx_users_username', sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)' },
    // sessions: 过期清理查询
    { name: 'idx_sessions_expires', sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)' },
    // contracts: 按项目查询
    { name: 'idx_contracts_project', sql: 'CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_name)' },
    { name: 'idx_contracts_type', sql: 'CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type)' },
    { name: 'idx_contracts_date', sql: 'CREATE INDEX IF NOT EXISTS idx_contracts_sign_date ON contracts(sign_date)' },
    // stakeholders: 按项目查询
    { name: 'idx_stakeholders_project', sql: 'CREATE INDEX IF NOT EXISTS idx_stakeholders_project ON stakeholders(project_name)' },
    // guide_forms: 按项目+章节查询
    { name: 'idx_guide_forms_project_chapter', sql: 'CREATE INDEX IF NOT EXISTS idx_guide_forms_project_chapter ON guide_forms(project_name, chapter_id)' },
    // project_experiences: 按项目+分类查询
    { name: 'idx_experiences_project_category', sql: 'CREATE INDEX IF NOT EXISTS idx_experiences_project_category ON project_experiences(project_name, category)' },
    // mobile_issues: 按项目+状态查询
    { name: 'idx_mobile_issues_project_status', sql: 'CREATE INDEX IF NOT EXISTS idx_mobile_issues_project_status ON mobile_issues(project_id, status)' },
    // guide_progress: 按项目查询
    { name: 'idx_guide_progress_project', sql: 'CREATE INDEX IF NOT EXISTS idx_guide_progress_project ON guide_progress(project_name)' },
    // project_config: 已有 project_name 和 (project_name, config_type)，无需重复
  ];

  let addedCount = 0;
  for (const idx of missingIndexes) {
    try {
      if (DRY_RUN) {
        log('index', `[DRY_RUN] 将创建: ${idx.name}`);
      } else {
        db.exec(idx.sql);
        log('index', `已创建索引: ${idx.name}`, 'ok');
      }
      addedCount++;
    } catch (e) {
      log('index', `创建索引失败 ${idx.name}: ${e.message}`, 'warn');
    }
  }
  log('phase', `索引添加完成: ${addedCount} 个`);

  // ═══════════════════════════════════════════════════════════
  // 2. 清理重复/冗余索引
  // ═══════════════════════════════════════════════════════════
  log('phase', '2/4: 清理重复索引');

  const duplicateIndexes = [
    // daily_* 表有重复的 report_date 索引
    { name: 'idx_dm_d', table: 'daily_machinery', reason: '与 idx_dm_date 重复 (都是 report_date)' },
    { name: 'idx_dp_d', table: 'daily_progress', reason: '与 idx_dp_date 重复 (都是 report_date)' },
    { name: 'idx_dr_d', table: 'daily_risks', reason: '与 idx_dr_date 重复 (都是 report_date)' },
    { name: 'idx_dw_d', table: 'daily_workers', reason: '与 idx_dw_date 重复 (都是 report_date)' },
    // vector_embeddings 有重复的 (project, sensitivity) 索引
    { name: 'idx_vec_proj_sens', table: 'vector_embeddings', reason: '与 idx_vec_sens 重复 (都是 project, sensitivity)' },
  ];

  let droppedCount = 0;
  for (const idx of duplicateIndexes) {
    try {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(idx.name);
      if (exists) {
        if (DRY_RUN) {
          log('index', `[DRY_RUN] 将删除重复索引: ${idx.name} (${idx.reason})`);
        } else {
          db.exec(`DROP INDEX IF EXISTS "${idx.name}"`);
          log('index', `已删除重复索引: ${idx.name} (${idx.reason})`, 'ok');
        }
        droppedCount++;
      }
    } catch (e) {
      log('index', `删除索引失败 ${idx.name}: ${e.message}`, 'warn');
    }
  }
  log('phase', `重复索引清理完成: ${droppedCount} 个`);

  // ═══════════════════════════════════════════════════════════
  // 3. ANALYZE（更新查询优化器统计信息）
  // ═══════════════════════════════════════════════════════════
  log('phase', '3/4: ANALYZE（更新统计信息）');
  if (!DRY_RUN) {
    db.exec('ANALYZE');
    log('analyze', '统计信息已更新', 'ok');
  } else {
    log('analyze', '[DRY_RUN] 跳过 ANALYZE');
  }

  // ═══════════════════════════════════════════════════════════
  // 4. VACUUM（回收空间、整理碎片）
  // ═══════════════════════════════════════════════════════════
  log('phase', '4/4: VACUUM（回收空间）');
  if (!DRY_RUN) {
    // VACUUM 前需要 checkpoint，确保 WAL 内容合并到主库
    log('vacuum', '执行 WAL checkpoint...');
    db.pragma('wal_checkpoint(TRUNCATE)');
    log('vacuum', 'Checkpoint 完成', 'ok');

    log('vacuum', '执行 VACUUM（大库可能需要几秒）...');
    db.exec('VACUUM');
    log('vacuum', 'VACUUM 完成', 'ok');
  } else {
    log('vacuum', '[DRY_RUN] 跳过 VACUUM');
  }

  // ═══════════════════════════════════════════════════════════
  // 完成统计
  // ═══════════════════════════════════════════════════════════
  const dbSizeAfter = fs.statSync(DB_PATH).size;
  const savedBytes = dbSizeBefore - dbSizeAfter;
  const savedPct = dbSizeBefore > 0 ? ((savedBytes / dbSizeBefore) * 100).toFixed(1) : '0';

  log('done', '═══════════════════════════════════════');
  log('done', `优化完成: 新增索引 ${addedCount} 个, 清理重复索引 ${droppedCount} 个`);
  log('done', `数据库大小: ${(dbSizeBefore / 1024 / 1024).toFixed(2)} MB → ${(dbSizeAfter / 1024 / 1024).toFixed(2)} MB (节省 ${(savedBytes / 1024).toFixed(1)} KB, ${savedPct}%)`);
  log('done', `耗时: ${((Date.now() - T_START) / 1000).toFixed(2)}s`);
  log('done', '═══════════════════════════════════════');

  db.close();
  process.exit(0);
}

main().catch(e => {
  log('fatal', `uncaught error: ${e.message}`, 'error');
  console.error(e.stack);
  process.exit(1);
});
