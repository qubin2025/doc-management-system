# 全过程工程咨询管理系统 — 项目开发规范与最高原则

## 一、最高原则

### 1. 真实可用 > 表面通过
- 永远不为了消除报错而做表面修复
- 每个功能必须端到端真实可用，而非仅"编译通过"或"测试跳过"
- 健康检查必须是真实端口探测，不可仅检查环境变量是否存在

### 2. 离线降级 ≠ 默认离线
- 离线模式是容灾策略，不是默认状态
- 环境条件满足时必须启动全部服务，不可默认降级
- 启动时自动检测 Docker/Python 等可选服务，条件满足时警告未启动

### 3. 少即是多
- 好的技术看不出来技术 — 用户不需要知道用了多少模型、多少容器
- 优先使用默认配置满足 80% 场景，剩余 20% 通过可选参数覆盖
- 一个统一入口优于三个分散入口

### 4. 全局一致
- 所有同类模块的字体、按钮、交互保持一致
- 历史侧边栏、AI 指示灯、模型选择器在全部 AI 模块中位置与样式统一
- lint/fix 全项目执行，不留异类

### 5. 数据主权
- 用户数据优先保存在浏览器 localStorage（私人/安全）
- 服务器仅保留必要 API 日志，不存储审查结果、方案内容等业务文本
- 历史记录存储上限（30-50 条），可手动删除

### 6. 文档先行
- 每个重要决策必须有文档记录
- CLAUDE.md 是项目最权威的开发指南
- 部署说明包含所有环境变量、端口和启动条件

### 7. 字体克制
- 项目中最多使用 **3 种** 字号，禁止引入第4种
- 最小字体不小于 **12px**（Tailwind `text-xs`）
- 禁止使用 `text-[10px]` 等硬编码小号字体
- 推荐字号档位：12px/14px/16px 或 13px/15px/17px

### 8. 使用说明书规范
- 每个功能模块/卡片在说明文档中单独列为一个小节
- 说明文档风格为明亮/暖色系（禁止暗色背景）
- 最小字体 ≥ 12px，符合视觉传达设计原则
- 能结合SVG图表的优先用图表说明
- 新模块开发完成后必须同步更新说明文档对应小节

### 9. 品牌标识规范
- 全局Logo统一使用 `/public/zhjk-logo.png`，替换所有手写"ZHJK"文字块
- 系统名称：「中航建科 · 工程咨询管理平台」
- 品牌寓意：「源自中航，不断成长」
- 新增任何页面/组件时，顶栏Logo格式：`<img src="/zhjk-logo.png" alt="中航建科" className="h-9 w-auto" />`

## 二、项目结构 (v3.0)

