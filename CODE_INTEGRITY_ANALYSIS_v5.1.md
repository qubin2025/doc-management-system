# 代码回退事件分析与后续开发保障方案

> 2026-07-28 · 确认后方可执行

---

## 一、开发过程中代码回退事件清单

### 事件 #1：git checkout 大规模回退（最严重）

| 项目 | 详情 |
|------|------|
| **时间** | v4.4 开发期间 |
| **操作** | `git checkout -- src/components/ src/data/ src/mobile/` |
| **后果** | api.ts、mobileApi.ts 及所有组件回退到 v4.1，丢失 v4.4 全部新增类型和函数 |
| **影响** | **62 个 TSC 错误**，需手动恢复 15+ 类型定义、12+ API 函数 |
| **恢复耗时** | 多轮迭代：62→42→23→9→3→1→0 |
| **根因** | `git checkout` 无确认直接覆盖工作区，此前改动未提交 |

### 事件 #2：catch(e:unknown) 批量替换回退

| 项目 | 详情 |
|------|------|
| **时间** | v4.4 开发期间 |
| **操作** | 全局替换 `catch(e: any)` → `catch(e: unknown)` |
| **后果** | `e.message` 在 unknown 类型下报错，全局编译失败 |
| **处理** | 全部文件 git checkout 回退，仅 cherry-pick 安全改动 |
| **根因** | 批量替换前未测试单个文件，TypeScript strict 模式不兼容 |

### 事件 #3：mobile.js 端点丢失

| 项目 | 详情 |
|------|------|
| **时间** | git checkout 事件连锁影响 |
| **操作** | mobile.js 被回退到旧版本 |
| **丢失内容** | 日报 CRUD（submit/list/migrate/stats）、问题上报（report/list/update）、进度快报（report/list/stats）、rpJSON() 容错函数 |
| **恢复** | 手动还原全部端点 + AI JSON 解析修复（markdown 剥离 + 截断修复 + max_tokens 2500→4000） |
| **根因** | 单文件依赖整体 checkout，无增量备份 |

### 事件 #4：DesktopDailyReport.tsx JSX 结构损毁

| 项目 | 详情 |
|------|------|
| **时间** | 2026-07-24 |
| **操作** | 反复使用 `sed` + `node -e` 尝试接入 PromptConfigDialog（仅需 3 行代码） |
| **后果** | JSX 结构损毁：丢失 KV 组件、重复闭合标签、函数作用域错乱 |
| **恢复** | Write 工具完整重写，耗时 2+ 小时无效排错 |
| **根因** | sed 不理解 JSX 层级，Bash 转义与 JS 语法叠加出错 |

### 事件 #5：sed 转义字符丢失

| 项目 | 详情 |
|------|------|
| **时间** | v4.4 开发期间 |
| **操作** | node -e CJS 脚本通过 Bash 写入代码 |
| **后果** | `\s` 变为 `s`，`\d` 变为 `d`，正则表达式全部失效 |
| **根因** | Bash 转义层与 JS 字符串字面量双重转义，`\\s` 才能正确传递 `\s` |

### 事件 #6：git reset 操作（reflog 记录）

| 项目 | 详情 |
|------|------|
| **时间** | 早期开发阶段（HEAD@{190}） |
| **操作** | `git reset --hard 765b561` |
| **后果** | 该提交之后的所有改动被丢弃 |
| **根因** | 不确定具体原因，reflog 中仅记录一次 reset 操作 |

---

## 二、当前代码安全状态（最紧急）

### ⛔ 高危：全部 v4.4-v5.1 代码未提交

| 状态 | 数量 | 风险 |
|------|------|------|
| 已修改未暂存（M） | **11 个文件** | `git checkout` 可回退 |
| 新增未跟踪（??） | **24 个文件** | `git clean -f` 可永久删除 |
| 最新提交 | c0e8f07 (7月21日) | **6 天前** |
| 提交中代码 | 仅到 v4.1 | **v4.4/v5.0/v5.1 全部在 git 外** |

### 未提交的核心交付物清单

