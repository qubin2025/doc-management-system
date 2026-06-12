# 开发日志

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
