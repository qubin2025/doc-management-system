# 全过程工程咨询管理系统 — 开发状态审计与 v5.1 计划

> 审计日期：2026-07-27 | 首次提交：2026-05-29 | 最新提交：c0e8f07 (2026-07-21)

---

## 一、项目规模现状

| 维度 | v3.0 (7/13) | v4.4 (7/21) | 当前 (7/27) | 增长 |
|------|------------|------------|------------|------|
| 前端组件 | 38 | 50 | **62** | +63% |
| 数据模块 | 22 | 28 | **34** | +55% |
| 后端路由文件 | 10 | 12 | **18** | +80% |
| API 端点 | 35+ | 45+ | **73+** | +108% |
| 数据库表 | 8 | 14 | **21** | +162% |
| TypeScript 接口 | 30+ | 40+ | **50+** | +67% |
| App.tsx 行数 | ~1100 | ~1200 | **1373** | +25% |
| 总代码行数 | ~19,500 | ~26,000 | **~34,000** | +74% |
| 测试用例 | 32 | 42 | **42** | +31% |
| 前端视图 | ~30 | ~35 | **39** | +30% |

---

## 二、版本迭代回顾

| 版本 | 日期 | 核心内容 |
|------|------|---------|
| v2.5.0 | 7/08 | 基础平台：AI对话/审查/生成/知识图谱 |
| v3.0 P0 | 7/13 | 目标管理+模块裁剪+知识编排+数据库升级（4新表） |
| v3.0 P1/P2 | 7/13 | Agent+Skill+MCP+PMBOK+KG管道+工作流引擎 |
| v4.1 | 7/14 | 三色主题·手机端API·暗色19轮适配·SKILL配置中台·AgentConsole升级·数据持久化 |
| v4.4 | 7/21 | 手机UI重设计·日报体系(8段曙光模板)·Recharts图表·PWA安装·知识图谱扩展 |
| **v5.0** | **7/27** | **Ollama本地AI·Docker健康检查·GraphRAG图检索·Multi-Agent协作** |

---

## 三、v5.0 本轮开发完成情况

### 已完成 ✓

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1 | Ollama 本地AI部署 | backend/routes/ai.js | qwen2.5:7b CPU模式，7模型自动降级 |
| 2 | Docker 部署改进 | docker-compose.yml | 6服务全部添加healthcheck |
| 3 | GraphRAG 知识图谱升级 | backend/routes/kg.js (+455行) | 5个新端点：search/context/enrich/related/stats，AI审查自动注入图谱上下文 |
| 4 | Multi-Agent 协作 | src/data/multiAgentOrchestrator.ts (新建) | 5个专业Agent Profile + 关键词匹配路由 + AgentConsole选择器UI |
| - | 仪表板导航修复 | src/components/Dashboard.tsx | 新增"项目管理平台"入口按钮，打通 GlobalDashboard→Dashboard→Homepage 链路 |

### 新增文件

| 文件 | 行数 | 用途 |
|------|------|------|
| src/data/multiAgentOrchestrator.ts | 193 | Multi-Agent 编排器 |
| src/components/shared/Card.tsx | 24 | 可复用卡片组件 |
| src/components/shared/PageHeader.tsx | 32 | 可复用页头组件 |
| src/components/PromptConfigDialog.tsx | 195 | AI提示词配置弹窗 |
| src/components/AiRating.tsx | ~80 | AI输出评分组件 |
| src/components/ExperiencePanel.tsx | ~140 | 项目经验库面板 |
| src/components/IssueManager.tsx | ~200 | 现场问题管理器 |
| src/components/DesktopDailyReport.tsx | ~350 | 桌面端日报管理 |
| src/components/DesktopProgressView.tsx | ~130 | 桌面端进度视图 |
| src/components/DashboardChartPanel.tsx | ~160 | Recharts图表面板 |
| src/components/GlobalDashboard.tsx | ~500 | 全局项目看板 |
| backend/routes/experience.js | 362 | 经验库API |
| backend/routes/stakeholders.js | 53 | 干系人API |
| src/mobile/components/InstallBanner.tsx | ~45 | PWA安装横幅 |
| src/mobile/pages/Dashboard.tsx | 136 | 手机端图标主界面 |
| src/mobile/pages/MobileDailyReport.tsx | ~400 | 手机端日报 |
| src/mobile/pages/MobileProgress.tsx | ~100 | 手机端进度 |
| src/mobile/pages/MobileUpload.tsx | ~100 | 手机端文件上传 |
| src/mobile/pages/MobilePhotoGallery.tsx | ~120 | 手机端照片浏览 |
| src/mobile/pages/SafetyCheck.tsx | ~80 | 手机端安全检查 |