```
工程资料管理系统源码/
├── src/                    # React 前端源码
│   ├── components/         # 38个React组件
│   │   ├── App.tsx         # 主路由中枢(934行, 39view)
│   │   ├── HomePage.tsx     # v5.1: 项目首页(219行)
│   │   ├── GuideChapter.tsx # 全过程指南工作模块(698行)
│   │   ├── TargetManager.tsx    # P0: 目标管理WBS树
│   │   ├── TailoringEngine.tsx  # P0: 模块裁剪引擎
│   │   ├── AgentConsole.tsx     # P1: Agent智能体控制台(Multi-Agent)
│   │   ├── SkillPanel.tsx       # P1: 技能面板
│   │   ├── PMBOKFramework.tsx   # P1: PMBOK知识领域框架
│   │   ├── AiChat/AiChatPage   # AI对话
│   │   ├── *Review.tsx          # 施工/合同/招投标审查
│   │   ├── Dashboard/GanttChart/NetworkDiagram/PlanManager
│   │   ├── KnowledgeBase/KnowledgeGraph
│   │   └── 其他业务组件... (共64个组件)
│   ├── data/               # 数据层(35个模块)
│   │   ├── agentFramework.ts   # P1: Agent智能体核心
│   │   ├── knowledgeOrchestrator.ts # P0: 统一知识编排器
│   │   ├── skillRegistry.ts    # P1: Skill注册表(7技能)
│   │   ├── mcpAgentBridge.ts   # P1: MCP协议+双向桥
│   │   ├── kgPipeline.ts       # P1: 知识图谱自动管道
│   │   ├── workflowEngine.ts   # P2: 工作流引擎(4模板)
│   │   ├── pmbokData.ts        # P1: PMBOK 10领域49过程
│   │   ├── objectiveEngine.ts  # P0: 目标进度计算引擎
│   │   ├── tailoringEngine.ts  # P0: PMBOK裁剪规则20条
│   │   ├── multiAgentOrchestrator.ts # v5.0: Multi-Agent编排器
│   │   ├── api.ts(681行)       # 统一API层(60+函数)
│   │   ├── knowledgeGraph.ts   # 知识图谱引擎
│   │   ├── vectorStore.ts      # 本地向量存储
│   │   ├── ragService.ts       # RAG检索增强
│   │   ├── indicatorEngine.ts  # CPI/SPI/完整度/质量分
│   │   ├── cpmEngine.ts        # CPM关键路径法
│   │   ├── qualityEngine.ts    # 数据质量评分
│   │   ├── chunker.ts          # 文本智能分块(3策略)
│   │   ├── documentParser.ts   # 全局文档解析器
│   │   ├── dataPipeline.ts     # 数据加工管道
│   │   ├── aiAgent.ts          # AI扫描(工作项/表单/KPI)
│   │   ├── guideModules.ts     # 4章41子模块200+工作项
│   │   └── appendixA*.ts       # 双规程附录A数据
│   ├── types/index.ts     # 30+ TypeScript接口
│   └── __tests__/          # 32个测试用例
├── backend/                # Node.js Express 后端
│   ├── routes/             # 10个路由文件(35+API端点)
│   │   ├── auth.js         # 认证+用户管理
│   │   ├── projects.js     # 项目CRUD
│   │   ├── documents.js    # 文档上传/下载/管理
│   │   ├── ai.js           # 7模型代理
│   │   ├── kg.js           # Neo4j知识图谱
│   │   ├── ragflow.js      # RAGFlow代理
│   │   ├── objectives.js   # P0: 目标管理API
│   │   ├── mcp.js          # P1: MCP协议端点
│   │   ├── backup.js       # 备份/导出
│   │   └── import.js       # 数据导入
│   ├── middleware/auth.js  # requireAuth/Role/Permission
│   ├── utils/audit.js      # P0: 审计日志
│   ├── db.js               # SQLite + Schema迁移
│   └── server.js           # 主入口 + 启动检测
├── services/               # Python微服务(3个)
│   ├── paddleocr-server/   # 文档OCR解析(:8001)
│   ├── lightrag-server/    # LightRAG知识引擎(:8000)
│   └── ragflow/            # RAGFlow知识库(Docker)
├── deploy/                 # 部署配置(nginx/PM2/systemd)
├── docs/                   # 文档/分析报告
└── docker-compose.yml      # 6服务编排
```

## 三、系统架构 — 四层模型

```
L4 · 项目管理系统层 (PM Application)
    ┌────────────┬────────────┬────────────┬────────────┐
    │ 目标管理    │ 模块裁剪    │ PMBOK框架   │ 工作流引擎  │  ← P0/P1/P2新增
    │ 进度管理    │ 成本管理    │ 质量管理    │ 风险管理    │
    │ 资料管理    │ 供应商管理  │ 归档管理    │ AI对话      │
    └────────────┴────────────┴────────────┴────────────┘
L3 · AI应用层 (Intelligence)
    ┌────────────┬────────────┬────────────┬────────────┐
    │ Agent智能体 │ Skill技能  │ MCP协议    │ RAG检索    │  ← P1新增
    │ AI审查(3种) │ AI生成     │ AI分析     │ AI填表     │
    └────────────┴────────────┴────────────┴────────────┘
L2 · 知识工程层 (Knowledge)
    ┌────────────┬────────────┬────────────┬────────────┐
    │ 知识编排器  │ 知识图谱   │ 向量存储    │ LightRAG   │
    │ 自动KG管道 │ RAGFlow    │ 智能分块    │ 全文检索    │  ← P0/P1新增
    └────────────┴────────────┴────────────┴────────────┘
L1 · 数据沉淀层 (Data Foundation)
    ┌────────────┬────────────┬────────────┬────────────┐
    │ SQLite     │ localStorage│ IndexedDB  │ Neo4j      │
    │ objectives │ baselines  │ artifacts  │ audit_log  │  ← P0新增4表
    └────────────┴────────────┴────────────┴────────────┘
```

