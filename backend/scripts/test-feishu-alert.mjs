/**
 * 飞书告警模块本地模拟测试
 *
 * 用途:
 *   - 不依赖真实飞书 webhook，验证告警模块的发送逻辑、消息格式、网络层
 *   - 起一个本地 HTTP 服务器作为飞书 webhook mock 端点
 *   - 调用真实 sendFeishuAlert 函数发送三种状态（success/partial_failed/failed）
 *   - 打印接收到的完整请求 payload 供人工审查消息格式
 *
 * 用法:
 *   node scripts/test-feishu-alert.cjs
 *
 * 验证项:
 *   1. sendFeishuAlert 函数能正确序列化卡片消息
 *   2. fetch 能正常发起到本地 HTTP 服务器
 *   3. 接收到的 JSON 结构符合飞书 interactive 卡片规范
 *   4. 三种状态（success/partial_failed/failed）的颜色和 emoji 正确
 *   5. errorDetails 字段正确渲染
 *
 * 真实飞书连通性测试:
 *   将下面 LOCAL_WEBHOOK 改为真实飞书 webhook URL，再次运行
 */

import http from 'http';
import { setTimeout as sleep } from 'timers/promises';

// 在 import feishuAlert 之前设置环境变量
const PORT = 9999;
const LOCAL_WEBHOOK = `http://127.0.0.1:${PORT}/open-apis/bot/v2/hook/test`;
process.env.FEISHU_WEBHOOK_URL = LOCAL_WEBHOOK;
process.env.FEISHU_ALERT_LEVEL = 'always';
process.env.ALERT_HOSTNAME = 'test-server-01';

const { sendFeishuAlert, shouldAlert } = await import('../lib/feishuAlert.js');

const T_START = Date.now();
function log(msg, level = 'info') {
  const ts = new Date().toISOString();
  const elapsed = ((Date.now() - T_START) / 1000).toFixed(2) + 's';
  const prefix = level === 'error' ? '✗' : level === 'warn' ? '!' : '✓';
  console.log(`[${ts}][+${elapsed}] ${prefix} ${msg}`);
}

// === Mock 飞书 webhook 服务器 ===
const receivedPayloads = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    log(`mock feishu received: ${req.method} ${req.url}, Content-Length=${body.length}`);

    let parsed;
    try {
      parsed = JSON.parse(body);
      receivedPayloads.push({ url: req.url, headers: req.headers, body: parsed });
    } catch (e) {
      log(`parse body failed: ${e.message}`, 'error');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 400, msg: 'bad json' }));
      return;
    }

    // 模拟飞书成功响应
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 0, msg: 'success' }));
  });
});

// === 测试用例 ===
const TEST_CASES = [
  {
    name: '成功场景 (success)',
    payload: {
      taskName: '日报清理任务',
      hostname: 'test-server-01',
      finishedAt: new Date().toISOString(),
      elapsed: '0.12s',
      exitCode: 0,
      status: 'success',
      metrics: {
        '扫描文件数': 127,
        '删除文件数': 108,
        '跳过文件数': 19,
        '释放空间': '317.84MB',
        '错误数': 0,
      },
      errorDetails: [],
      note: 'KEEP_DAYS=7 | DRY_RUN=false',
    },
  },
  {
    name: '部分失败场景 (partial_failed)',
    payload: {
      taskName: '数据库备份任务',
      hostname: 'test-server-01',
      finishedAt: new Date().toISOString(),
      elapsed: '2.45s',
      exitCode: 2,
      status: 'partial_failed',
      metrics: {
        '数据库备份': '✓ 9.92MB',
        '文件备份': '✗ 失败',
        '清理过期备份': '✓ 删除 3 个',
        '当前备份总数': 27,
        '错误数': 1,
      },
      errorDetails: [
        { name: 'files', reason: 'EACCES: permission denied, mkdir' },
      ],
      note: 'KEEP_DAYS=30 | DB_PATH=planning.db',
    },
  },
  {
    name: '失败场景 (failed) - 多错误',
    payload: {
      taskName: '会话清理任务',
      hostname: 'test-server-01',
      finishedAt: new Date().toISOString(),
      elapsed: '0.03s',
      exitCode: 1,
      status: 'failed',
      metrics: {
        '过期会话数': 526,
        '已删除': 0,
        '剩余总会话': 526,
        '错误数': 1,
      },
      errorDetails: [
        { name: 'sessions', reason: 'SQLITE_BUSY: database is locked' },
        { name: 'sessions', reason: 'cannot rollback - no transaction active' },
      ],
      note: 'DB_PATH=planning.db',
    },
  },
];

