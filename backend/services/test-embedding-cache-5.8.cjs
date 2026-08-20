/**
 * 5.8 Embedding 缓存端到端测试
 *
 * 流程：
 *   1. 清空 embedding_cache 表
 *   2. 调用 embedText（第一次，miss → API → 存入缓存）
 *   3. 查询 embedding_cache 表，应该有 1 条记录
 *   4. 再次调用相同文本（第二次，hit → 直接返回缓存）
 *   5. 查询 hit_count，应该为 1
 *   6. 调用 embedBatch（部分命中，部分未命中）
 *   7. 查询缓存记录数和命中次数
 *   8. 验证向量一致性（第一次和第二次的向量应该相同）
 *   9. 测试 API 端点（/api/kb/embedding-cache/stats）
 *  10. 清空缓存
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
  console.log('=== 5.8 Embedding 缓存端到端测试 ===\n');

  // 导入 embeddingService 和 db
  const { embedText, embedBatch, getCacheStats, clearCache } = await import('./embeddingService.js');
  const { getDb } = await import('../db.js');
  const db = getDb();

  // 1. 清空缓存
  console.log('--- 1. 清空缓存 ---');
  clearCache();
  console.log('✅ 缓存已清空');

  // 2. 第一次调用 embedText（miss → API → 存入缓存）
  console.log('\n--- 2. 第一次调用 embedText（应 miss）---');
  const t0 = Date.now();
  const emb1 = await embedText('混凝土浇筑质量检测标准', 'document');
  const ms1 = Date.now() - t0;
  console.log(`耗时 ${ms1}ms, 维度 ${emb1.length}`);

  // 3. 查询缓存表
  const cnt1 = db.prepare('SELECT COUNT(*) as c FROM embedding_cache').get().c;
  console.log(`缓存记录: ${cnt1} 条`);
  if (cnt1 !== 1) { console.error('❌ 应该有 1 条缓存'); process.exit(1); }
  console.log('✅ 缓存存入成功');

  // 4. 第二次调用相同文本（hit → 直接返回缓存）
  console.log('\n--- 3. 第二次调用相同文本（应 hit）---');
  const t1 = Date.now();
  const emb2 = await embedText('混凝土浇筑质量检测标准', 'document');
  const ms2 = Date.now() - t1;
  console.log(`耗时 ${ms2}ms, 维度 ${emb2.length}`);

  // 5. 验证命中次数
  const hitRow = db.prepare('SELECT hit_count FROM embedding_cache WHERE text_type=?').get('document');
  console.log(`hit_count: ${hitRow.hit_count}`);
  if (hitRow.hit_count !== 1) { console.error('❌ hit_count 应为 1'); process.exit(1); }

  // 6. 验证缓存加速（第二次应该比第一次快很多）
  if (ms2 >= ms1) {
    console.warn(`⚠️  缓存未加速: 第一次 ${ms1}ms, 第二次 ${ms2}ms（可能 API 太快或缓存未命中）`);
  } else {
    console.log(`✅ 缓存加速: ${ms1}ms → ${ms2}ms (节省 ${((ms1 - ms2) / ms1 * 100).toFixed(0)}%)`);
  }

  // 7. 验证向量一致性
  let sameCount = 0;
  for (let i = 0; i < emb1.length; i++) {
    if (Math.abs(emb1[i] - emb2[i]) < 1e-6) sameCount++;
  }
  console.log(`向量一致性: ${sameCount}/${emb1.length} 维度相同`);
  if (sameCount !== emb1.length) { console.error('❌ 缓存的向量与 API 返回的不一致'); process.exit(1); }
  console.log('✅ 向量完全一致');

  // 8. 调用 embedBatch（部分命中，部分未命中）
  console.log('\n--- 4. 调用 embedBatch（1 条已缓存 + 2 条未缓存）---');
  const texts = [
    '混凝土浇筑质量检测标准',  // 已缓存
    '钢筋绑扎施工规范要求',    // 未缓存
    '模板支撑体系安全验收',    // 未缓存
  ];
  const t2 = Date.now();
  const embs = await embedBatch(texts, 'document');
  const ms3 = Date.now() - t2;
  console.log(`耗时 ${ms3}ms, 返回 ${embs.length} 条向量`);

  // 9. 查询缓存记录数
  const cnt2 = db.prepare('SELECT COUNT(*) as c FROM embedding_cache').get().c;
  console.log(`缓存记录: ${cnt2} 条（应有 3 条）`);
  if (cnt2 !== 3) { console.error('❌ 应该有 3 条缓存'); process.exit(1); }
  console.log('✅ 批量缓存存入成功');

  // 10. 再次调用相同 batch（应全部 hit）
  console.log('\n--- 5. 再次调用相同 batch（应全部 hit）---');
  const t3 = Date.now();
  const embs2 = await embedBatch(texts, 'document');
  const ms4 = Date.now() - t3;
  console.log(`耗时 ${ms4}ms, 返回 ${embs2.length} 条向量`);
  if (ms4 >= ms3) {
    console.warn(`⚠️  批量缓存未加速: 第一次 ${ms3}ms, 第二次 ${ms4}ms`);
  } else {
    console.log(`✅ 批量缓存加速: ${ms3}ms → ${ms4}ms (节省 ${((ms3 - ms4) / ms3 * 100).toFixed(0)}%)`);
  }

  // 11. 测试 API 端点
  console.log('\n--- 6. 测试 API 端点 ---');
  // 登录
  const login = await httpReq('POST', '/api/auth/login', null, { username: 'admin', password: 'admin123' });
  const token = login.body.token;

  // GET /api/kb/embedding-cache/stats
  const statsResp = await httpReq('GET', '/api/kb/embedding-cache/stats', token);
  console.log('stats:', JSON.stringify(statsResp.body, null, 2));
  if (statsResp.status !== 200 || !statsResp.body.success) { console.error('❌ 统计 API 失败'); process.exit(1); }
  if (statsResp.body.totalCached !== 3) { console.error('❌ totalCached 应为 3'); process.exit(1); }
  if (statsResp.body.totalHits < 2) { console.error('❌ totalHits 应 >= 2'); process.exit(1); }
  console.log('✅ 统计 API 正确');

  // POST /api/kb/embedding-cache/clear
  const clearResp = await httpReq('POST', '/api/kb/embedding-cache/clear', token);
  console.log('clear:', JSON.stringify(clearResp.body));
  if (clearResp.status !== 200 || !clearResp.body.success) { console.error('❌ 清空 API 失败'); process.exit(1); }
  if (clearResp.body.deleted !== 3) { console.error('❌ deleted 应为 3'); process.exit(1); }
  console.log('✅ 清空 API 正确');

  // 验证缓存已清空
  const statsResp2 = await httpReq('GET', '/api/kb/embedding-cache/stats', token);
  if (statsResp2.body.totalCached !== 0) { console.error('❌ 清空后 totalCached 应为 0'); process.exit(1); }
  console.log('✅ 清空后缓存为 0');

  console.log('\n=== 5.8 Embedding 缓存测试全部通过 ===');
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