## 四、Agent / Skill / MCP 体系 (v3.0核心)

### 三层统一架构
```
MCP协议层 — 工具标准化 (AgentAction↔MCPTool双向映射)
  ↑
Skill技能层 — 7个领域Skill封装 (审查/生成/填写/指南/拆解)
  ↑
Agent智能体 — ReAct推理循环 (规划→观察→推理→执行→恢复)
```

### Agent智能体 (src/data/agentFramework.ts)
- **EngineeringAgent** 类: 工具注册/ReAct推理/错误恢复(retry/skip/fallback/abort)
- **11个内置工具**: ai_chat, compute_kpi, scan_workitems, scan_forms, knowledge_search, knowledge_graph, rag_search, index_document, fill_form, health_check等
- **确认机制**: 变更类操作(mutate)需用户确认
- **全局单例**: `engineeringAgent`

### Skill技能注册表 (src/data/skillRegistry.ts)
| Skill ID | 名称 | 类别 |
|----------|------|------|
| construction-review | 施工方案审查 | review |
| contract-review | 合同审查 | review |
| bid-review | 招投标审查 | review |
| plan-generate | AI方案生成 | generate |
| ai-fill-form | AI表单填写 | fill |
| ai-guide-notes | AI办理指南 | guide |
| ai-breakdown-tasks | AI拆解子任务 | guide |

### MCP协议 (src/data/mcpAgentBridge.ts)
- **MCPServerRegistry**: 服务器注册/发现/工具调用
- **双向桥**: AgentAction自动导出为MCPTool，远程MCPTool自动注册为AgentAction
- **后端端点**: `/api/mcp/tools/list`, `/api/mcp/health`

## 五、API端点清单 (73+端点和20路由)

| 路由前缀 | 文件 | 端点数 | 认证 |
|----------|------|--------|------|
| `/api/projects` | projects.js | 3 (GET/POST/DELETE) | requireAuth/Role |
| `/api/documents` | documents.js | 6 | requireAuth/Permission |
| `/api/auth` | auth.js | 8 | 混合 |
| `/api/ai` | ai.js + ai_admin.js | 7 | 混合 |
| `/api/kg` | kg.js + kg_graphrag.js | 9 | requireAuth |
| `/api/ragflow` | ragflow.js | 7 | requireAuth |
| `/api/objectives` | objectives.js | 7 | requireAuth/Role |
| `/api/mcp` | mcp.js | 2 | requireAuth |
| `/api/backup` | backup.js | 3 | requireAuth/Role |
| `/api/import` | import.js | 1 | requireAuth |
| `/api/mobile` | mobile.js | 10+ | requireAuth |
| `/api/data` | data.js | 3 | requireAuth |
| `/api/experience` | experience.js | 4 | requireAuth |
| `/api/stakeholders` | stakeholders.js | 3 | requireAuth |
| `/api/sync` | sync.js | 2 | requireAuth |
| `/api/export` | export.js | 2 | requireAuth |
| `/api/baselines` | baselines.js | 3 | requireAuth/Role |
| `/api/audit` | audit.js | 1 | requireAuth |
| `/api/kb` | kbSync.js (v5.4) | 4 (sync/status, sync/daily, sync/issues, sync/experiences) | requireAuth |

## 六、数据库Schema (21张表)

