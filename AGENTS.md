# AGENTS.md — 全过程工程咨询管理系统

> 供 AI Agent（豆包/Cursor/Copilot 等）读取的项目操作指南。
> 人类开发者请优先看 README.md 和 部署说明.md。

## 1. 项目定位

面向建设工程全过程咨询的工程资料管理系统，支持建筑（DB11/T695-2025）和市政（DB11/T808-2020）双规程。核心能力：工程资料归档、AI 知识库检索、知识图谱、全过程咨询工作流。

## 2. 技术栈与关键版本

| 层级 | 技术 | 注意事项 |
|------|------|---------|
| 前端 | React 18 + TypeScript 5 + Vite 5 + TailwindCSS 3 | 构建产物在 `dist/` |
| 后端 | Express 4 + better-sqlite3 | **必须用 Node v22**（better-sqlite3 针对 v22 编译，NODE_MODULE_VERSION 127） |
| 图数据库 | Neo4j（可选，知识图谱） | 未配置时功能降级 |
| AI | DeepSeek（聊天）+ 通义千问（Embedding）+ GLM-4V（视觉） | API Key 在 `backend/.env` |
| 部署 | Docker / PM2 + Nginx | Nginx 配置在 `deploy/` |

### Node 版本（重要）

系统可能存在多个 Node 版本。`better-sqlite3` 原生模块针对 **Node v22** 编译，启动后端必须用 v22：

```bash
# 确认版本
"C:\Program Files\nodejs\node.exe" --version   # 应为 v22.x

# 启动后端（生产模式，大内存）
cd backend
$env:NODE_ENV="production"
& "C:\Program Files\nodejs\node.exe" --max-old-space-size=4096 server.js
```

如果用 Node v20 启动会报 `NODE_MODULE_VERSION mismatch` 错误。如需切换版本，重新编译：`cd backend && npm rebuild better-sqlite3`（需关闭所有占用该 .node 文件的进程）。

## 3. 目录结构（非显而易见部分）

```
├── src/                      # 前端源码
│   ├── components/           # React 组件
│   ├── data/                 # 数据层：API 调用、向量存储、知识库同步、RAG
│   ├── utils/                # 工具函数（v6.0+ 新增 fileCompressor.ts）
│   └── types/                # TypeScript 类型
├── backend/                  # 后端源码（独立 package.json）
│   ├── routes/               # API 路由（24 个路由模块）
│   ├── services/             # 业务服务：docParser、kbWorker、embeddingService、chunker
│   ├── middleware/           # auth（JWT）、kbSyncTrigger
│   ├── db.js                 # SQLite 连接（better-sqlite3，同步 API）
│   ├── server.js             # 入口，生产模式托管 dist/ 静态文件
│   └── data/                 # SQLite 数据库文件（planning.db）
├── deploy/                   # 部署配置（nginx-ssl.conf 等）
├── dist/                     # 前端构建产物（gitignore，生产模式由后端托管）
├── files/                    # 用户上传文件存储（按 projectId/docId 分目录）
└── logs/                     # 运行日志
```

**双 package.json**：根目录是前端依赖，`backend/` 是后端依赖。安装依赖时注意在正确目录执行。

## 4. 常用命令

### 前端（根目录）

```bash
npm run dev          # 启动开发服务器（端口 5300，代理 /api → localhost:3000）
npm run build        # 类型检查 + 生产构建（tsc && vite build）→ dist/
npm run preview      # 预览构建产物
npx tsc --noEmit     # 仅类型检查（不生成文件）
npm test             # Vitest 单元测试
```

### 后端（backend/ 目录）

```bash
node server.js                  # 开发模式启动（端口 3000）
$env:NODE_ENV="production"; node --max-old-space-size=4096 server.js  # 生产模式
```

后端无独立的 dev 脚本，如需热重载用 `nodemon server.js`（需全局安装 nodemon）。

### 全栈启动（开发模式）

需要两个终端：
1. `cd backend && node server.js`（端口 3000）
2. `npm run dev`（端口 5300，自动代理 API）

访问 `http://localhost:5300`。

## 5. 架构要点（修改前必读）

### 5.1 双轨 AI 知识库

系统有两套独立的知识库索引机制，修改上传/解析逻辑时**两条路都要考虑**：

| 轨道 | 位置 | 触发方式 | 存储 |
|------|------|---------|------|
| 前端本地 | `src/data/ragService.ts` → `documentParser.ts` → `vectorStore.ts` | UploadModal 中 `indexDocument()` fire-and-forget | 浏览器 IndexedDB |
| 后端服务端 | `backend/services/kbWorker.js` 轮询 `kb_sync_queue` | 上传成功后 `enqueueKbSync()` 入队 | 后端向量库 + Neo4j |

前端解析用 `pdfjs-dist`（浏览器端），后端解析用 `pdf-parse` + `mammoth` + `xlsx`（Node 端）。两者独立，互不依赖。

### 5.2 上传链路（v6.0）

支持两种上传模式，前端自动分流：

- **小文件（≤10MB）**：Base64 → JSON body → `POST /api/documents/upload` → 受 `express.json({limit:'10mb'})` 约束
- **大文件（>10MB）**：FormData → `POST /api/documents/upload/multipart` → multer 流式落盘 → 绕开 express.json 限制，上限 200MB

