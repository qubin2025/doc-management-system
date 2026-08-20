/**
 * 5.9 混合检索端到端测试
 *
 * 流程：
 *   1. 登录
 *   2. 准备测试数据 + 启动 Worker 入库（同时同步 FTS5）
 *   3. 重建 FTS5 索引（确保一致性）
 *   4. 测试纯 BM25 检索
 *   5. 测试纯向量检索
 *   6. 测试混合检索（向量 + BM25 融合）
 *   7. 验证融合效果
 *   8. 清理
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

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
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    };
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); } catch { resolve({ status: res.statusCode, body: chunks }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== 5.9 混合检索端到端测试 ===\n');

  // 1. 登录
  const login = await httpReq('POST', '/api/auth/login', null, { username: 'admin', password: 'admin123' });
  const token = login.body.token;
  console.log('✅ 登录成功');

  // 2. 准备测试数据
  const { getDb } = await import('../db.js');
  const { embedText } = await import('./embeddingService.js');
  const db = getDb();
  const e2eProject = 'e2e-5.9-混合检索';

  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings_fts WHERE external_id LIKE 'daily-1-%'").run();

  db.prepare("UPDATE daily_reports SET tasks=?, quality_risks=?, issues=?, notes=?, original_text=? WHERE id=1").run(
    '今日完成主体结构混凝土浇筑500立方米，钢筋绑扎800吨，模板支设1200平方米。',
    '风险1：混凝土浇筑温度偏高，需加强养护。风险2：钢筋保护层厚度偏差，已要求整改。',
    '问题1：3号楼地下室渗水，约20cm积水。问题2：塔吊基础沉降报警。',
    '备注：今日施工顺利，明日计划继续浇筑。',
    '原文：本日施工记录完整，各项指标达标。'
  );

  db.prepare("INSERT INTO kb_sync_queue (project_name, source, record_id, action, status, priority, retry_count, max_retries) VALUES (?, 'daily', '1', 'upsert', 'pending', 10, 0, 2)").run(e2eProject);
  console.log('✅ 测试数据准备完成');

  // 3. 启动 Worker 入库
  await httpReq('POST', '/api/kb/worker/start', token);
  console.log('Worker 已启动，等待处理...');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const s = await httpReq('GET', '/api/kb/worker/status', token);
    const q = s.body.queue || {};
    if ((q.done || 0) > 0 && (q.pending || 0) === 0 && s.body.worker.inFlightTasks === 0) break;
  }
  const vecCnt = db.prepare("SELECT COUNT(*) as c FROM vector_embeddings WHERE project=?").get(e2eProject).c;
  const ftsCnt = db.prepare("SELECT COUNT(*) as c FROM vector_embeddings_fts").get().c;
  console.log(`✅ 入库完成: vector_embeddings=${vecCnt}, fts5=${ftsCnt}`);
  if (vecCnt === 0 || ftsCnt === 0) { console.error('❌ 向量或 FTS5 数据为空'); process.exit(1); }

  // 4. 重建 FTS5 索引（确保一致性）
  const rebuildResp = await httpReq('POST', '/api/kb/fts/rebuild', token);
  console.log(`FTS5 重建: ${rebuildResp.body.message}`);

  // 5. 测试纯 BM25 检索
  console.log('\n--- 5. 纯 BM25 检索 ---');
  const bm25Resp = await httpReq('POST', '/api/kb/search/bm25', token, {
    query: '混凝土 浇筑',
    topK: 5,
  });
  console.log(`BM25 结果: ${bm25Resp.body.total} 条`);
  if (bm25Resp.body.results && bm25Resp.body.results.length > 0) {
    bm25Resp.body.results.forEach((r, i) => {
      console.log(`  [${i+1}] score=${r.score.toFixed(4)} | ${r.text.slice(0, 50)}...`);
    });
  } else {
    console.error('❌ BM25 检索结果为空');
    process.exit(1);
  }
  console.log('✅ BM25 检索成功');

  // 6. 测试纯向量检索
  console.log('\n--- 6. 纯向量检索 ---');
  const qEmbed = await embedText('混凝土浇筑质量', 'query');
  const vecResp = await httpReq('POST', '/api/kb/search', token, { queryEmbedding: qEmbed, topK: 5 });
  console.log(`向量结果: ${vecResp.body.total} 条`);
  if (vecResp.body.results && vecResp.body.results.length > 0) {
    vecResp.body.results.forEach((r, i) => {
      console.log(`  [${i+1}] score=${r.score.toFixed(4)} | ${r.text.slice(0, 50)}...`);
    });
  } else {
    console.error('❌ 向量检索结果为空');
    process.exit(1);
  }
  console.log('✅ 向量检索成功');

  // 7. 测试混合检索
  console.log('\n--- 7. 混合检索（向量 + BM25）---');
  const hybridResp = await httpReq('POST', '/api/kb/search/hybrid', token, {
    queryEmbedding: qEmbed,
    query: '混凝土 浇筑',
    topK: 10,
    alpha: 0.7,
  });
  console.log(`混合结果: ${hybridResp.body.total} 条`);
  console.log(`query.alpha=${hybridResp.body.query.alpha}`);
  if (hybridResp.body.results && hybridResp.body.results.length > 0) {
    hybridResp.body.results.forEach((r, i) => {
      const vecS = r.vecScore !== undefined ? r.vecScore.toFixed(4) : 'N/A';
      const bm25S = r.bm25Score !== undefined ? r.bm25Score.toFixed(4) : 'N/A';
      console.log(`  [${i+1}] final=${r.score.toFixed(4)} (vec=${vecS}, bm25=${bm25S}) | ${r.text.slice(0, 40)}...`);
    });
  } else {
    console.error('❌ 混合检索结果为空');
    process.exit(1);
  }
  console.log('✅ 混合检索成功');

  // 8. 验证融合效果
  console.log('\n--- 8. 验证融合效果 ---');
  const hybridTop = hybridResp.body.results[0];
  const vecTop = vecResp.body.results[0];
  const bm25Top = bm25Resp.body.results[0];
  console.log(`向量 Top-1: score=${vecTop.score.toFixed(4)}, text=${vecTop.text.slice(0, 30)}...`);
  console.log(`BM25 Top-1:  score=${bm25Top.score.toFixed(4)}, text=${bm25Top.text.slice(0, 30)}...`);
  console.log(`混合 Top-1: score=${hybridTop.score.toFixed(4)}, text=${hybridTop.text.slice(0, 30)}...`);

  // 混合检索应该融合了两者的优势
  const hybridIds = new Set(hybridResp.body.results.map(r => r.id));
  const vecIds = new Set(vecResp.body.results.map(r => r.id));
  const bm25Ids = new Set(bm25Resp.body.results.map(r => r.id));
  const onlyVec = [...hybridIds].filter(id => vecIds.has(id) && !bm25Ids.has(id)).length;
  const onlyBm25 = [...hybridIds].filter(id => !vecIds.has(id) && bm25Ids.has(id)).length;
  const both = [...hybridIds].filter(id => vecIds.has(id) && bm25Ids.has(id)).length;
  console.log(`融合分析: 仅向量=${onlyVec}, 仅BM25=${onlyBm25}, 两者都有=${both}`);
  if (both === 0 && onlyVec === 0 && onlyBm25 === 0) {
    console.error('❌ 混合检索未融合任何结果');
    process.exit(1);
  }
  console.log('✅ 融合效果验证通过');

  // 9. 停止 Worker + 清理
  await httpReq('POST', '/api/kb/worker/stop', token);
  db.prepare("DELETE FROM kb_sync_queue WHERE project_name=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings WHERE project=?").run(e2eProject);
  db.prepare("DELETE FROM vector_embeddings_fts WHERE external_id LIKE 'daily-1-%'").run();
  db.prepare("UPDATE daily_reports SET tasks=NULL, quality_risks=NULL, issues=NULL, notes=NULL, original_text=NULL WHERE id=1").run();
  console.log('\n✅ 清理完成');

  console.log('\n=== 5.9 混合检索测试全部通过 ===');
}

main().catch(err => { console.error('测试失败:', err); process.exit(1); });