| 表名 | 用途 | 版本 |
|------|------|------|
| projects | 项目列表 | v1.0 |
| documents | 文档/文件存储 | v1.0 |
| users | 用户认证(4角色) | v1.0 |
| sessions | JWT会话 | v1.0 |
| **objectives** | 目标层级(WBS) | v3.0 P0 |
| **baselines** | 三大基线快照 | v3.0 P0 |
| **knowledge_artifacts** | 知识加工产物 | v3.0 P0 |
| **audit_log** | 操作审计日志 | v3.0 P0 |
| daily_reports | 项目日报(8段模板) | v4.4 |
| issues | 现场问题管理 | v4.4 |
| progress_reports | 进度快报 | v4.4 |
| experience_items | 项目经验库 | v4.4 |
| mobile_photos | 手机端照片 | v4.4 |
| ... | 其他业务表 | v4.4+ |

## 七、全局单例 (src/data/ 模块级导出)

| 单例 | 文件 | 用途 |
|------|------|------|
| `engineeringAgent` | agentFramework.ts | Agent智能体 |
| `multiAgentOrchestrator` | multiAgentOrchestrator.ts | Multi-Agent编排器(5角色) |
| `skillRegistry` | skillRegistry.ts | Skill注册表 |
| `mcpRegistry` | mcpAgentBridge.ts | MCP服务器注册 |
| `orchestrator` | knowledgeOrchestrator.ts | 知识编排器 |
| `kgPipeline` | kgPipeline.ts | KG自动构建管道 |
| `vectorStore` | vectorStore.ts | 本地向量存储 |

## 八、全局能力 — 三色主题系统

### 架构
```
themeEngine.ts (状态管理)
    ↓
index.css (30+CSS变量 × 3套主题)
    ↓
ThemeSwitcher.tsx (UI切换器)
    ↓
Tailwind darkMode: 'class' (暗色自动适配)
```

### 核心文件

| 文件 | 用途 |
|------|------|
| `src/data/themeEngine.ts` | 主题引擎: getTheme/setTheme/applyTheme/initTheme, localStorage持久化 |
| `src/index.css` | CSS变量(亮白/暖色/暗色三套), 全局暗色覆盖规则, 输入框/弹窗/表格适配 |
| `src/components/ThemeSwitcher.tsx` | 三按钮下拉菜单（Sun/Moon/Sunrise），实时切换 |

### 组件适配原则
1. 新组件使用CSS变量: `bg-[var(--bg-card)]` `text-[var(--text-primary)]`
2. 旧组件依赖 index.css 全局覆盖规则
3. **所有input必须**: `type="text" border-gray-300 text-gray-800 bg-white`
4. 弹窗边框兜底: `.dark .fixed .border:not([class*="border-"])`
5. 新增组件参考: `memory/reference_theme_system.md`

### 配色方案
| 主题 | 背景 | 文字 | 强调 | 场景 |
|------|------|------|------|------|
| ☀️ 亮白 | #fff | #1f2937 | #3b82f6 蓝 | 白天 |
| 🌅 暖色 | #fefaf6 | #4a3728 | #c87941 橙 | 护眼 |
| 🌙 暗色 | #0f172a | #e2e8f0 | #38bdf8 天蓝 | 夜间 |

## 九、开发保障机制

### 保持方向正确的核心要素
1. **CLAUDE.md 全局最高原则** — 每次修改前重读，确保对齐
2. **开发计划 → 任务列表 → 端到端验证** — 三层闭环
3. **真实 API 测试替代 mock** — curl 验证所有端点
4. **CI 环境不可用时本地完整构建 + 测试套件**
5. **每次提交前 TSC零错误 + 32 测试全通过**

### 代码模式
- **前端**: React.FC<Props> + useState (无Context/Redux)，乐观更新(localStorage+API双写)，Tailwind CSS
- **后端**: Express Router，better-sqlite3同步API，requireAuth/Role/Permission中间件
- **数据**: src/data/纯TypeScript模块，全局单例模式

