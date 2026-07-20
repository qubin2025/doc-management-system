/**
 * API并发压力测试 — 模拟5-10用户同时操作
 * 用法: node scripts/concurrency-test.js
 */
const API = 'http://localhost:3000/api';
const CONCURRENT_USERS = 8;
const ITERATIONS = 5;

async function run() {
  // 1. 登录获取token
  console.log('=== 登录 ===');
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const auth = await loginRes.json();
  const token = auth.token;
  if (!token) { console.error('登录失败:', auth); process.exit(1); }
  console.log('Token:', token.slice(0, 20) + '...');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. 创建测试项目
  const projName = `concurrency-test-${Date.now()}`;
  const projRes = await fetch(`${API}/projects`, { method: 'POST', headers, body: JSON.stringify({ name: projName }) });
  const proj = await projRes.json();
  console.log('项目:', proj.name, '(id:', proj.id, ')');

  // 3. 并发测试
  console.log(`\n=== 并发测试 (${CONCURRENT_USERS}用户 × ${ITERATIONS}轮) ===`);
  const results = { success: 0, fail: 0, latencies: [] as number[] };

  for (let round = 0; round < ITERATIONS; round++) {
    const promises = [];
    for (let u = 0; u < CONCURRENT_USERS; u++) {
      promises.push((async () => {
        const start = Date.now();
        try {
          const res = await fetch(`${API}/projects`, { headers });
          const latency = Date.now() - start;
          results.latencies.push(latency);
          if (res.ok) results.success++;
          else results.fail++;
        } catch {
          results.fail++;
        }
      })());
    }
    await Promise.all(promises);
    if (results.latencies.length > 0) {
      const lastBatch = results.latencies.slice(-CONCURRENT_USERS);
      console.log(`  轮次${round + 1}: avg=${Math.round(lastBatch.reduce((a,b)=>a+b,0)/lastBatch.length)}ms, max=${Math.max(...lastBatch)}ms`);
    }
  }

  // 4. 清理
  await fetch(`${API}/projects/${proj.id}`, { method: 'DELETE', headers });

  // 5. 报告
  const avgLatency = Math.round(results.latencies.reduce((a,b)=>a+b,0) / results.latencies.length);
  const maxLatency = Math.max(...results.latencies);
  console.log(`\n=== 结果 ===`);
  console.log(`  总请求: ${results.success + results.fail}`);
  console.log(`  成功: ${results.success} | 失败: ${results.fail}`);
  console.log(`  平均延迟: ${avgLatency}ms`);
  console.log(`  最大延迟: ${maxLatency}ms`);
  console.log(`  评级: ${avgLatency < 200 ? '✅ 优秀' : avgLatency < 500 ? '⚠️ 可接受' : '❌ 需优化'}`);
  console.log(`  并发安全: ${results.fail === 0 ? '✅ 无锁冲突' : '❌ 存在锁冲突'}`);
}

run().catch(e => { console.error(e); process.exit(1); });
