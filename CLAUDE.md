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

### 7. 使用说明书规范
- 每个功能模块/卡片在说明文档中单独列为一个小节
- 说明文档风格为明亮/暖色系（禁止暗色背景）
- 最小字体 ≥ 12px，符合视觉传达设计原则
- 能结合SVG图表的优先用图表说明
- 新模块开发完成后必须同步更新说明文档对应小节

## 二、项目结构 (v3.0)

```
工程资料管理系统源码/
├── src/                    # React 前端源码
│   ├── components/         # 38个React组件
│   │   ├── App.tsx         # 主路由中枢(~1100行, 30+view)
│   │   ├── GuideChapter.tsx # 全过程指南工作模块(1341行)
│   │   ├── TargetManager.tsx    # P0: 目标管理WBS树
│   │   ├── TailoringEngine.tsx  # P0: 模块裁剪引擎
│   │   ├── AgentConsole.tsx     # P1: Agent智能体控制台
│   │   ├── SkillPanel.tsx       # P1: 技能面板
│   │   ├── PMBOKFramework.tsx   # P1: PMBOK知识领域框架
│   │   ├── AiChat/AiChatPage   # AI对话
│   │   ├── *Review.tsx          # 施工/合同/招投标审查
│   │   ├── Dashboard/GanttChart/NetworkDiagram/PlanManager
│   │   ├── KnowledgeBase/KnowledgeGraph
│   │   └── 其他业务组件...
│   ├── data/               # 数据层(22个模块)
│   │   ├── agentFramework.ts   # P1: Agent智能体核心
│   │   ├── knowledgeOrchestrator.ts # P0: 统一知识编排器
│   │   ├── skillRegistry.ts    # P1: Skill注册表(7技能)
│   │   ├── mcpAgentBridge.ts   # P1: MCP协议+双向桥
│   │   ├── kgPipeline.ts       # P1: 知识图谱自动管道
│   │   ├── workflowEngine.ts   # P2: 工作流引擎(4模板)
│   │   ├── pmbokData.ts        # P1: PMBOK 10领域49过程
│   │   ├── objectiveEngine.ts  # P0: 目标进度计算引擎
│   │   ├── tailoringEngine.ts  # P0: PMBOK裁剪规则20条
│   │   ├── api.ts(570行)       # 统一API层(60+函数)
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

## 五、API端点清单 (35+端点和10路由)

| 路由前缀 | 文件 | 端点数 | 认证 |
|----------|------|--------|------|
| `/api/projects` | projects.js | 3 (GET/POST/DELETE) | requireAuth/Role |
| `/api/documents` | documents.js | 6 | requireAuth/Permission |
| `/api/auth` | auth.js | 8 | 混合 |
| `/api/ai` | ai.js | 4 | requireAuth+can_use_ai |
| `/api/kg` | kg.js | 4 | requireAuth |
| `/api/ragflow` | ragflow.js | 7 | requireAuth |
| `/api/objectives` | objectives.js | 7 | requireAuth/Role |
| `/api/mcp` | mcp.js | 2 | requireAuth |
| `/api/backup` | backup.js | 3 | requireAuth/Role |
| `/api/import` | import.js | 1 | requireAuth |

## 六、数据库Schema (7张表)

| 表名 | 用途 | 版本 |
|------|------|------|
| projects | 项目列表 | v1.0 |
| documents | 文档/文件存储 | v1.0 |
| users | 用户认证(4角色) | v1.0 |
| sessions | JWT会话 | v1.0 |
| **objectives** | 目标层级(WBS) | **v3.0 P0** |
| **baselines** | 三大基线快照 | **v3.0 P0** |
| **knowledge_artifacts** | 知识加工产物 | **v3.0 P0** |
| **audit_log** | 操作审计日志 | **v3.0 P0** |

## 七、全局单例 (src/data/ 模块级导出)

| 单例 | 文件 | 用途 |
|------|------|------|
| `engineeringAgent` | agentFramework.ts | Agent智能体 |
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

## 九、版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v2.5.0 | 2026-07-08 | 基础平台(AI对话/审查/生成/知识图谱) |
| **v3.0 P0** | 2026-07-13 | 目标管理+模块裁剪+知识编排+数据库升级 |
| **v3.0 P1/P2** | 2026-07-13 | Agent+Skill+MCP+PMBOK+KG管道+工作流 |
| **v4.1** | 2026-07-14 | 三色主题全局能力·手机端API·暗色19轮适配·SKILL配置中台·AgentConsole升级·数据持久化·IndexedDB迁移·AI安全防护 |

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