### 验证命令
```bash
npx tsc --noEmit          # TypeScript类型检查
npx vitest run            # 32个测试
npx vite build            # 前端构建
node backend/server.js    # 后端启动(:3000)
npx vite --host           # 前端启动(:5300)
```

## 九.一、代码修改红线（2026-07-24 补充）

> **血泪教训**：2026年7月24日开发中，DesktopDailyReport.tsx 因反复使用 `sed`、`node -e` 等 shell 脚本进行碎片化行内修改，导致文件 JSX 结构损毁（丢失 KV 组件、重复闭合标签、函数作用域错乱），累计消耗 2+ 小时无效排错。PromptConfigDialog 组件本身无任何问题，仅需 3 行代码即可接入，但因文件损毁自动化注入全部失败。

### 绝对禁止

| 红线 | 说明 | 为何禁止 |
|------|------|---------|
| **禁止 sed 修改 JSX/TSX 文件** | 不允许用 `sed -i` 对 `.tsx` 文件做行内替换 | sed 不理解 JSX 层级结构，容易破坏标签闭合、作用域嵌套 |
| **禁止 node -e 行内注入** | 不允许用 `node -e` 或 inline script 向现有组件文件注入代码 | Bash 转义与 JS 语法叠加出错率极高，修复耗时远超手动开发 |
| **禁止碎片化补丁迭代** | 不允许对同一文件多次零散局部修改，应统一规划后一次性完成 | 多次碎片补丁导致文件结构腐化，逐步演变为「屎山」 |

### 必须遵守

| 规则 | 说明 |
|------|------|
| **大改动用 Write** | 如需修改 >5 行的 TSX 文件，直接使用 Write 工具完整重写，确保结构规整 |
| **小改动精确匹配** | 仅 1-3 行修改时，使用 Edit 工具，确保 old_string 唯一匹配 |
| **结构损毁立即重构** | 一旦出现 JSX 编译错误（TS2657/TS1005/TS1128），立即停止修补，用 Write 完整重建 |
| **组件化隔离** | 新增功能优先创建独立组件（如 PromptConfigDialog），避免侵入已有复杂页面 |
| **先编译验证** | 每次修改后立即 `npx tsc --noEmit`，错误 >3 个即回退重做 |
| **老旧文件手工处理** | 多次补丁的老旧文件禁止自动化注入，统一手动开发 |

### 页面固定结构规范（强制落地）

所有 React 页面统一固定区块顺序：
```
导入区 → 状态定义区 → 业务方法区 → 纯 JSX 渲染区 → 导出区
```
不允许打乱层级穿插代码。新页面严格遵循此结构，老页面重构时统一规整。

### 开发规则补充（迭代卡点止损）

```
if (TSC 错误数 > 3) → 停止修补 → Write 完整重建
if (同一文件已修改 >3 次) → 停止修补 → Write 完整重建  
if (sed/node-e 修改后编译失败) → 立即回退 → 手动开发
if (JSX 结构解析异常) → 立即止损 → 切换手动标准化开发
if (老旧破损文件) → 永久禁用自动化注入 → 仅手动规范开发
```

> 完整落地手册参见：`迭代任务最终终端执行操作指令（完整落地手册）.docx`

## 九.二、代码健康门禁（2026-07-25 补充）

基于 2026-07-25 代码健康度综合评估（评分 5.6/10），建立以下 **5 条强制门禁规则**：

| # | 门禁规则 | 检查方式 | 违反后果 |
|---|---------|---------|---------|
| 1 | **禁止新文件超过 250 行** | 新建文件时自查 `wc -l` | MR 不予合入 |
| 2 | **禁止新增 `any` 类型** | `npx tsc --noEmit` 零 `any` 新增 | MR 不予合入 |
| 3 | **禁止新模块 prop drilling** | 跨组件共享状态必须使用 Context | MR 不予合入 |
| 4 | **禁止 sed/node-e 修改 TSX** | 仅用 Write/Edit 工具 | 立即回退 |
| 5 | **新组件必须有测试文件** | 新建 `__tests__/ComponentName.test.tsx` | MR 不予合入 |