`docParser.js` 解析上限 200MB，PDF >50MB 时限解析前 1000 页防 OOM。支持 `.dwg/.dxf`（CAD 元数据索引）和 `.zip`（自动解压递归解析）。

修改上传相关代码时，注意：
- `documents.js` 有两个上传端点（`/upload` 和 `/upload/multipart`），都要入队 `kb_sync_queue`
- 前端 `UploadModal.tsx` 同时触发前端本地索引（`indexDocument`）和后端上传
- Nginx `client_max_body_size` 需 ≥ 200M（已在 `deploy/nginx-ssl.conf` 配置）

### 5.3 认证与权限

- JWT 认证，中间件 `requireAuth`（登录态）和 `requirePermission('can_upload')`（权限位）
- 上传端点需要 `can_upload` 权限
- 用户信息在 `req.user`（由 auth 中间件注入），上传记录用 `req.user?.username` 作为上传人，**不要信任客户端传入的 uploader**

### 5.4 数据库

- SQLite 用 `better-sqlite3`，**同步 API**（`db.prepare().run()/.get()/.all()`），不是异步
- 数据库文件在 `backend/data/planning.db`
- 关键表：`documents`（上传记录）、`kb_sync_queue`（知识库同步队列）、`projects`、`users`
- Neo4j 用于知识图谱，未配置时相关功能降级，不影响核心功能

## 6. 环境变量

后端环境变量在 `backend/.env`（从 `.env.example` 复制）。关键变量：

| 变量 | 用途 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥（生产环境必须修改） |
| `DEEPSEEK_API_KEY` | DeepSeek 聊天 API |
| `DASHSCOPE_API_KEY` | 通义千问 Embedding API |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | Neo4j 连接（可选） |
| `FILES_PATH` | 上传文件存储目录（默认 `./files`） |
| `PORT` | 后端端口（默认 3000） |

**不要在代码或提交中硬编码 API Key。** 前端 `.env` 中的变量会被打包进产物，敏感 Key 只放后端。

## 7. 部署

### 生产部署步骤

1. `npm run build`（根目录，构建前端到 `dist/`）
2. `cd backend && npm install`（确保后端依赖完整）
3. 确认 `backend/.env` 配置正确
4. `$env:NODE_ENV="production"; node --max-old-space-size=4096 server.js`
5. 生产模式下后端自动托管 `dist/` 静态文件，访问 `http://localhost:3000`

### Nginx（如使用）

- 配置文件：`deploy/nginx-ssl.conf`
- `client_max_body_size 200M`（必须，支持大文件上传）
- `/api/` 反向代理到后端 `localhost:3000`
- 静态文件可由 Nginx 直接服务，或由后端托管（二选一）

### Docker

`docker-compose.yml` + `Dockerfile`，适合标准部署。注意 Docker 内 Node 版本需与 `better-sqlite3` 编译版本一致。

## 8. 开发约束与注意事项

1. **文件路径安全**：上传/下载文件时必须验证路径在 `FILES_ROOT` 内，防路径穿越。`documents.js` 中有 `isPathSafe()` 和 `sanitizeFilename()` 工具函数，新增文件操作时复用。
2. **同步数据库**：`better-sqlite3` 是同步 API，不要在数据库操作中用 `await`。长耗时操作（如大文件解析）在 `kbWorker` 异步队列中处理，不阻塞请求。
3. **大文件内存**：解析 >50MB 文件时注意 V8 堆内存，生产模式用 `--max-old-space-size=4096` 启动。`docParser.js` 中有页数限制和大小预检，不要轻易移除。
4. **前后端类型一致**：`UploadInfo` 等共享类型在 `src/types/index.ts`，后端无 TypeScript，靠约定保持一致。修改上传数据结构时两边都要改。
5. **PWA**：前端是 PWA，有 Service Worker（`sw.js`），部署后用户可能看到缓存的旧版本，提示用户刷新或在 `vite.config.ts` 中配置版本号。
6. **移动端**：`mobile.html` 是独立入口，`src/mobile/` 是移动端页面，修改上传逻辑时注意移动端（`MobileUpload.tsx`）是否也需要同步。
7. **提交前检查**：`npx tsc --noEmit` 确保无类型错误；后端用 `node --check routes/xxx.js` 验证语法。

## 9. 常见问题排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 后端启动报 `NODE_MODULE_VERSION mismatch` | Node 版本与 better-sqlite3 编译版本不一致 | 用 Node v22 启动，或 `npm rebuild better-sqlite3` |
| 大文件上传报 413 | Nginx 或 express.json 限制 | 检查 Nginx `client_max_body_size`；大文件应走 `/upload/multipart` 端点 |
| 上传成功但 AI 检索不到 | 知识库同步队列积压或 kbWorker 未运行 | 检查 `kb_sync_queue` 表状态，确认后端进程正常 |
| 前端页面空白 | PWA 缓存了旧版本 / dist 未构建 | 硬刷新；生产模式确认 `npm run build` 已执行 |
| `npm rebuild` 报 EBUSY/EPERM | better_sqlite3.node 被进程占用 | 关闭所有 node 进程后重试 |