| 类别 | 文件 | 版本 |
|------|------|------|
| **Multi-Agent** | src/data/multiAgentOrchestrator.ts | v5.0 |
| **GraphRAG** | backend/routes/kg_graphrag.js | v5.0 |
| **AI管理** | backend/routes/ai_admin.js | v5.1 |
| **全局看板** | src/components/GlobalDashboard.tsx | v4.4 |
| **手机端 6 页面** | src/mobile/pages/*.tsx | v4.4 |
| **桌面端 8 组件** | GlobalDashboard/IssueManager/DesktopDailyReport 等 | v4.4 |
| **经验库 API** | backend/routes/experience.js (362行) | v4.4 |
| **干系人 API** | backend/routes/stakeholders.js (53行) | v4.4 |
| **App.tsx 重构** | src/App.tsx (-439行) + HomePage.tsx + StandardSelectPage.tsx | v5.1 |
| **kg.js 重构** | backend/routes/kg.js (-454行) | v5.1 |
| **品牌 Logo** | public/zhjk-logo.png | v4.4 |

> ⚠️ 如果执行 `git checkout -- .` 或 `git clean -fd`，上述全部工作将永久丢失。

---

## 三、回退根因分析

### 根因一：未建立提交纪律

```
上次提交: 7月21日 (6天前)
期间开发: v5.0 全部 + v5.1 全部
提交次数: 0
```

**根本不是"代码被回退"，而是代码从未被提交过。** 任何 `git checkout` 或 `git clean` 操作都会覆盖未提交的工作区。

### 根因二：使用破坏性 git 命令

| 命令 | 破坏性 | 何时危险 |
|------|--------|---------|
| `git checkout -- <file>` | 不可逆覆盖 | 有未提交修改时 |
| `git reset --hard` | 不可逆删除 | 任何时候 |
| `git clean -fd` | 不可逆删除 | 有未跟踪文件时 |

### 根因三：使用 sed/node-e 修改源码

Shell 脚本不理解编程语言的结构（JSX 层级、JS 作用域、类型系统），碎片化修改累积导致文件腐化。

### 根因四：无增量备份

每次大规模修改前未提交 checkpoint，出问题时无处回滚。

---

## 四、回退内容恢复方案

### 4.1 已恢复（本次对话中完成）

| 内容 | 恢复方式 | 状态 |
|------|---------|------|
| mobile.js 端点 | 手动重写全部日报/问题/进度端点 + rpJSON | ✓ |
| api.ts 类型 + 函数 | 手动恢复 10+ 类型、8+ 函数 | ✓ |
| mobileApi.ts | 手动恢复 15+ 类型、12+ 函数 | ✓ |
| DesktopDailyReport.tsx | Write 完整重写 | ✓ |
| ai.js GraphRAG | 手动添加 fetchGraphRAGContext + extractReviewKeywords | ✓ |
| 仪表板导航 | Dashboard.tsx 添加"项目管理平台"按钮 | ✓ |

### 4.2 未恢复（需确认是否重做）

根据 CLAUDE.md 和 DEVELOPMENT_LOG.md，v4.4 原始需求中以下内容可能在回退中丢失，需逐项验证：

| 内容 | 文件 | 验证方式 |
|------|------|---------|
| DesktopDailyReport 完全体 | src/components/DesktopDailyReport.tsx | 打开页面检查 8 段模板是否完整 |
| PromptConfigDialog 接入 | src/components/DesktopDailyReport.tsx | 检查日报页是否有 AI 配置按钮 |
| DashboardChartPanel | src/components/DashboardChartPanel.tsx | 检查仪表盘是否有 Recharts 图表 |
| PWA Service Worker | dist/sw.js | 检查手机端 PWA 安装是否正常 |
| 离线队列 | src/mobile/lib/offlineQueue.ts | 检查离线拍照→联网上传流程 |
| 知识图谱 25 节点 | src/data/knowledgeGraph.ts | 检查节点类型是否包含全部 25 种 |
| 手机端 6 页面 | src/mobile/pages/*.tsx | 逐页打开验证 |

### 4.3 恢复优先级

| 优先级 | 内容 | 原因 |
|--------|------|------|
| **P0** | 立即 git commit 当前全部改动 | 防止再次丢失 |
| **P0** | 验证 24 个 untracked 文件完整性 | 确保文件未损坏 |
| **P1** | 验证 4.2 中疑似丢失内容 | 按需恢复 |
| **P2** | catch(e:unknown) 安全替换 | 仅替换不影响 e.message 的场景 |

---

## 五、后续开发防回退保障方案

### 5.1 提交纪律（强制执行）

```
每完成一个独立功能 → git add + git commit
每轮对话结束前     → git status 确认无遗漏
每天开发结束前     → git log 确认当日提交
每次大规模修改前   → git commit 创建 checkpoint
禁止单次提交超过 10 个文件变更
```

### 5.2 Git 安全操作规范

| 禁止 | 替代方案 |
|------|---------|
| ❌ `git checkout -- <file>` | ✅ `git stash` 暂存改动 |
| ❌ `git reset --hard` | ✅ `git reset --soft` 保留工作区 |
| ❌ `git clean -fd` | ✅ 先 `git status` 检查 untracked，确认后手动删除 |
| ❌ `git checkout <branch>` 强行切换 | ✅ 先 `git stash` → 切换 → `git stash pop` |

### 5.3 源码修改规范（已有，强化执行）

| 规则 | 检查方式 |
|------|---------|
| 仅用 Write/Edit 修改 TSX/JS | 过程检查 |
| 禁止 sed/node-e/bash 操作源码 | 过程检查 |
| 同文件修改 >3 次即 Write 重写 | 自查 |
| TSC 错误 >3 个即回退重做 | 每次修改后立即检查 |

### 5.4 Checkpoint 机制

```
大规模重构前:
  git add -A && git commit -m "checkpoint: 重构前快照"

高风险操作前:
  git stash && git branch backup-$(date +%Y%m%d-%H%M)

文件重写前:
  cp file.tsx file.tsx.bak  # 本地备份
```

### 5.5 代码健康持续监控

| 检查项 | 频率 | 工具 |
|--------|------|------|
| 文件行数门禁 | 每次新文件 | `wc -l` |
| TSC 零错误 | 每次修改后 | `npx tsc --noEmit` |
| untracked 文件 | 每天 | `git status` |
| 未提交修改 | 每轮对话结束 | `git diff --stat` |
| 构建验证 | 每日 | `npx vite build` |

### 5.6 保持代码清晰整洁的日常实践

| 实践 | 说明 |
|------|------|
| **一个功能一个提交** | 不把多个不相关改动混在一个 commit |
| **提交信息写清楚"为什么"** | 不只是"fix bug"，而是"fix: 日报解析失败-DeepSeek返回markdown包裹的JSON" |
| **新增文件立即 git add** | 不在 untracked 状态停留超过 1 小时 |
| **重构前先提交** | `git commit -m "checkpoint: 重构XXX前快照"` |
| **删除代码有记录** | 不在提交中混入无关删除；大段删除单独提交并注明原因 |
| **CLAUDE.md 同步更新** | 每次功能交付后更新文件数/行数统计数据 |
| **不积累未提交改动** | 修改文件数 >5 且未提交 → 立即提交 |

---

## 六、执行确认清单

请逐项确认后开始执行：

### 立即执行（防丢失）

- [ ] **git commit 当前全部改动**（11 modified + 24 untracked）— 创建 checkpoint
- [ ] 验证 24 个 untracked 文件完整性（逐个检查文件是否可正常导入/加载）
- [ ] 移除临时文件（fix_array.cjs、patch_rpjson.cjs — 热修复脚本，已完成使命）

### 验证恢复（按需）

- [ ] 验证 DesktopDailyReport.tsx 8段模板完整性
- [ ] 验证 PromptConfigDialog 接入状态
- [ ] 验证 DashboardChartPanel Recharts 图表
- [ ] 验证知识图谱 25 节点类型
- [ ] 验证 PWA Service Worker

### 后续保障（制度化）

- [ ] 确认 5.1 提交纪律
- [ ] 确认 5.2 Git 安全操作规范
- [ ] 确认 5.4 Checkpoint 机制
- [ ] 将上述规则写入 CLAUDE.md