### 存量改进策略（「改旧做新」原则）

```
不单独占用迭代周期做重构
在功能开发中渐进式改进触及的模块
每次触及 App.tsx 时拆分一个子路由（每次减 ~100 行）
每次触及 api.ts 时统一一处认证逻辑
6个迭代内综合评分目标 ≥7.0
```

### 代码健康度参考文档

- `前端项目代码健康度提升专项执行清单.docx` — 九维度评估 + 门禁规则
- `迭代任务最终终端执行操作指令（完整落地手册）.docx` — 代码修改红线 + 止损机制
- `docs/全过程工程咨询管理系统_开发总结与下一步方向_20260714.html` 第十五章

## 九、版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v2.5.0 | 2026-07-08 | 基础平台(AI对话/审查/生成/知识图谱) |
| **v3.0 P0** | 2026-07-13 | 目标管理+模块裁剪+知识编排+数据库升级 |
| **v3.0 P1/P2** | 2026-07-13 | Agent+Skill+MCP+PMBOK+KG管道+工作流 |
| **v4.1** | 2026-07-14 | 三色主题全局能力·手机端API·暗色19轮适配·SKILL配置中台·AgentConsole升级·数据持久化·IndexedDB迁移·AI安全防护 |
| **v4.4** | 2026-07-21 | 手机UI重设计·日报体系(8段模板)·Recharts图表·PWA安装·DesktopDailyReport·知识图谱25节点·代码健康评估 |
| **v5.0** | 2026-07-27 | Ollama本地AI(qwen2.5:7b)·Docker健康检查·GraphRAG图检索(9端点)·Multi-Agent协作(5角色) |
| **v5.1** | 2026-07-27 | 还债止血: App.tsx 1373→934行·HomePage/StandardSelect组件化·kg.js 579→125行·ai.js 536→451行·门禁收紧250行 |
| **v5.4** | 2026-08-18 | 知识库方案A: 后端业务表(日报/问题/经验)自动入库向量库+知识图谱·kbSync.js路由(4端点)·kbSyncService.ts(4段拆块/去重写入/容量预警/并发嵌入)·vectorStore批量API·buildGraph反查向量构建节点·UI同步按钮+进度展示 |

### v5.4 知识库同步机制（方案A）

**目标**：将后端三张高价值业务表自动入库到向量库+知识图谱，实现"项目运行沉淀即知识"。

**数据流**:
```
后端 SQLite 业务表 (daily_reports / mobile_issues / project_experiences)
    ↓ kbSync.js 路由 (4 端点)
    /api/kb/sync/status  → 各项目最后更新时间（供增量同步判断）
    /api/kb/sync/daily   → 日报列表（含子表 JSON）
    /api/kb/sync/issues  → 问题列表
    /api/kb/sync/experiences → 经验列表
    ↓ kbSyncService.ts (前端入库服务)
    1. 文本化：日报按 4 段拆块（进度/质量风险/现场问题/原文备注）
    2. 去重：vectorStore.removeByPrefix(prefix, project) 按前缀删旧向量
    3. 嵌入：api.embedText 并发 5 条降低延迟
    4. 入库：vectorStore.addDocuments 批量写入（一次保存）
    5. 容量预警：单项目 >4MB 时只写 IndexedDB（跳过 localStorage 避免误删）
    ↓ buildGraph() 同步构建节点
    daily-{id} / issue-{id} / exp-{id} 节点反查向量库生成
    ↓ 用户触发
    KnowledgeBase 顶栏"同步业务数据"按钮（手动触发增量，可选全量重同步）
```

**关键约束**:
- 项目隔离：metadata.projectName 作为分区键，向量库按项目分键
- 去重前缀：`daily-{reportId}-seg{1-4}` / `issue-{issueId}` / `exp-{experienceId}`
- 容量上限：IndexedDB 200MB 软上限 + LRU 85% 淘汰
- 同步状态持久化：localStorage 键 `kb-sync-state` 存各项目最后同步时间
- 增量同步：按 `created_at` (日报) / `updated_at` (问题/经验) 过滤

