import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3000/api';

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
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(res.status, '可能是登录取限流，请等待60秒后重试').toBe(200);
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
