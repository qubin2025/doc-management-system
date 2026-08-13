# safeJson 安全响应解析规范

> **文档日期**：2026-08-13
> **适用范围**：前端所有 `fetch` 调用后的 JSON 解析
> **核心文件**：`src/data/api.ts`

---

## 一、问题背景

### 线上故障

登录页面报错：`Failed to execute 'json' on 'Response': Unexpected end of JSON input`

### 根因分析

| 层级 | 说明 |
|------|------|
| **Vite 代理** | 开发环境中 `vite.config.ts` 将 `/api` 代理到 `http://localhost:3000` |
| **后端未启动** | 当后端服务未运行时，代理返回 **HTTP 502 + 空响应体** |
| **前端直接 `.json()`** | `res.json()` 尝试解析空字符串为 JSON，触发 `Unexpected end of JSON input` |
| **错误未捕获** | 该异常在 `try/catch` 之外（或 `catch` 中仍尝试 `.json()`），导致页面白屏 |

### 错误调用链

```
用户点击登录
  → api.login()
    → fetch('/api/auth/login')        // Vite 代理转发
      → 后端未启动，代理返回 502 空响应
    → res.json()                       // ← 崩溃：空响应体无法解析
      → SyntaxError: Unexpected end of JSON input
```

---

## 二、解决方案 — safeJson 函数

### 函数定义

```typescript
/**
 * 安全解析 JSON 响应体，空响应或解析失败时返回 fallback
 * @param res       - fetch 返回的 Response 对象
 * @param fallback  - 解析失败时的默认返回值（默认 {}）
 * @returns 解析后的 JSON 对象，或 fallback
 */
async function safeJson<T = any>(res: Response, fallback: T = {} as T): Promise<T> {
  const text = await res.text();      // 先读取为文本，避免空响应崩溃
  if (!text) return fallback;          // 空响应体 → 返回 fallback
  try { return JSON.parse(text) as T; } // 尝试解析 JSON
  catch { return fallback; }            // 解析失败 → 返回 fallback
}
```

### 设计要点

1. **先 `text()` 后 `parse()`** — 不直接调用 `res.json()`，而是先用 `res.text()` 读取完整响应体文本
2. **空体检测** — 如果响应体为空字符串，直接返回 `fallback`，不尝试解析
3. **解析容错** — 即使响应体非空但不是合法 JSON（如 HTML 错误页），也返回 `fallback` 而非抛异常
4. **泛型支持** — 通过 `<T>` 支持类型推断，调用方可指定期望的返回类型

---

## 三、使用示例

### 场景 1：登录（需要 token）

```typescript
export async function login(username: string, password: string): Promise<AuthState> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // 安全解析，指定期望的结构
  const data = await safeJson<{ token?: string; user?: any; permissions?: any; error?: string }>(res);

  // 错误处理：优先使用后端返回的 error 字段，空响应时按状态码给出友好提示
  if (!res.ok) throw new Error(data.error || (res.status === 502 ? '后端服务未启动，请稍后重试' : '登录失败'));

  // 业务校验：即使 res.ok 但缺少关键字段也视为异常
  if (!data.token) throw new Error('登录响应异常，未获取到令牌');

  setAuthToken(data.token);
  return { token: data.token, user: data.user, permissions: data.permissions };
}
```

### 场景 2：注册（只需要错误信息）

```typescript
export async function register(username: string, password: string, ...): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/register`, { ... });

  // fallback 指定为 { error: '' }，确保 data.error 可安全访问
  const data = await safeJson(res, { error: '' });

  if (!res.ok) throw new Error(data.error || (res.status === 502 ? '后端服务未启动，请稍后重试' : '注册失败'));
}
```

### 场景 3：获取当前用户（容错降级）

```typescript
export async function getMe(): Promise<{ user: UserInfo; permissions: Permissions } | null> {
  if (!authToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: headers() });
    if (!res.ok) { setAuthToken(''); return null; }

    // fallback 为 null，解析失败时降级为"未登录"状态
    return await safeJson(res, null);
  } catch { return null; }
}
```

---

## 四、对比：修复前 vs 修复后

| 场景 | 修复前 (`res.json()`) | 修复后 (`safeJson()`) |
|------|----------------------|----------------------|
| 后端正常返回 JSON | 正常解析 | 正常解析 |
| 后端未启动（502 空响应） | **崩溃**：`Unexpected end of JSON input` | 返回 `fallback`，提示"后端服务未启动" |
| 代理返回 HTML 错误页 | **崩溃**：`SyntaxError` | 返回 `fallback`，按状态码提示 |
| 后端返回空 200 响应 | **崩溃**：`Unexpected end of JSON input` | 返回 `fallback`，业务校验拦截 |

---

## 五、团队规范

### 必须使用 safeJson 的场景

> 以下场景**禁止**直接调用 `res.json()`，**必须**使用 `safeJson()`：

1. **认证相关**（login / register / getMe / logout）
2. **用户输入触发的 API 调用**（表单提交、搜索等）
3. **页面加载时的初始化请求**（项目列表、配置等）
4. **任何可能因后端不可用而返回空响应的请求**

### 可以直接用 `res.json()` 的场景

> 以下场景**可以**直接使用 `res.json()`，但建议也用 `safeJson()`：

1. 已确认后端必定可用的内部调用
2. 已有 `try/catch` 包裹且 `catch` 中不依赖 `.json()` 的场景

### 新增 API 函数的标准模板

```typescript
export async function someApi(params: SomeParams): Promise<SomeResult> {
  const res = await fetch(`${API_BASE}/some-endpoint`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  });

  const data = await safeJson<{ result?: SomeResult; error?: string }>(res);

  if (!res.ok) throw new Error(data.error || '操作失败');
  if (!data.result) throw new Error('响应数据异常');

  return data.result;
}
```

---

## 六、验证记录

| 测试项 | 状态码 | 响应体 | 结果 |
|--------|--------|--------|------|
| 正常登录 (admin/admin123) | 200 | `{"token":"...","user":{...}}` | 正常返回 |
| 错误密码 | 401 | `{"error":"用户名或密码错误"}` | 正确提示错误 |
| 后端未启动（模拟） | 502 | 空 | 提示"后端服务未启动" |
| TSC 类型检查 | — | — | 零错误 |

---

## 七、相关文件

| 文件 | 说明 |
|------|------|
| `src/data/api.ts` | safeJson 函数定义 + 所有认证函数 |
| `src/components/LoginPage.tsx` | 登录页面组件 |
| `backend/routes/auth.js` | 后端认证路由 |
| `vite.config.ts` | Vite 代理配置（`/api` → `localhost:3000`） |
