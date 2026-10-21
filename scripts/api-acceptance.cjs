// API 层功能验收脚本 v2（v2.5.0-test，使用正确路由）
// 用法: node api-acceptance.cjs
const BASE = 'http://127.0.0.1:3000/api';
const USER = process.env.TEST_USERNAME || 'admin';
const PWD = process.env.TEST_PASSWORD || 'admin123';

let token = '';
const results = [];
const record = (id, name, ok, detail = '') => {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} [${id}] ${name}${detail ? ' — ' + detail : ''}`);
};

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: AbortSignal.timeout(20000) });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function main() {
  // 1.1 管理员登录
  const login = await req('/auth/login', { method: 'POST', body: { username: USER, password: PWD } });
  record('1.1', '管理员登录', login.status === 200 && !!login.data.token, `status=${login.status}`);
  if (login.status === 200) token = login.data.token;

  // 1.3 管理面板访问
  const adminRes = await req('/admin/system');
  record('1.3', 'admin 系统管理', adminRes.status === 200, `status=${adminRes.status}`);

  // 3.1/3.3 项目列表与详情
  const projects = await req('/projects');
  const hasDetail = projects.status === 200 && projects.data.some(p => p.details);
  record('3.1', '项目列表', projects.status === 200 && projects.data.length >= 5, `共${projects.data?.length}个项目`);
  record('3.3', '项目详情', hasDetail, `含详情字段=${hasDetail}`);

  // 4.2/4.4 文档列表与下载（用 /documents/all/:projectId 扁平数组）
  let docOk = false, docDl = false, docName = '';
  if (projects.data?.length) {
    const pid = projects.data[0].id;
    const docs = await req(`/documents/all/${pid}`);
    docOk = docs.status === 200 && Array.isArray(docs.data) && docs.data.length > 0;
    if (docOk && docs.data.length) {
      docName = docs.data[0].file_name || docs.data[0].fileName || '';
      const dl = await req(`/documents/download/${docs.data[0].id || docs.data[0].doc_id}`);
      docDl = dl.status === 200;
    }
  }
  record('4.2', '文档列表', docOk, docName ? `示例: ${docName}` : `status=${projects.status}`);
  record('4.4', '文档下载', docDl, '');

  // 4.6 语义搜索 (POST /kb/search/bm25 文本全文检索)
  const search = await req('/kb/search/bm25', { method: 'POST', body: { query: '给排水', project: projects.data?.[0]?.name || '' } });
  record('4.6', '语义搜索', search.status === 200, `status=${search.status}`);

  // 5.1 知识库同步状态
  const kbStatus = await req('/kb/sync/status');
  record('5.1', '知识库状态', kbStatus.status === 200, `status=${kbStatus.status}`);

  // 5.2 知识图谱
  const kg = await req('/kg');
  const nodeCount = Array.isArray(kg.data?.nodes) ? kg.data.nodes.length : (kg.data?.count ?? 'n/a');
  record('5.2', '知识图谱', kg.status === 200, `status=${kg.status} 节点=${nodeCount}`);

  // 6.1 AI 聊天
  const chat = await req('/ai/chat', { method: 'POST', body: { messages: [{ role: 'user', content: '回复OK两个字' }], model: 'auto' } });
  record('6.1', 'AI 聊天', chat.status === 200 && !!chat.data?.reply, `status=${chat.status} 有回复=${!!chat.data?.reply}`);

  // 6.5 AI 异常输入（系统容错，不崩溃即可）
  const aiBad = await req('/ai/chat', { method: 'POST', body: { messages: [], model: 'bad-model' } });
  record('6.5', 'AI 异常容错', aiBad.status !== 500, `status=${aiBad.status}(非500即容错正常)`);

  // 7.1 指南模块数据（GET /guide/progress?project=X&chapter=ch1）
  const projName = projects.data?.[0]?.name || '';
  const guide = await req(`/guide/progress?project=${encodeURIComponent(projName)}&chapter=ch1`);
  const guideOk = guide.status === 200;
  record('7.1', '指南章节数据', guideOk, `status=${guide.status} project=${projName}`);

  // 9.1 用户管理
  const users = await req('/auth/users');
  record('9.1', '用户管理', users.status === 200 && users.data.length >= 10, `共${users.data?.length ?? 'n/a'}用户`);

  // 9.2 审计日志
  const audit = await req('/audit/');
  record('9.2', '审计日志', audit.status === 200 && Array.isArray(audit.data), `共${Array.isArray(audit.data) ? audit.data.length : 'n/a'}条`);

  // 9.3 备份接口
  const backup = await req('/backup/all');
  record('9.3', '备份接口', backup.status === 200, `status=${backup.status}`);

  // 9.4 数据看板统计
  const stats = await req('/stats');
  record('9.4', '数据看板统计', stats.status === 200, `projects=${stats.data?.projects} docs=${stats.data?.documents}`);

  // 1.2 错误密码拦截
  const badLogin = await req('/auth/login', { method: 'POST', body: { username: USER, password: 'wrong-pass' } });
  record('1.2', '错误密码拦截', badLogin.status === 401, `status=${badLogin.status}`);

  // 8.2 日报列表
  const daily = await req('/mobile/daily/list?projectName=' + encodeURIComponent('测试项目'));
  record('8.2', '日报列表', daily.status === 200, `status=${daily.status}`);

  // 10.3 并发访问
  const t0 = Date.now();
  const conc = await Promise.all(Array.from({ length: 10 }, () => fetch(BASE + '/health', { signal: AbortSignal.timeout(5000) })));
  record('10.3', '并发访问(10路)', conc.every(r => r.status === 200), `耗时=${Date.now() - t0}ms`);

  // 汇总
  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n========== API 验收汇总 ==========`);
  console.log(`通过: ${pass}  失败: ${fail}  总计: ${results.length}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('脚本异常:', e.message); process.exit(1); });
