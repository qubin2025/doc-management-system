# 变更日志 (Changelog) — 迭代 5 · 任务 5.11/5.12/5.13

> **提交哈希**：`9797e8e`
> **日期**：2026-08-20
> **分支**：`release/v2.5.0-enterprise-20260708`
> **变更统计**：8 个文件，+1439 / -11 行

---

## 概览

本次迭代围绕"知识库同步链路的可观测性、数据迁移、容灾降级"三个主题，完成 3 个任务：

| 任务 | 主题 | 核心交付 |
|------|------|---------|
| 5.11 | Worker 健康监控 UI | 前端可视化 Worker 启停、统计、队列、错误 |
| 5.12 | 向量数据迁移脚本 | localStorage → SQLite vector_embeddings 端到端迁移 |
| 5.13 | 前端 kbQueueProcessor 双跑期保留 | 后端优先 + 失败 3 次自动降级到前端模式 |

---

## 5.11 Worker 健康监控 UI

### 目标
在前端知识库页面可视化 Worker 的启动/停止/统计/队列/错误，让用户直观感知后端 Worker 的运行状态。

### 核心改动

#### 1. 可展开详情面板
- 顶部状态条精简显示关键指标（运行状态、待处理、处理中、已完成、失败、退避中、已跳过）
- 新增"查看详情"按钮，点击展开完整监控面板
- 面板包含 4 个区块：
  - **7 项统计卡片**：已处理 / 成功 / 失败 / 重试 / 跳过 / 超时 / 平均耗时
  - **队列进度条**：pending → processing → done / failed，可视化任务流转
  - **运行时间线**：Worker 启动时间、累计运行时长（uptime）、in-flight 任务数
  - **最近错误**：展示最近 N 条失败任务的错误信息（可滚动）

#### 2. 辅助函数
- `formatUptime(ms)`：毫秒转 "Xh Ym Zs" 可读格式
- `formatDateTime(iso)`：ISO 时间字符串转本地时间显示
- `isWorkerStale(timestamp)`：判断状态是否过期（>10s 未更新）

#### 3. 状态条 UI 改进
- 模式徽章：根据 `workerMode` 显示"后端模式"（绿）/ "前端降级"（琥珀）/ "双跑模式"（紫）
- 详情按钮带 ChevronDown/ChevronUp 图标切换

### 文件变更
| 文件 | 变化 | 说明 |
|------|------|------|
| `src/components/KnowledgeBase.tsx` | +165 / -8 | 新增监控面板、辅助函数、UI 组件 |

---

## 5.12 向量数据迁移脚本

### 目标
将浏览器 localStorage 中的旧向量数据迁移到后端 SQLite `vector_embeddings` 表，实现数据共享与持久化。

### 核心改动

#### 1. 后端迁移路由
- 新增 `POST /api/kb/migrate/local-vectors` 端点（kbSync.js）
- 接收前端分批推送的向量数据（每批最多 200 条）
- 事务化批量入库：
  - `vector_embeddings` 表 INSERT OR REPLACE（按 id 去重）
  - `vector_embeddings_fts` 表（FTS5）先删后插，同步全文索引
- 字段映射：localStorage 的 `{id, text, embedding, metadata}` → SQLite 的 `{id, project, doc_name, chunk_index, dimension, embedding(BLOB), sensitivity, metadata(JSON)}`
- 字段验证：无效记录跳过并返回错误明细

#### 2. 前端 API 与 UI
- `api.ts` 新增 `kbMigrateLocalVectors(docs: VectorDoc[])` 函数
- KnowledgeBase.tsx 新增：
  - "迁移本机数据"按钮（紫色边框，Upload 图标）
  - 分批 100 条迁移逻辑（连续推送，无间隔）
  - 紫色进度条显示迁移进度（已处理 / 总数 / 成功 / 跳过）
  - 完成后 toast 提示汇总

