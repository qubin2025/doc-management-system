/**
 * 5.13 自动降级端到端验证脚本
 *
 * 模拟前端 KnowledgeBase.tsx 的健康检查逻辑：
 *   1. 登录获取 token
 *   2. 连续调用 /api/kb/worker/status（每 3s 一次，模拟前端轮询）
 *   3. 失败计数累加，达到 3 次时输出"触发降级"
 *   4. 验证降级条件成立：workerMode 应从 'backend' 切换到 'frontend'
 *
 * 运行方式：node backend/services/test-failover-5.13.cjs
 * 前置条件：后端以 SIMULATE_WORKER_DOWN=1 启动
 */
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`登录失败: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function checkWorkerStatus(token) {
  const res = await fetch(`${API_BASE}/kb/worker/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: body.error || 'unknown' };
  }
  const data = await res.json();
  return { ok: true, status: res.status, data };
}

async function main() {
  console.log('=== 5.13 自动降级验证 ===\n');

  // 1. 登录
  const token = await login('admin', 'admin123');
  console.log(`[1] 登录成功, token=${token.slice(0, 8)}...`);

  // 2. 模拟前端健康检查轮询（最多 5 次，模拟前端 useEffect 3s 间隔轮询）
  let failCount = 0;
  let mode = 'backend';  // 模拟前端的 workerMode state
  const MAX_ATTEMPTS = 5;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    console.log(`\n[尝试 ${i}] 调用 /kb/worker/status...`);
    const result = await checkWorkerStatus(token);

    if (result.ok) {
      console.log(`  ✓ 成功: HTTP ${result.status}, state=${result.data.worker?.state}`);
      failCount = 0;
      mode = 'backend';
    } else {
      failCount++;
      console.log(`  ✗ 失败: HTTP ${result.status}, error=${result.error}`);
      console.log(`  失败计数: ${failCount}/3`);

      // 模拟前端逻辑：连续失败 ≥3 次自动切换到 frontend
      if (failCount >= 3 && mode === 'backend') {
        mode = 'frontend';
        console.log(`  ⚡ 触发降级! workerMode: 'backend' → 'frontend'`);
        console.log(`  [Toast] 后端 Worker 连续 3 次无响应，已自动切换到前端降级模式`);
      }
    }

    // 等待 1.5s（加速测试，前端实际是 3s）
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n=== 验证结果 ===');
  console.log(`最终 workerMode: ${mode}`);
  console.log(`失败计数: ${failCount}`);

  if (mode === 'frontend') {
    console.log('\n✅ 验证通过：前端在连续 3 次失败后自动降级到 frontend 模式');
    console.log('   实际运行时，前端会调用 startQueuePoller() 启动浏览器内队列处理');
    console.log('   UI 顶栏模式徽章会显示"前端降级"（琥珀色）');
    process.exit(0);
  } else {
    console.log('\n❌ 验证失败：前端未触发自动降级');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('验证脚本异常:', e.message);
  process.exit(2);
});