async function runTests() {
  log('=== 飞书告警模块本地模拟测试 ===');
  log(`mock webhook URL: ${LOCAL_WEBHOOK}`);
  log(`alert level: ${process.env.FEISHU_ALERT_LEVEL}`);
  log(`test cases: ${TEST_CASES.length}`);
  log('');

  // 1. 验证 shouldAlert 函数
  log('--- 1. shouldAlert 函数验证 ---');
  const shouldTests = [
    { level: 'error', exitCode: 0, expected: false, desc: 'error + success' },
    { level: 'error', exitCode: 1, expected: true, desc: 'error + failed' },
    { level: 'always', exitCode: 0, expected: true, desc: 'always + success' },
    { level: 'never', exitCode: 1, expected: false, desc: 'never + failed' },
  ];
  let shouldPass = 0, shouldFail = 0;
  for (const t of shouldTests) {
    process.env.FEISHU_ALERT_LEVEL = t.level;
    // 重新 import 才能读到新值（实际场景中 level 在启动时确定，这里是验证逻辑）
    const mod = await import(`../lib/feishuAlert.js?t=${Date.now()}_${Math.random()}`);
    const actual = mod.shouldAlert(t.exitCode === 0 ? 'success' : 'failed', t.exitCode);
    const ok = actual === t.expected;
    if (ok) { shouldPass++; log(`  ${t.desc}: expected=${t.expected} actual=${actual} OK`); }
    else { shouldFail++; log(`  ${t.desc}: expected=${t.expected} actual=${actual} FAIL`, 'error'); }
  }
  process.env.FEISHU_ALERT_LEVEL = 'always';
  log(`shouldAlert: ${shouldPass}/${shouldTests.length} passed`);
  log('');

  // 2. 发送三种状态告警到 mock 服务器
  log('--- 2. 三种状态告警发送 ---');
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    log(`[${i + 1}/${TEST_CASES.length}] ${tc.name}`);
    const ok = await sendFeishuAlert(tc.payload, (msg, lvl) => log(`    ${msg}`, lvl));
    if (ok) log(`    sendFeishuAlert returned: true OK`);
    else log(`    sendFeishuAlert returned: false FAIL`, 'error');
    await sleep(50);
  }
  log('');

  // 3. 验证接收到的 payload 结构
  log('--- 3. 接收 payload 结构验证 ---');
  let structPass = 0, structFail = 0;
  const checks = [
    { name: '收到3条请求', ok: receivedPayloads.length === 3 },
  ];

  for (let i = 0; i < receivedPayloads.length; i++) {
    const p = receivedPayloads[i];
    const expected = TEST_CASES[i];
    const card = p.body?.card;
    const checks2 = [
      { name: `[#${i + 1}] msg_type=interactive`, ok: p.body?.msg_type === 'interactive' },
      { name: `[#${i + 1}] card 存在`, ok: !!card },
      { name: `[#${i + 1}] header.template=green/red`, ok: ['green', 'red'].includes(card?.header?.template) },
      { name: `[#${i + 1}] header title 含 taskName`, ok: (card?.header?.title?.content || '').includes(expected.payload.taskName) },
      { name: `[#${i + 1}] status 颜色匹配`, ok:
        (expected.payload.status === 'success' && card?.header?.template === 'green') ||
        (expected.payload.status !== 'success' && card?.header?.template === 'red')
      },
      { name: `[#${i + 1}] elements 数组`, ok: Array.isArray(card?.elements) && card.elements.length >= 4 },
      { name: `[#${i + 1}] metrics 已渲染`, ok: JSON.stringify(p.body).includes(Object.keys(expected.payload.metrics)[0]) },
      { name: `[#${i + 1}] hostname 已渲染`, ok: JSON.stringify(p.body).includes(expected.payload.hostname) },
      { name: `[#${i + 1}] errorDetails 渲染`, ok:
        expected.payload.errorDetails.length === 0 ||
        JSON.stringify(p.body).includes(expected.payload.errorDetails[0].name)
      },
    ];
    checks.push(...checks2);
  }

  for (const c of checks) {
    if (c.ok) { structPass++; log(`  ${c.name}: OK`); }
    else { structFail++; log(`  ${c.name}: FAIL`, 'error'); }
  }
  log('');
  log(`结构检查: ${structPass}/${checks.length} passed`);
  log('');

  // 4. 打印一份完整的接收 payload（成功场景）
  log('--- 4. 成功场景完整 payload（参考飞书卡片消息结构） ---');
  if (receivedPayloads[0]) {
    console.log(JSON.stringify(receivedPayloads[0].body, null, 2));
  }
  log('');

  // === 总结 ===
  log('=== 测试总结 ===');
  const totalPass = shouldPass + structPass;
  const totalFail = shouldFail + structFail;
  log(`shouldAlert: ${shouldPass}/${shouldTests.length}`);
  log(`payload 结构: ${structPass}/${checks.length}`);
  log(`总计: ${totalPass} passed, ${totalFail} failed`);
  log('');

  if (totalFail > 0) {
    log('部分测试失败！', 'error');
    process.exit(1);
  } else {
    log('所有测试通过 ✓');
    log('');
    log('--- 真实飞书连通性测试 ---');
    log('1. 编辑此脚本顶部 LOCAL_WEBHOOK，改为真实飞书 webhook URL');
    log('   例: https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx');
    log('2. 同时将 server 改为不再启动（或保持启动但 URL 指向飞书）');
    log('3. 重新运行: node scripts/test-feishu-alert.cjs');
    log('4. 检查飞书群是否收到卡片消息');
  }

  server.close();
  process.exit(totalFail > 0 ? 1 : 0);
}

server.listen(PORT, '127.0.0.1', async () => {
  log(`mock feishu server listening on http://127.0.0.1:${PORT}`);
  try {
    await runTests();
  } catch (e) {
    log(`uncaught error: ${e.message}`, 'error');
    console.error(e.stack);
    server.close();
    process.exit(1);
  }
});