#### 3. 操作手册
- `docs/5.12_向量数据迁移操作手册_20260820.md`（8 章节 402 行）
- 覆盖：背景、前置条件、标准流程、数据安全保护、迁移后清理、高级场景、故障排查、附录

#### 4. 验证脚本与工具
- `run-migration-5.12-cli.cjs`（328 行）：9 步端到端验证脚本
  - 登录 → 生成测试数据 → 备份 → 迁移前状态 → 迁移 → 迁移后状态 → 数据一致性 → Worker 实时性 → 清理
- `check-precondition.cjs`：迁移前置条件检查（后端状态、表完整性、数据量）
- `cleanup-fts-residual.cjs`：FTS5 孤儿记录清理工具（解决 UNINDEXED 列 LIKE 查询失效问题）

### 验证结果
- ✅ 30 条测试向量全部入库（inserted=30, skipped=0）
- ✅ 数据一致：vector_embeddings=30, FTS5=30
- ✅ 项目分布正确：demo-project-alpha:15, demo-project-beta:15
- ✅ 敏感度分布正确：{0:10, 1:10, 2:10}
- ✅ 抽样记录字段完整（dimension=8, embedding_bytes=32）

### 发现并修复的问题
- **FTS5 虚拟表 UNINDEXED 列不支持 LIKE/GLOB 查询**：清理脚本用 `DELETE FROM fts WHERE external_id LIKE 'mock-%'` 返回 0 条。修复为子查询：`DELETE FROM fts WHERE external_id NOT IN (SELECT id FROM vector_embeddings)`

### 文件变更
| 文件 | 变化 | 说明 |
|------|------|------|
| `backend/routes/kbSync.js` | +82 | 新增迁移路由 + 故障注入开关 |
| `src/data/api.ts` | +21 | 新增 kbMigrateLocalVectors 函数 |
| `src/components/KnowledgeBase.tsx` | (含在 5.11 改动中) | 迁移按钮 + 进度条 |
| `docs/5.12_向量数据迁移操作手册_20260820.md` | +528 | 用户操作手册 |
| `backend/services/run-migration-5.12-cli.cjs` | +328 | 端到端验证脚本 |
| `backend/services/check-precondition.cjs` | +13 | 前置检查 |
| `backend/services/cleanup-fts-residual.cjs` | +26 | FTS5 清理工具 |

---

## 5.13 前端 kbQueueProcessor 双跑期保留

### 目标
在后端 Worker 稳定前，保留前端 `kbQueueProcessor.ts` 作为降级方案，实现"后端优先 + 自动降级"的混合融合架构。

### 核心改动

#### 1. 三模式状态机
- 新增 `workerMode` state：`'backend' | 'frontend' | 'hybrid'`
- **backend（默认）**：仅后端 Worker 处理队列
- **frontend（降级）**：后端连续 3 次 `/worker/status` 失败时自动切换，启用 `startQueuePoller` 在浏览器内处理
- **hybrid（双跑）**：前端轮询 + 后端 Worker 同时运行，依赖原子领取（`UPDATE ... WHERE status='pending'`）避免重复处理

#### 2. 自动降级逻辑
- 合并原有两个 `useEffect` 为单个持续轮询（修复 bug：原逻辑仅在 `isRunning=true` 时才轮询，导致后端启动时就不可用时无法触发降级）
- 失败计数 `backendFailCount`：每次 `/worker/status` 失败 +1，成功归零
- 阈值 3：连续失败 ≥3 次且当前模式为 backend 时切换到 frontend
- toast 提示："后端 Worker 连续 3 次无响应，已自动切换到前端降级模式"

#### 3. 顶栏模式切换
- 新增下拉菜单：backend / frontend / hybrid 三选
- 状态条显示当前模式徽章（颜色区分）

