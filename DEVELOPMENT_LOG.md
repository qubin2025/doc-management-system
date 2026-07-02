# 全过程工程咨询管理系统 — 开发知识库 v2.5.0
> 最后更新: 2026-07-02 | 分支: release/v2.5.0-enterprise | 115 commits

## 一、项目定位

企业内网部署的工程全过程咨询管理平台。面向工程咨询公司内部员工（10-50并发），提供AI辅助审查、方案生成、安全巡检、知识图谱等功能。

**核心原则:**
- 真实可用 > 表面通过（健康检查必须真实端口探测）
- 离线降级 ≠ 默认离线（环境满足时必须警告未启动）
- 少即是多（统一入口优于分散入口，默认配置覆盖80%场景）
- 全局一致（字体/按钮/历史栏全部统一）
- 数据主权（审查结果仅存localStorage，服务器仅保留API日志）
- 文档先行（CLAUDE.md 是最权威开发指南）

---

## 二、技术架构

```
前端: React 18 + TypeScript 5 + Vite 5 + TailwindCSS 3
后端: Express.js + better-sqlite3 + multer
认证: bcrypt + UUID Session (24h过期) + 4角色RBAC
AI: DeepSeek / Zhipu GLM-5V / Qwen / 本地Ollama
部署: Docker Compose / PM2+Nginx / Windows脚本
```

### 端口
| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Express 后端 | 主API |
| 5173 | Vite 前端 | 开发模式 |
| 8001 | EasyOCR | 文档解析 |
| 8000 | LightRAG | 知识引擎 |
| 9380 | RAGFlow | Docker |
| 7687 | Neo4j | Docker |

---

## 三、关键决策记录

### API_BASE 配置
**最终方案：源码硬编码 `const API_BASE = '/api'`**（`src/data/api.ts` 第3行）
同时 `vite.config.ts` 配置 `proxy: { '/api': 'http://localhost:3000' }`

### 图片识别管道（7次尝试）
| # | 方案 | 结果 |
|---|------|:---:|
| 1 | JSON base64传输 | ❌ 大图序列化不稳定 |
| 2 | FormData上传 | ❌ 跨域CORS 401 |
| 3 | Vite代理 | ❌ 代理未配置 |
| 7 | 硬编码API_BASE+FormData | ❌ 浏览器仍失败 |

**最终方案：** 安全巡检独立页面 + FormData + 绝对后端URL + token通过query参数传递。

### GLM模型升级路径
`glm-4v` → `glm-4.1v-thinking-flash` → **`glm-5v-turbo`** (等同Zhipu体验中心)

### VITE_API_URL 曾导致大量缓存问题
`.env` 的 `VITE_API_URL` 多次修改不生效，因浏览器缓存旧 JS chunk。最终硬编码到源码解决。

---

## 四、核心文件索引

| 文件 | 用途 |
|------|------|
| `src/data/api.ts` | API_BASE='/api' (硬编码) |
| `backend/routes/ai.js` | 9模型路由 + GLM-5V视觉 |
| `backend/routes/safety.js` | 安全巡检独立端点 |
| `backend/config/aiPrompts.js` | 所有AI提示词配置 |
| `backend/config/safetyChecklist.js` | 18项JGJ59检查清单 |
| `src/components/SafetyInspection.tsx` | 安全巡检独立页 |
| `CLAUDE.md` | 项目最高原则 |

---

## 五、已知问题

| 问题 | 解决方案 |
|------|----------|
| 安全巡检 401 | 退出重新登录(每次重启后端需重登) |
| AI聊天图片识别失败 | 使用安全巡检独立页代替 |
| Docker服务未启动 | 手动启动 Docker Desktop |

---

## 六、后续计划

详见 `docs/v1.7.0/部署前开发计划_v3.0.html`
