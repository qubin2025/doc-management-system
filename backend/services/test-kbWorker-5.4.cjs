/**
 * 5.4 任务保护机制专项测试
 *
 * 测试场景：
 *   1. 失败退避：record_id 不存在 → _processTask 抛错 → retry_count=1, next_run_at=now+30s
 *   2. 优雅退出-空闲：start() 后立即 stop() → 立即 graceful 退出
 *   3. 优雅退出-强制超时：mock 卡死任务 → stop() 等 15s 后强制解锁
 *   4. 内存上限：mock >2MB 文本 → 跳过+告警
 *
 * 注：场景 3/4 通过修改 kbWorker 内部方法实现 mock，验证机制生效。
 */
const path = require('path');
const fs = require('fs');

// 加载 .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  }
}

const Database = require('better-sqlite3');

async function main() {
  const { getDb } = await import('../db.js');
  const db = getDb();

  // 验证 next_run_at 字段已加
  const cols = db.prepare('PRAGMA table_info(kb_sync_queue)').all().map(c => c.name);
  if (!cols.includes('next_run_at')) {
    console.error('❌ 字段 next_run_at 未加，migration 失败');
    process.exit(1);
  }
  console.log('✅ 字段 next_run_at 已存在');

  const e2eProject = 'e2e-5.4-测试项目';
  // 清理旧数据
  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);

  // ========== 场景 1: 失败退避 ==========
  console.log('\n--- 场景 1: 失败退避（record_id=99999 不存在）---');
  db.prepare(
    "INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'daily', '99999', 'upsert', 'pending', 10, 0, 3)"
  ).run(e2eProject);

  const { kbWorker } = await import('./kbWorker.js');
  kbWorker.start();
  // 等待 3 秒让 Worker 处理（任务会失败 → retry）
  await new Promise(r => setTimeout(r, 3000));
  await kbWorker.stop();

  const task1 = db.prepare("SELECT id, status, retry_count, next_run_at, error_msg FROM kb_sync_queue WHERE project_name=? AND record_id='99999'").get(e2eProject);
  console.log('任务状态:', task1);
  if (task1.status !== 'pending' || task1.retry_count !== 1) {
    console.error('❌ 失败退避测试失败：期望 status=pending retry_count=1');
    process.exit(1);
  }
  if (!task1.next_run_at) {
    console.error('❌ 失败退避测试失败：next_run_at 未设置');
    process.exit(1);
  }
  // 验证 next_run_at 大约是 now+30s（允许 ±5s 误差）
  const nextRun = new Date(task1.next_run_at + 'Z').getTime();
  const now = Date.now();
  const diffSec = Math.round((nextRun - now) / 1000);
  console.log(`next_run_at 距今 ${diffSec}s（期望 ~30s）`);
  if (diffSec < 20 || diffSec > 40) {
    console.error('❌ 失败退避时间不对（期望 ~30s）');
    process.exit(1);
  }
  console.log('✅ 场景 1 通过：失败退避 30s 生效');

  // 验证：30s 内任务不被领取
  console.log('\n--- 场景 1b: 验证退避期内任务不被领取 ---');
  kbWorker.start();
  await new Promise(r => setTimeout(r, 3000));
  await kbWorker.stop();
  const task1b = db.prepare("SELECT status, retry_count FROM kb_sync_queue WHERE project_name=? AND record_id='99999'").get(e2eProject);
  console.log('退避期内任务状态:', task1b);
  if (task1b.retry_count !== 1) {
    console.error('❌ 退避期内任务被重新领取了（retry_count 应保持 1）');
    process.exit(1);
  }
  console.log('✅ 场景 1b 通过：退避期内任务未被领取');

  // ========== 场景 2: 优雅退出-空闲 ==========
  console.log('\n--- 场景 2: 优雅退出-空闲（start 后立即 stop）---');
  const t0 = Date.now();
  kbWorker.start();
  await new Promise(r => setTimeout(r, 500));  // 让 Worker 跑一轮
  await kbWorker.stop();
  const stopMs = Date.now() - t0 - 500;
  console.log(`stop() 耗时: ${stopMs}ms（期望 <500ms，因为没有 in-flight 任务）`);
  if (stopMs > 1000) {
    console.error('❌ 空闲退出耗时过长');
    process.exit(1);
  }
  console.log('✅ 场景 2 通过：空闲立即退出');

  // ========== 场景 3: 优雅退出-强制超时 ==========
  console.log('\n--- 场景 3: 优雅退出-强制超时（mock 卡死任务）---');
  // 用 monkey-patch 让 _processTask 永远卡住（模拟嵌入调用卡死）
  const origProcessTask = kbWorker._processTask.bind(kbWorker);
  kbWorker._processTask = async function(task) {
    console.log(`[mock] Task ${task.id} 卡死中（永不返回）...`);
    await new Promise(() => {});  // 永不 resolve
  };

  db.prepare(
    "INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'daily', '88888', 'upsert', 'pending', 5, 0, 3)"
  ).run(e2eProject);

  kbWorker.start();
  await new Promise(r => setTimeout(r, 2000));  // 让 Worker 领取任务并卡住
  const inFlightBefore = kbWorker.inFlightTasks.size;
  console.log(`stop 前 inFlightTasks: ${inFlightBefore}`);
  if (inFlightBefore !== 1) {
    console.error(`❌ 期望 inFlightTasks=1，实际=${inFlightBefore}`);
    process.exit(1);
  }

  const t1 = Date.now();
  await kbWorker.stop();
  const stopMs2 = Date.now() - t1;
  console.log(`stop() 耗时: ${stopMs2}ms（期望 ~15000ms 强制超时）`);
  if (stopMs2 < 14000 || stopMs2 > 17000) {
    console.error(`❌ 强制超时时间不对（期望 ~15s），实际 ${stopMs2}ms`);
    process.exit(1);
  }
  // 验证任务被强制解锁（status 应为 pending）
  const task3 = db.prepare("SELECT status, locked_by, next_run_at FROM kb_sync_queue WHERE project_name=? AND record_id='88888'").get(e2eProject);
  console.log('卡死任务状态:', task3);
  if (task3.status !== 'pending' || task3.locked_by !== null) {
    console.error('❌ 强制解锁失败：任务应为 pending 且 locked_by=NULL');
    process.exit(1);
  }
  if (!task3.next_run_at) {
    console.error('❌ 强制解锁后 next_run_at 应设为 +30s（防止立即重试）');
    process.exit(1);
  }
  console.log('✅ 场景 3 通过：强制超时 15s 后解锁，next_run_at=+30s 防立即重试');

  // 还原 _processTask
  kbWorker._processTask = origProcessTask;

  // ========== 场景 4: 内存上限 ==========
  console.log('\n--- 场景 4: 内存上限（mock >2MB 文本）---');
  // 构造一个 >2MB 的 tasks 字段（写入 daily_reports id=1）
  const bigText = '混凝土浇筑质量验收记录'.repeat(100000);  // ~2.4MB
  const bigSize = Buffer.byteLength(bigText, 'utf8');
  console.log(`构造大文本: ${bigSize} bytes (${(bigSize / 1024 / 1024).toFixed(2)}MB)`);
  db.prepare("UPDATE daily_reports SET tasks=? WHERE id=1").run(bigText);

  db.prepare(
    "INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'daily', '1', 'upsert', 'pending', 1, 0, 3)"
  ).run(e2eProject);

  kbWorker.start();
  await new Promise(r => setTimeout(r, 3000));
  await kbWorker.stop();

  const task4 = db.prepare("SELECT status, error_msg FROM kb_sync_queue WHERE project_name=? AND record_id='1' AND source='daily'").get(e2eProject);
  console.log('大文本任务状态:', task4);
  // 任务应标记为 done（跳过不重试）
  if (task4.status !== 'done') {
    console.error(`❌ 大文本任务应为 done（跳过），实际 status=${task4.status}`);
    process.exit(1);
  }
  // 验证 vector_embeddings 没有该任务的数据（被跳过）
  const vec4 = db.prepare("SELECT COUNT(*) as c FROM vector_embeddings WHERE project=? AND doc_id='daily-1'").get(e2eProject);
  console.log(`大文本任务入库向量数: ${vec4.c}（期望 0）`);
  if (vec4.c !== 0) {
    console.error('❌ 大文本任务不应入库向量');
    process.exit(1);
  }
  console.log('✅ 场景 4 通过：>2MB 文本跳过+告警，任务标记 done');

  // ========== 清理 ==========
  console.log('\n--- 清理 ---');
  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);
  // 还原 daily_reports
  db.prepare("UPDATE daily_reports SET tasks=NULL WHERE id=1").run();
  console.log('✅ 清理完成');

  console.log('\n=== 5.4 任务保护机制测试全部通过 ===');
  console.log('Worker 统计:', JSON.stringify(kbWorker.getStats().stats, null, 2));
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