#### 4. 故障注入开关
- `kbSync.js` 在 `/worker/status` 路由注入 `SIMULATE_WORKER_DOWN` 环境变量开关
- 设置 `SIMULATE_WORKER_DOWN=1` 时强制返回 503，用于回归测试

#### 5. 降级验证脚本
- `test-failover-5.13.cjs`（93 行）：模拟前端健康检查轮询
  - 登录 → 连续 5 次调用 `/worker/status`（1.5s 间隔）→ 验证第 3 次失败时触发降级

### 验证结果
- ✅ 3 次失败后正确触发降级（workerMode: 'backend' → 'frontend'）
- ✅ 后端恢复正常后不自动切回（需要用户手动切换，避免抖动）
- ✅ Worker 健康检查接口实时性：5 次调用返回不同 timestamp（3-13ms 响应时间）

### 发现并修复的 Bug
- **降级逻辑失效 bug**：原 `useEffect` 依赖 `[]` 只在挂载时跑一次，且仅在 `isRunning=true` 时才启动 3s 轮询。如果后端启动时就不可用，`workerStatus` 为 null，`isRunning` 为 false，**永远不会启动轮询，永远到不了 3 次失败**。修复为合并为单个 `useEffect`，挂载时立即检查 + 每 3s 持续轮询，无论 workerStatus 状态如何。

### 文件变更
| 文件 | 变化 | 说明 |
|------|------|------|
| `src/components/KnowledgeBase.tsx` | (含在 5.11 改动中) | workerMode 状态 + 自动降级 + 模式切换 |
| `backend/routes/kbSync.js` | (含在 5.12 改动中) | SIMULATE_WORKER_DOWN 故障开关 |
| `backend/services/test-failover-5.13.cjs` | +93 | 降级验证脚本 |

---

## 综合验证结果

| 验证项 | 结果 |
|--------|------|
| TypeScript 类型检查 | ✅ 零错误 |
| 5.12 迁移端到端 | ✅ 30 条测试数据全部入库，数据一致 |
| 5.13 降级验证 | ✅ 3 次失败后正确触发降级 |
| Worker 健康检查实时性 | ✅ 5 次调用返回不同 timestamp |
| 单元测试套件 | ⚠️ 147/150 通过（3 个失败为 Dashboard.test.tsx 历史遗留，与本次无关） |
| Git 提交与推送 | ✅ 9797e8e 已推送至 GitHub origin 分支 |

---

## 技术决策记录

### 决策 1：FTS5 清理改用子查询而非 LIKE
- **背景**：FTS5 虚拟表的 UNINDEXED 列（external_id）不支持 LIKE/GLOB 查询
- **方案**：`DELETE FROM fts WHERE external_id NOT IN (SELECT id FROM vector_embeddings)`
- **影响**：清理孤儿记录时需要全表扫描，但数据量 <10000 时性能可接受

### 决策 2：降级后不自动切回后端
- **背景**：避免后端短暂抖动导致模式反复切换
- **方案**：降级到 frontend 后，需要用户手动切换回 backend（通过顶栏下拉菜单）
- **影响**：用户需要感知降级发生（通过 toast 提示 + 模式徽章）

### 决策 3：双跑期保留 kbQueueProcessor.ts
- **背景**：后端 Worker 稳定性尚未经过长期验证
- **方案**：保留前端 kbQueueProcessor.ts 全部代码，过渡期 2-4 周后再评估是否移除
- **影响**：前端 bundle 体积略大，但保证降级能力

---

## 后续待办

| 项 | 说明 |
|----|------|
| 修复 Dashboard.test.tsx 3 个失败用例 | 历史遗留问题，需更新测试期望文字 |
| 提交 ModuleHeader.tsx 到 git | 当前 untracked，被 81 处引用，必须立即提交 |
| 完善 .gitignore | 添加 `logs/`、`.trae/`、`data/` 等规则 |
| 长期验证后端 Worker 稳定性 | 决定是否移除前端 kbQueueProcessor.ts |
