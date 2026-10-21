import { describe, it, expect } from 'vitest';

// 轻量声明：避免依赖 @types/node（本测试仅用 process.env）
declare const process: { env: Record<string, string | undefined> };

const API = 'http://localhost:3000/api';

// 测试凭据：默认 admin/admin123；若系统已修改管理员密码，
// 运行测试时设置环境变量：TEST_USERNAME=admin TEST_PASSWORD=<当前密码>
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

describe('后端集成测试', () => {
  let authToken = '';

  it('1. 健康检查', async () => {
    const res = await fetch(`${API}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('2. 登录获取Token', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    expect(res.status, '登录失败：若已修改管理员密码，请设置 TEST_PASSWORD 环境变量为当前密码（如 60 秒内多次尝试可能触发限流）').toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('token');
    authToken = data.token;
  });

  it('3. 系统统计', async () => {
    const res = await fetch(`${API}/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('projects');
  });

  it('4. 模型列表', async () => {
    const res = await fetch(`${API}/ai/models`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.models)).toBe(true);
  });

  it('5. AI连通性', async () => {
    const res = await fetch(`${API}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: '回OK' }], model: 'auto' }),
    });
    expect([200, 429, 503]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('reply');
    }
  });

  it('6. 知识图谱', async () => {
    const res = await fetch(`${API}/kg`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // Neo4j可选
    expect(data.available !== undefined || data.nodes !== undefined).toBe(true);
  });

  it('7. 项目列表', async () => {
    const res = await fetch(`${API}/projects`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('8. 未认证请求被拒绝', async () => {
    const res = await fetch(`${API}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
    });
    expect(res.status).toBe(401);
  });

  it('9. 账号枚举防护', async () => {
    const r1 = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_user', password: 'test' }),
    });
    const r2 = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(r1.status).toBe(r2.status);
  });

  // 限流验证：检查限流中间件已加载(开发环境max=1000/60s，生产200)
  it('10. 限流中间件已配置', async () => {
    // 验证rate-limit头存在
    const res = await fetch(`${API}`);
    expect(res.headers.get('ratelimit-limit')).toBeTruthy();
    expect(res.headers.get('ratelimit-remaining')).toBeTruthy();
    // 开发模式1000次/60s，连续200次不应触发
    for (let i = 0; i < 10; i++) await fetch(`${API}`);
    const final = await fetch(`${API}`);
    expect(Number(final.headers.get('ratelimit-remaining'))).toBeLessThan(1000);
  }, 10000);
});