### Git提交记录
```
f794bfe feat: P1/P2全面升级 — Agent+Skill+MCP+PMBOK+KG管道+工作流引擎
d86774a feat: P0核心架构升级 — 目标管理+模块裁剪+知识编排+数据库Schema
0de2db2 docs: 添加项目架构审视与发展分析报告
294c570 feat: AI分析增加loading状态防重复提交
```

## 十、面向企业级推广的筹备建议

### 降本增效方向
1. **统一解析** — EasyOCR/PaddleOCR 替代所有零散解析器
2. **RAGFlow 知识沉** — 文档自动入库、检索、追溯
3. **模板体系** — 方案生成 + 审查 + 合同模版标准化
4. **多租户** — PostgreSQL 替代 SQLite，工作空间隔离
5. **自动化部署** — Docker Compose → K8s，CI/CD GitHub Actions

### 必要筹备
- 文档先行：完整的使用说明书 + 视频培训
- 数据安全：SSO/OAuth集成，审计日志满足ISO27001
- 监控告警：Prometheus + Grafana，异常自动通知
- 灰度发布：金丝雀部署策略，避免全量回滚

## 十一、开发纪律与防回退保障 (2026-07-28 补充)

> **血泪教训**：v4.4-v5.1 全部代码因未提交而在 git 保护之外长达 6 天。一次 `git checkout` 操作回退了 v4.4 全部新增代码，6 个回退事件累计消耗数十小时修复。本章为制度化防回退机制，强制执行。

### 11.1 提交纪律（零容忍）

```
每完成一个独立功能 → git add + git commit（不积累多个功能）
每轮对话结束前     → git status 确认无遗漏
每次大规模修改前   → git commit 创建 checkpoint
新增文件立即跟踪   → 不在 untracked 状态停留超过 1 小时
单次提交 ≤ 10 个文件变更
```

### 11.2 Git 安全操作规范

| 禁止 | 替代方案 |
|------|---------|
| ❌ `git checkout -- <file>` | ✅ `git stash` 暂存改动 |
| ❌ `git reset --hard` | ✅ `git reset --soft` 保留工作区 |
| ❌ `git clean -fd` | ✅ 先 `git status` 确认，再手动逐文件处理 |
| ❌ 有未提交改动时切换分支 | ✅ 先 `git stash` → 切换 → `git stash pop` |

### 11.3 Checkpoint 机制

```
大规模重构前:
  git add -A && git commit -m "checkpoint: <重构目标>前快照"

高风险文件重写前:
  git stash && git branch backup-$(date +%Y%m%d-%H%M)

单文件整体重写前:
  保留旧文件备份 → Write 新文件 → TSC 验证 → 删除备份
```

### 11.4 日常代码整洁实践

| 实践 | 说明 |
|------|------|
| **一个功能一个提交** | 不把多个不相关改动混在一个 commit |
| **提交信息写清楚"为什么"** | 不只是"fix bug"，而是"fix: 日报解析失败-DeepSeek返回markdown包裹的JSON" |
| **删除代码有记录** | 大段删除单独提交并注明原因 |
| **不积累未提交改动** | 修改文件数 >5 且未提交 → 立即提交 |
| **提交前验证** | `git status` + `git diff --stat` + `npx tsc --noEmit` |
| **CLAUDE.md 同步更新** | 每次功能交付后更新文件数/行数统计数据 |

### 11.5 对话结束检查清单

开发会话结束前必须逐项确认：

- [ ] `git status` — 无遗漏的 untracked/modified 文件
- [ ] `git diff --stat` — 所有改动已审阅
- [ ] `npx tsc --noEmit` — 零 TypeScript 错误
- [ ] `git log --oneline -3` — 确认当日提交记录
- [ ] 新增文件 ≤ 250 行 — wc -l 检查
- [ ] CLAUDE.md 统计数据已更新
- [ ] 无临时调试文件残留（*.cjs, test-*.js 等）
