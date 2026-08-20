/**
 * 5.3 端到端验证
 * 使用 getDb() 统一连接，避免 WAL 模式可见性问题
 */
const path = require('path');
const fs = require('fs');

// 加载 backend/.env
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
  console.log(`[准备] 已加载 .env, DASHSCOPE_API_KEY=${process.env.DASHSCOPE_API_KEY ? process.env.DASHSCOPE_API_KEY.slice(0, 10) + '***' : '未配置'}`);
}

async function main() {
  // 先用 better-sqlite3 直接查询（不通过 getDb）
  const Database = require('better-sqlite3');
  const directDb = new Database(path.resolve(__dirname, '../data/planning.db'), { readonly: true });
  console.log('[直接查询] daily_reports:', directDb.prepare('SELECT COUNT(*) as c FROM daily_reports').get().c, '条');
  directDb.close();

  const { getDb } = await import('../db.js');
  const db = getDb();

  // getDb 后再查
  console.log('[getDb 后] daily_reports:', db.prepare('SELECT COUNT(*) as c FROM daily_reports').get().c, '条');
  const dbInfo = db.prepare("PRAGMA database_list").all();
  console.log('[getDb 后] database_list:', dbInfo);
  const journalMode = db.prepare("PRAGMA journal_mode").get();
  console.log('[getDb 后] journal_mode:', journalMode);

  const e2eProject = 'e2e-测试项目';

  // 1. 清理旧测试任务和向量
  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);

  // 2. 准备测试数据（用真实业务记录 id=1）
  db.prepare("UPDATE daily_reports SET tasks=?, quality_risks=?, issues=?, notes=?, original_text=? WHERE id=1")
    .run(
      '今日完成主体结构混凝土浇筑500立方米，钢筋绑扎800吨，模板支设1200平方米。',
      '风险1：混凝土浇筑温度偏高，需加强养护。风险2：钢筋保护层厚度偏差，已要求整改。',
      '问题1：3号楼地下室渗水，约20cm积水。问题2：塔吊基础沉降报警。',
      '备注：今日施工顺利，明日计划继续浇筑。',
      '原文：本日施工记录完整，各项指标达标。'
    );
  db.prepare("UPDATE mobile_issues SET title=?, description=?, severity=? WHERE id=1")
    .run('e2e-测试问题-3号楼渗水', '3号楼地下室出现渗水情况，积水深度约20cm，需立即处理。', 'critical');

  // 3. 插入 kb_sync_queue 任务
  db.prepare(
    "INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'daily', '1', 'upsert', 'pending', 10, 0, 2)"
  ).run(e2eProject);
  db.prepare(
    "INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'issue', '1', 'upsert', 'pending', 8, 0, 2)"
  ).run(e2eProject);
  const tasks = db.prepare("SELECT id, source, record_id, status FROM kb_sync_queue WHERE project_name=?").all(e2eProject);
  console.log(`[准备] 插入 ${tasks.length} 条任务:`, tasks);

  // 4. 启动 Worker
  const { kbWorker } = await import('./kbWorker.js');
  console.log('\n--- 启动 Worker ---');

  // 验证业务记录可见
  const drCount = db.prepare("SELECT COUNT(*) as c FROM daily_reports").get();
  console.log(`[验证] daily_reports 总数: ${drCount.c}`);
  const drCheck = db.prepare("SELECT id, tasks FROM daily_reports WHERE id=?").get(1);
  console.log('[验证] daily_reports id=1:', drCheck ? `存在, tasks=${drCheck.tasks?.slice(0,40)}` : '不存在');
  const miCheck = db.prepare("SELECT id, title FROM mobile_issues WHERE id=?").get(1);
  console.log('[验证] mobile_issues id=1:', miCheck ? `存在, title=${miCheck.title}` : '不存在');

  kbWorker.start();

  // 等待 12 秒（嵌入需要时间）
  await new Promise(r => setTimeout(r, 12000));

  console.log('\n--- 停止 Worker ---');
  await kbWorker.stop();

  // 5. 验证 vector_embeddings
  const vecCount = db.prepare("SELECT COUNT(*) as c FROM vector_embeddings WHERE project=?").get(e2eProject);
  console.log(`\n--- 验证 ---`);
  console.log(`vector_embeddings 表 (${e2eProject}): ${vecCount.c} 条`);

  if (vecCount.c > 0) {
    const samples = db.prepare("SELECT id, doc_id, doc_name, chunk_index, dimension, sensitivity, substr(text,1,80) as text_preview, metadata FROM vector_embeddings WHERE project=? LIMIT 3").all(e2eProject);
    console.log('\n样本数据:');
    for (const s of samples) {
      console.log(`  [${s.id}] dim=${s.dimension} sens=${s.sensitivity}`);
      console.log(`    doc: ${s.doc_name} chunk=${s.chunk_index}`);
      console.log(`    text: ${s.text_preview}...`);
      console.log(`    meta: ${s.metadata}`);
    }
  }

  const queueStatus = db.prepare("SELECT status, COUNT(*) as c FROM kb_sync_queue WHERE project_name=? GROUP BY status").all(e2eProject);
  console.log('\n队列状态:', queueStatus);

  console.log('\n--- Worker 统计 ---');
  console.log(JSON.stringify(kbWorker.getStats(), null, 2));

  // 6. 清理测试数据
  const cleanedQ = db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  const cleanedV = db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);
  console.log(`\n[清理] 删除任务 ${cleanedQ.changes} 条，向量 ${cleanedV.changes} 条`);

  // 还原数据
  db.prepare("UPDATE daily_reports SET tasks=NULL, quality_risks=NULL, issues=NULL, notes=NULL, original_text=NULL WHERE id=1").run();
  db.prepare("UPDATE mobile_issues SET title='3号楼地下室渗水', description='地下室出现渗水情况，积水深度约20cm，需立即处理。', severity='critical' WHERE id=1").run();
  console.log('[清理] 还原 daily_reports/mobile_issues 数据');
}

main().catch(err => {
  console.error('验证失败:', err);
  process.exit(1);
});
