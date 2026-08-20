/**
 * 5.7 后端语义检索 API 端到端测试
 *
 * 流程：
 *   1. 登录获取 token
 *   2. 准备测试数据（daily_reports + 队列任务）
 *   3. 启动 Worker 入库向量
 *   4. 等待处理完成
 *   5. 调用 POST /api/kb/search 检索
 *   6. 验证返回结果（score > 0, results.length > 0）
 *   7. 测试 GET /api/kb/search/stats
 *   8. 清理测试数据
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

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

function httpReq(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3000, path: urlPath, method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== 5.7 后端语义检索 API 端到端测试 ===\n');

  // 1. 登录
  console.log('--- 1. 登录 ---');
  const login = await httpReq('POST', '/api/auth/login', null, { username: 'admin', password: 'admin123' });
  if (login.status !== 200 || !login.body.token) {
    console.error('登录失败:', login.status, JSON.stringify(login.body).slice(0, 200));
    process.exit(1);
  }
  const token = login.body.token;
  console.log('登录成功');

  // 2. 准备测试数据
  console.log('\n--- 2. 准备测试数据 ---');
  const { getDb } = await import('../db.js');
  const db = getDb();
  const e2eProject = 'e2e-5.7-搜索测试';

  // 清理旧数据
  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);

  // 更新 daily_reports id=1 为有意义的测试文本
  db.prepare("UPDATE daily_reports SET tasks=?, quality_risks=?, issues=?, notes=?, original_text=? WHERE id=1").run(
    '今日完成主体结构混凝土浇筑500立方米，钢筋绑扎800吨，模板支设1200平方米。',
    '风险1：混凝土浇筑温度偏高，需加强养护。风险2：钢筋保护层厚度偏差，已要求整改。',
    '问题1：3号楼地下室渗水，约20cm积水。问题2：塔吊基础沉降报警。',
    '备注：今日施工顺利，明日计划继续浇筑。',
    '原文：本日施工记录完整，各项指标达标。'
  );

  // 插入队列任务
  db.prepare(
    "INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'daily', '1', 'upsert', 'pending', 10, 0, 2)"
  ).run(e2eProject);

  console.log('测试数据准备完成');

  // 3. 启动 Worker 处理
  console.log('\n--- 3. 启动 Worker 入库向量 ---');
  const startResp = await httpReq('POST', '/api/kb/worker/start', token);
  console.log('Worker 启动:', startResp.body.action, startResp.body.message);

  // 4. 等待处理完成（最多 15s）
  console.log('\n--- 4. 等待 Worker 处理完成 ---');
  let processed = false;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusResp = await httpReq('GET', '/api/kb/worker/status', token);
    const queue = statusResp.body.queue || {};
    const done = queue.done || 0;
    const pending = queue.pending || 0;
    console.log(`  [${i+1}s] done=${done} pending=${pending} inFlight=${statusResp.body.worker.inFlightTasks}`);
    if (done > 0 && pending === 0 && statusResp.body.worker.inFlightTasks === 0) {
      processed = true;
      break;
    }
  }
  if (!processed) {
    console.error('❌ Worker 未在 15s 内完成处理');
    process.exit(1);
  }
  console.log('✅ Worker 处理完成');

  // 5. 验证 vector_embeddings 有数据
  console.log('\n--- 5. 验证向量数据 ---');
  const vecCount = db.prepare("SELECT COUNT(*) as c FROM vector_embeddings WHERE project=?").get(e2eProject).c;
  console.log(`vector_embeddings: ${vecCount} 条`);
  if (vecCount === 0) {
    console.error('❌ 没有向量数据');
    process.exit(1);
  }
  console.log('✅ 向量数据存在');

  // 6. 调用 POST /api/kb/search 检索
  console.log('\n--- 6. POST /api/kb/search 语义检索 ---');
  // 先 embed 查询文本
  const { embedText } = await import('./embeddingService.js');
  const queryEmbed = await embedText('混凝土浇筑质量', 'query');
  console.log(`查询向量维度: ${queryEmbed.length}`);

  const searchResp = await httpReq('POST', '/api/kb/search', token, {
    queryEmbedding: queryEmbed,
    topK: 5,
  });
  console.log('HTTP', searchResp.status);
  console.log('results:', searchResp.body.total, '条');
  console.log('query:', JSON.stringify(searchResp.body.query));

  if (searchResp.status !== 200 || !searchResp.body.success) {
    console.error('❌ 检索失败:', JSON.stringify(searchResp.body).slice(0, 200));
    process.exit(1);
  }
  if (searchResp.body.total === 0) {
    console.error('❌ 检索结果为空');
    process.exit(1);
  }

  // 验证结果有 score 且 > 0
  const results = searchResp.body.results;
  console.log('\nTop-5 检索结果:');
  for (const r of results) {
    console.log(`  score=${r.score.toFixed(4)} | ${r.docName} | ${r.text.slice(0, 50)}...`);
  }
  if (results[0].score <= 0) {
    console.error('❌ 最高分 score 应 > 0');
    process.exit(1);
  }
  console.log('✅ 检索成功，Top-1 score=' + results[0].score.toFixed(4));

  // 7. 测试项目过滤
  console.log('\n--- 7. 按项目过滤检索 ---');
  const searchProjResp = await httpReq('POST', '/api/kb/search', token, {
    queryEmbedding: queryEmbed,
    project: e2eProject,
    topK: 3,
  });
  console.log(`project=${e2eProject}: ${searchProjResp.body.total} 条`);
  if (searchProjResp.body.total === 0) {
    console.error('❌ 项目过滤检索结果为空');
    process.exit(1);
  }
  // 验证所有结果都属于该项目
  const allMatch = searchProjResp.body.results.every(r => r.project === e2eProject);
  if (!allMatch) {
    console.error('❌ 项目过滤失败：结果包含其他项目的数据');
    process.exit(1);
  }
  console.log('✅ 项目过滤正确，所有结果属于 ' + e2eProject);

  // 8. 测试 GET /api/kb/search/stats
  console.log('\n--- 8. GET /api/kb/search/stats ---');
  const statsResp = await httpReq('GET', '/api/kb/search/stats', token);
  console.log('totalVectors:', statsResp.body.totalVectors);
  console.log('projects:', JSON.stringify(statsResp.body.projects));
  console.log('bySensitivity:', JSON.stringify(statsResp.body.bySensitivity));
  if (statsResp.status !== 200 || !statsResp.body.success) {
    console.error('❌ 统计查询失败');
    process.exit(1);
  }
  if (statsResp.body.totalVectors < vecCount) {
    console.error('❌ 统计的向量总数不应少于测试向量数');
    process.exit(1);
  }
  console.log('✅ 统计查询正确');

  // 9. 停止 Worker
  console.log('\n--- 9. 停止 Worker ---');
  const stopResp = await httpReq('POST', '/api/kb/worker/stop', token);
  console.log('Worker:', stopResp.body.action, stopResp.body.message);

  // 10. 清理测试数据
  console.log('\n--- 10. 清理 ---');
  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);
  db.prepare("UPDATE daily_reports SET tasks=NULL, quality_risks=NULL, issues=NULL, notes=NULL, original_text=NULL WHERE id=1").run();
  console.log('✅ 清理完成');

  console.log('\n=== 5.7 后端语义检索 API 测试全部通过 ===');
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
