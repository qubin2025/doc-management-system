/**
 * 5.5 Worker API 端点测试
 */
const http = require('http');

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
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
  console.log('=== 5.5 Worker API 端点测试 ===\n');

  // 1. 登录获取 token
  console.log('--- 1. 登录 ---');
  const login = await request('POST', '/api/auth/login', null, { username: 'admin', password: 'admin123' });
  if (login.status !== 200 || !login.body.token) {
    console.error('登录失败:', login.status, JSON.stringify(login.body).slice(0, 200));
    process.exit(1);
  }
  const token = login.body.token;
  console.log('登录成功, token:', token.slice(0, 20) + '...');

  // 2. GET /api/kb/worker/status — Worker 初始状态（应为 stopped）
  console.log('\n--- 2. GET /api/kb/worker/status（初始状态）---');
  const status1 = await request('GET', '/api/kb/worker/status', token);
  console.log('HTTP', status1.status);
  console.log('body:', JSON.stringify(status1.body, null, 2));
  if (status1.status !== 200 || !status1.body.success) {
    console.error('❌ 状态查询失败');
    process.exit(1);
  }
  if (status1.body.worker.state !== 'stopped' || status1.body.worker.isRunning !== false) {
    console.error('❌ 初始状态应为 stopped/isRunning=false');
    process.exit(1);
  }
  console.log('✅ 初始状态正确: stopped/isRunning=false');

  // 3. POST /api/kb/worker/start — 启动 Worker
  console.log('\n--- 3. POST /api/kb/worker/start ---');
  const start1 = await request('POST', '/api/kb/worker/start', token);
  console.log('HTTP', start1.status);
  console.log('body:', JSON.stringify(start1.body, null, 2));
  if (start1.status !== 200 || start1.body.action !== 'started') {
    console.error('❌ 启动失败，期望 action=started');
    process.exit(1);
  }
  console.log('✅ Worker 启动成功');

  // 4. GET /api/kb/worker/status — 验证运行中
  console.log('\n--- 4. GET /api/kb/worker/status（运行中）---');
  const status2 = await request('GET', '/api/kb/worker/status', token);
  console.log('worker:', JSON.stringify(status2.body.worker, null, 2));
  if (status2.body.worker.state !== 'running' || status2.body.worker.isRunning !== true) {
    console.error('❌ 运行状态应为 running/isRunning=true');
    process.exit(1);
  }
  console.log('✅ 运行状态正确: running/isRunning=true, uptime=' + status2.body.worker.uptime + 'ms');

  // 5. POST /api/kb/worker/start — 重复启动（应返回 already_running）
  console.log('\n--- 5. POST /api/kb/worker/start（重复启动）---');
  const start2 = await request('POST', '/api/kb/worker/start', token);
  console.log('body:', JSON.stringify(start2.body, null, 2));
  if (start2.body.action !== 'already_running') {
    console.error('❌ 重复启动应返回 already_running');
    process.exit(1);
  }
  console.log('✅ 重复启动正确返回 already_running');

  // 等待 2 秒让 Worker 跑一轮
  console.log('\n--- 等待 2 秒让 Worker 跑一轮 ---');
  await new Promise(r => setTimeout(r, 2000));

  // 6. GET /api/kb/worker/status — 验证 cycles 增加
  console.log('\n--- 6. GET /api/kb/worker/status（验证 cycles）---');
  const status3 = await request('GET', '/api/kb/worker/status', token);
  console.log('stats:', JSON.stringify(status3.body.stats, null, 2));
  console.log('queue:', JSON.stringify(status3.body.queue, null, 2));
  if (status3.body.stats.cycles < 1) {
    console.error('❌ cycles 应 >= 1');
    process.exit(1);
  }
  console.log('✅ cycles=' + status3.body.stats.cycles + ' (Worker 在轮询)');

  // 7. POST /api/kb/worker/stop — 停止 Worker
  console.log('\n--- 7. POST /api/kb/worker/stop ---');
  const stop1 = await request('POST', '/api/kb/worker/stop', token);
  console.log('HTTP', stop1.status);
  console.log('body:', JSON.stringify(stop1.body, null, 2));
  if (stop1.status !== 200 || stop1.body.action !== 'stopped') {
    console.error('❌ 停止失败，期望 action=stopped');
    process.exit(1);
  }
  console.log('✅ Worker 停止成功（耗时 ' + stop1.body.elapsedMs + 'ms）');

  // 8. GET /api/kb/worker/status — 验证已停止
  console.log('\n--- 8. GET /api/kb/worker/status（已停止）---');
  const status4 = await request('GET', '/api/kb/worker/status', token);
  console.log('worker:', JSON.stringify(status4.body.worker, null, 2));
  if (status4.body.worker.state !== 'stopped' || status4.body.worker.isRunning !== false) {
    console.error('❌ 停止后状态应为 stopped/isRunning=false');
    process.exit(1);
  }
  console.log('✅ 停止后状态正确: stopped/isRunning=false');

  // 9. POST /api/kb/worker/stop — 重复停止（应返回 already_stopped）
  console.log('\n--- 9. POST /api/kb/worker/stop（重复停止）---');
  const stop2 = await request('POST', '/api/kb/worker/stop', token);
  console.log('body:', JSON.stringify(stop2.body, null, 2));
  if (stop2.body.action !== 'already_stopped') {
    console.error('❌ 重复停止应返回 already_stopped');
    process.exit(1);
  }
  console.log('✅ 重复停止正确返回 already_stopped');

  // 10. 权限测试 — viewer 角色不能 start/stop
  console.log('\n--- 10. 权限测试（viewer 角色不能 start）---');
  // 先注册一个 viewer 用户（如果不存在）
  const viewerLogin = await request('POST', '/api/auth/login', null, { username: 'viewer_test', password: 'viewer123' });
  if (viewerLogin.status === 200 && viewerLogin.body.token) {
    const viewerStart = await request('POST', '/api/kb/worker/start', viewerLogin.body.token);
    console.log('viewer start HTTP:', viewerStart.status, '| error:', viewerStart.body.error);
    if (viewerStart.status !== 403) {
      console.error('❌ viewer 应被拒绝（403）');
      process.exit(1);
    }
    console.log('✅ viewer 角色被正确拒绝（403）');
  } else {
    console.log('⚠️  跳过权限测试（viewer_test 用户不存在）');
  }

  console.log('\n=== 5.5 Worker API 端点测试全部通过 ===');
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