---

## 四、未完成开发目标

### P0 — 阻塞性（影响核心功能）

| # | 项目 | 现状 | 优先级 |
|---|------|------|--------|
| P0-1 | 组件测试覆盖 | 0个 `*.test.tsx` 文件，违反门禁规则#5 | 高 |
| P0-2 | App.tsx 拆分 | 1373行单文件，39个if-else视图，违反300行门禁 | 高 |

### P1 — 重要（影响代码质量）

| # | 项目 | 现状 | 优先级 |
|---|------|------|--------|
| P1-1 | GuideChapter.tsx 死代码清理 | ~350行遗留SVG绘制代码，已用draw.io替代 | 中 |
| P1-2 | kg.js 拆分 | 579行，含GraphRAG+基础CRUD，应拆为两个文件 | 中 |
| P1-3 | api.ts 认证逻辑统一 | 681行，多处认证模式不一致 | 中 |
| P1-4 | CLAUDE.md 规模数据更新 | 仍报告v3.0的38组件/22模块，实际62/34 | 低 |
| P1-5 | 知识图谱扩展 (#56) | 补充10个缺失模块节点 | 中 |

### P2 — 增强（锦上添花）

| # | 项目 | 现状 | 优先级 |
|---|------|------|--------|
| P2-1 | LightRAG 服务启动 | Python已安装但服务未启动 | 低 |
| P2-2 | PaddleOCR 服务启动 | Python已安装但服务未启动 | 低 |
| P2-3 | 通义千问 API 修复 | 账户状态异常，Access denied | 低（有GLM-4+Ollama兜底） |
| P2-4 | 后端测试覆盖 | 0个后端测试文件 | 低 |
| P2-5 | E2E 测试 | 无端到端测试 | 低 |

---

## 五、技术债务清单（屎山风险点）

### 红色预警（已违反门禁规则）

| 文件 | 行数 | 问题 | 风险 |
|------|------|------|------|
| **App.tsx** | 1373 | 39个顺序if-else路由，无switch/map | 每加一个功能就多10行，不可持续 |
| **GuideChapter.tsx** | 1341 | 350行死代码+@ts-nocheck | 维护盲区，新人无法理解 |
| **kg.js** | 579 | GraphRAG+CRUD混在一起 | 修改一处影响全局 |
| **ai.js** | 536 | 7模型代理+GraphRAG+用量统计混在一起 | 同上 |

### 黄色预警（逼近门禁线）

| 文件 | 行数 | 问题 |
|------|------|------|
| api.ts | 681 | 60+函数，类型定义与API调用混排 |
| knowledgeGraph.ts | 631 | 25种节点类型构建逻辑集中 |
| mobile.js | 408 | 日报+问题+进度+上传+AI解析全在一起 |
| DesktopDailyReport.tsx | ~350 | 超300行门禁 |

### 架构债

| 问题 | 影响 |
|------|------|
| 无 Context 状态管理 | 跨组件传参靠 prop drilling，30+组件共享 currentProject |
| 无路由库 | 39个视图靠字符串匹配，无类型安全检查 |
| 无组件懒加载 | 60+组件全量打包，main bundle ~2MB |
| 前端直接调AI API | 无请求队列/缓存/重试统一层 |
| localStorage 滥用 | 数据分散在多处，无统一迁移/版本管理 |

---

## 六、开发准则 v2.0（防屎山强化版）

### 6.1 文件规模硬限制（零容忍）

```
前端组件 ≤ 250 行（原 300 行收紧）
数据模块 ≤ 300 行
后端路由 ≤ 350 行
App.tsx 目标 ≤ 800 行（分阶段达成）
```

### 6.2 新增代码门禁（强制执行）

| # | 规则 | 检查方式 |
|---|------|---------|
| 1 | 新增文件不超过 250 行 | `wc -l` 检查 |
| 2 | 新增类型不使用 `any` | `tsc --noEmit` 零新增 |
| 3 | 跨3层以上传参必须用 Context | Code Review |
| 4 | 仅用 Write/Edit 修改 TSX，禁止 sed/node-e | 过程检查 |
| 5 | 新组件必须有测试文件 | `__tests__/ComponentName.test.tsx` |
| 6 | 新路由必须抽独立文件 | 不再向 App.tsx 追加 if-else |
| 7 | 同文件修改 >3 次即整体重写 | 防止碎片化腐化 |

### 6.3 页面结构强制规范

```tsx
// 导入区
import React, { useState } from 'react';
import { xxx } from 'lucide-react';

// 类型定义区
interface Props { ... }

// 组件区
const Component: React.FC<Props> = (props) => {
  // 状态定义区
  const [state, setState] = useState();

  // 业务方法区
  const handleXxx = () => { ... };

  // 纯 JSX 渲染区
  return ( ... );
};

// 导出区
export default Component;
```

### 6.4 新增功能审批清单

开发新功能前必须回答：
- [ ] 是否可复用现有组件/模块？（优先组合，拒绝新建）
- [ ] 是否必须新建文件？（≤250行）
- [ ] 是否避免了向 App.tsx 追加路由？（新路由抽独立文件）
- [ ] 是否避免了 prop drilling > 3层？（跨3层用 Context）
- [ ] 是否有对应测试文件？
- [ ] 是否更新了 CLAUDE.md 和操作说明书？

---

## 七、v5.1 分期开发计划

### Phase 1：还债止血（预计 3-4 轮）

**目标：4 个红线文件全部降至门禁以下**

| # | 任务 | 文件 | 当前行数 | 目标行数 | 具体做法 |
|---|------|------|---------|---------|---------|
| 1 | **App.tsx 拆分 #1** | `src/App.tsx` | 1,373 | 减 ~300 | 抽出 homepage 内联 JSX → `src/components/HomePage.tsx`；抽取 standard-select 内联 JSX；路由 if-else 链末端 5 个短视图合并 |
| 2 | **GuideChapter.tsx 清理** | `src/components/GuideChapter.tsx` | 1,341 | 减至 ~950 | 删除 ~350 行 SVG 遗留代码（AnchorType/getAnchorPos/renderArrowHead/正交连线/拖拽交互——已被 draw.io 替代）；移除 @ts-nocheck |
| 3 | **kg.js 拆分** | `backend/routes/kg.js` | 579 | 减至 ~300 | 抽出 5 个 graphrag 端点 + BFS/工具函数 → `backend/routes/kg_graphrag.js` |
| 4 | **ai.js 拆分** | `backend/routes/ai.js` | 536 | 减至 ~370 | 抽出 4 个管理员端点（stats/unfreeze/rate/ratings）→ `backend/routes/ai_admin.js`；模型配置对象抽取为 `backend/utils/modelConfig.js` |
| 5 | **CLAUDE.md 更新** | `CLAUDE.md` | — | — | 刷新组件数(62)/模块数(34)/端点数(73+)；更新版本历史加入 v4.4+v5.0；更新开发准则至 v2.0 |

**ai.js 拆分细节：**

```
backend/routes/ai.js (536行)
  ├─ 保留：模型配置 + POST /chat + POST /vision + GET /models + tryChat
  │         + 限流 + 用量追踪 + GraphRAG 检索集成
  │         ≈ 370 行
  ├─ 抽出：GET /stats + POST /unfreeze + POST /rate + GET /ratings
  │         → backend/routes/ai_admin.js ≈ 120 行
  └─ 可选：模型配置对象 + getModels()
            → backend/utils/modelConfig.js ≈ 50 行
```

> **说明**：ai.js 不同于 kg.js——它的 chat 端点与 GraphRAG（fetchGraphRAGContext）、限流（checkRate/trackUsage）、模型降级（tryChat）形成强耦合调用链，硬拆会破坏内聚性。因此优先抽离与 chat 无关的管理端点（stats/unfreeze/rate/ratings），核心链保留在 ai.js。

### Phase 2：架构加固（预计 2-3 轮）

| 任务 | 说明 |
|------|------|
| **ProjectContext 创建** | 统一 currentProject/standard/isAdmin 状态管理 |
| **视图路由 Map 化** | App.tsx 39个 if-else → 路由配置对象 + 映射渲染 |
| **组件懒加载** | React.lazy + Suspense，减主 bundle 体积 |
| **api.ts 认证统一** | 所有 API 调用统一走 auth 拦截器 |

### Phase 3：功能补完（按需）

| 任务 | 说明 |
|------|------|
| 知识图谱扩展 #56 | 补充10个模块节点 |
| 组件测试补齐 | 核心组件 5-8 个测试文件 |
| LightRAG/PaddleOCR 启动 | 可选服务激活 |

---

## 八、当前系统能力总览

```
L4 应用层 ─ 39视图·62组件·50+功能卡片
  ├─ 项目全生命周期：前期→招标→施工→竣工
  ├─ 目标管理(WBS)·模块裁剪(PMBOK 20规则)
  ├─ 进度/成本/质量/风险/干系人/资源
  ├─ 日报体系(8段曙光模板)·问题管理·经验库
  └─ 手机端H5+PWA(水印拍照·日报·安全检查)

L3 AI层 ─ 7模型·5 Agent·7 Skill
  ├─ DeepSeek V3/V4/R1 + GLM-4 + Ollama(qwen2.5:7b)
  ├─ Multi-Agent：安全/质量/合同/造价/综合
  ├─ 施工审查·合同审查·招投标审查·方案生成
  ├─ GraphRAG：图遍历检索+审查自动注入
  └─ AgentConsole：自主规划·执行·汇总报告

L2 知识层 ─ Neo4j·RAGFlow·向量库
  ├─ Neo4j 知识图谱 (16节点/42边·9端点)
  ├─ RAGFlow 文档知识库
  ├─ 知识编排器(3级降级检索)
  └─ KG自动构建管道

L1 数据层 ─ SQLite·localStorage·IndexedDB
  ├─ SQLite 21表 (项目/文档/目标/基线/审计...)
  ├─ 审计日志(6种action·7种targetType)
  ├─ Docker 11容器运行中
  └─ 后端 18路由·73+API端点
```

---

## 九、决策建议

**当前优先级排序：**

1. **Phase 1（还债止血）先做** — 4个红线文件全部拆解：App.tsx 拆分 + GuideChapter 清理 + kg.js 拆分 + ai.js 拆分
2. **Phase 2（架构加固）紧随** — ProjectContext + 路由 Map 化是阻止未来屎山的关键
3. **Phase 3（功能补完）按需** — 不紧急，可在 Phase 1/2 间隙穿插

**风险提示：**
- 当前最危险的债务是 **App.tsx（1373行）** 和 **GuideChapter.tsx（1341行）**，任何新功能如果继续往这两个文件追加代码，屎山将不可逆
- 总计 **4 个文件超过 500 行**（App.tsx, GuideChapter.tsx, kg.js, ai.js）——这4个文件是防火重点，Phase 1 全覆盖
- 62 个组件中约 **15 个没有对应的 onBack/onNavigate 标准接口**，随意新增导航模式会导致路由碎片化
