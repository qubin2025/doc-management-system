# 开发日志

## 2026-07-13: v3.0 P0核心架构升级

### 背景
v2.5.0系统已有丰富AI功能和项目管理基础能力，但从"表单驱动"向"目标驱动AI平台"转型的关键期。经PMBOK第6/7版视角审视，综合完成度约44%。

### P0四项工作

#### Phase A: 数据库Schema升级 (L1层)
新增4张表：
- `objectives` — 目标层级(WBS树，支持root/phase/deliverable/work-item四层)
- `baselines` — 三大基线快照(scope/schedule/cost)
- `knowledge_artifacts` — 知识加工产物索引(chunk/summary/graph/category/qa-pair)
- `audit_log` — 操作审计日志(6种action, 7种targetType)

迁移策略：`CREATE TABLE IF NOT EXISTS`，使用PRAGMA table_info的渐进式迁移。

#### Phase B: 目标管理体系 (L4层)
- **TargetManager.tsx**: WBS树组件，递归TargetNode，SVG进度环，5列统计卡片
- **AddObjectiveModal.tsx**: 新建/编辑目标弹窗，层级选择+权重滑块+工作项关联
- **objectiveEngine.ts**: 进度计算引擎(buildObjectiveTree/recalculateAllProgress/getWorkItemCompletedMap)
- **backend/routes/objectives.js**: 7个API端点(GET列表/树/POST创建/PUT更新/PUT进度/DELETE/POST关联)

#### Phase C: 模块裁剪引擎 (L4层)
- **tailoringEngine.ts**: 20条PMBOK裁剪规则(R01-R20)+computeTailoringResult算法
- **TailoringEngine.tsx**: 两步式UI(问卷→结果)，支持手动调整工作项状态(required/recommended/optional/excluded)

#### Phase D: 统一知识编排器 (L2层)
- **knowledgeOrchestrator.ts**: 三级降级链检索(RAGFlow→LightRAG→本地向量+Lunr)+chunker整合
- **ragService.ts**: indexDocument改为chunk-first模式，修复chunker未被使用的问题

### 验证
- TSC零错误
- Vite Build构建成功
- 32/32测试通过
- 14文件变更, +2522/-17行

---

## 2026-07-13: v3.0 P1/P2全面升级

### 背景
P0打好了架构地基（目标管理/知识编排/数据库），P1/P2在此基础上构建完整的Agent驱动的智能项目管理平台。

### P1五项工作

#### Phase F: Agent智能体框架 (L3层)
- **agentFramework.ts**: EngineeringAgent类，ReAct推理循环(规划→观察→推理→执行)，工具注册/调用，错误恢复(retry/skip/fallback/abort)，11个内置工具
- **AgentConsole.tsx**: Agent执行面板，步骤可视化，确认对话框，工具列表展示

#### Phase G: Skill技能机制 (L3层)
- **skillRegistry.ts**: SkillRegistry注册表类，7个Skill封装
  - construction-review(施工审查), contract-review(合同审查), bid-review(招投标审查)
  - plan-generate(方案生成), ai-fill-form(表单填写)
  - ai-guide-notes(办理指南), ai-breakdown-tasks(拆解任务)
- **SkillPanel.tsx**: 技能面板UI，分类筛选，参数输入，结果展示

#### Phase H: MCP协议实现 (L3层)
- **mcpAgentBridge.ts**: MCPServerRegistry类，AgentAction↔MCPTool双向桥
- **backend/routes/mcp.js**: MCP工具列表+健康检查端点

#### Phase I: PMBOK知识领域框架 (L4层)
- **pmbokData.ts**: 10大知识领域49过程+8大绩效域静态数据
  - 高覆盖(≥80%): Integration/Schedule/Cost/Quality/Procurement
  - 中覆盖(40-79%): Scope/Risk
  - 低覆盖(<40%): Resource/Communications/Stakeholder
- **PMBOKFramework.tsx**: 四Tab视图(知识领域/绩效域/过程组矩阵/项目评估)

#### Phase J: 知识图谱自动构建管道 (L2层)
- **kgPipeline.ts**: KGPipeline类，事件驱动+5秒防抖
- 注入点: App.tsx handleUpload/handleDelete，GuideChapter关键回调

### P2一项工作

#### Phase K: 自动化工作流引擎 (L3层)
- **workflowEngine.ts**: 4个预设模板(项目健康检查/文档智能审查/方案自动生成/表单批量填写)
- 支持skill/agent-task/mcp-tool/human-approval四种步骤类型

### 验证
- TSC零错误
- Vite Build构建成功
- 32/32测试通过
- 13文件变更, +2034行

---

## 2026-05-29: GuideChapter.tsx SVG遗留代码事件

### 事件描述

GuideChapter.tsx（1085行）始于2026年5月初，最初使用自定义SVG绘制逻辑图（时序逻辑图/双代号网络图），包含：

- **AnchorType** 锚点类型定义（8个方向锚点）
- **getAnchorPos/pickAnchors** 锚点位置计算
- **renderArrowHead** SVG箭头绘制
- **orthogonalPathFromAnchors** 正交连线路径生成
- **拖拽交互** (handleMouseDown/Move/Up) 用于节点移动
- **锚点连线** (handleAnchorMouseDown/Up) 用于创建依赖边

总计约200行自定义SVG绘图代码。

5月中旬，逻辑图改为 **draw.io 嵌入式方案**（LogicDiagram.tsx 组件，postMessage 数据加载）。原有SVG代码未清理，遗留约350行死代码，通过 `@ts-nocheck` 跳过TypeScript检查。

### 重要教训

**1. 架构变更后应立即清理旧代码**
- SVG→draw.io迁移后，200+行SVG代码成为技术债务
- 拖延清理导致文件膨胀到1212行，后续重构成本倍增

**2. @ts-nocheck 是技术债务信号**
- 添加此指令时，应同时创建TODO任务（本例未创建）
- 应在引入后立即制定清理时间表

**3. 自研渲染 vs 成熟方案**
- 自定义SVG绘制（200行代码）实现了有限的拖拽/连线功能
- draw.io嵌入（20行配置）提供了完整的图表编辑能力
- **结论**: 图形绘制优先选择成熟开源方案，避免自研

**4. 模块拆分应提前规划**
- 工作模块(modules)、附表清单(forms)、逻辑图(logic)已是三个Tab
- 但代码混在一个文件中，应各自独立为子组件
- 组件超过300行时强制拆分

**5. 备份文件管理**
- .bak/.bak2/.bak3/.clean/.fix 等5个备份占用混乱
- 应使用 Git 分支管理WIP代码，而非文件副本

### 修复计划

预计2026年6月专项重构GuideChapter.tsx：
1. 删除SVG遗留代码（~350行）
2. 拆分为3-4个子组件
3. 移除 @ts-nocheck
4. 估计工时: 4-6小时

---

## 开发统计

### 当前版本: v3.0
| 指标 | v2.5.0 | v3.0 | 增量 |
|------|--------|------|------|
| 前端组件 | 31 | 38 | +7 |
| 数据模块 | 15 | 22 | +7 |
| 后端路由 | 8 | 10 | +2 |
| API端点 | 29 | 35+ | +6+ |
| 数据库表 | 4 | 8 | +4 |
| 测试用例 | 32 | 32 | 0 |
| TypeScript接口 | 21 | 30+ | +9+ |
| 代码总行数 | ~15,000 | ~19,500 | +4,500 |
