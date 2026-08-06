# 持久化补齐方案 v1.0

> 目标：消除 localStorage 单点故障，实现前后端全量同步

## 一、当前问题

```
用户操作 → localStorage ✓ → 后端 API ✗
→ 换浏览器/清缓存 → 数据丢失
```

| 数据 | 当前存储 | 丢失风险 |
|------|---------|---------|
| 指南工作项勾选 | localStorage only | 换浏览器全部重置 |
| 表单内容 | localStorage only | 清缓存丢失 |
| AI 审查历史 | localStorage only | 无归档追溯 |
| 项目列表缓存 | localStorage + API | API 不可用时回退到旧缓存 |
| 日报/问题/进度 | ✅ 已通过 API 持久化 | — |
| 合同/模板/经验 | ✅ 已通过 API 持久化 | — |
| 上传文档 | ✅ 已通过 API 持久化 | — |

## 二、补齐方案

### Phase 1: 指南进度持久化 (高优先)

```
GuideChapter.tsx 勾选工作项时:
  现有: localStorage.setItem(key, JSON.stringify(completedItems))
  新增: api.syncGuideProgress(projectName, chapterId, completedItems)

Backend: POST /api/guide/progress
  { projectName, chapterId, completedItems: string[] }
  → 存入 guide_progress 表
```

### Phase 2: 表单内容持久化 (高优先)

```
GuideFormsTab.tsx 保存表单时:
  现有: localStorage.setItem(`form-content-${chapterId}-${code}`, content)
  新增: api.syncFormContent(projectName, chapterId, code, content)

Backend: POST /api/guide/forms
  { projectName, chapterId, code, content }
  → 存入 guide_forms 表
```

### Phase 3: AI 审查历史持久化 (中优先)

```
ConstructionReview.tsx / ContractReview.tsx / BidReview.tsx:
  现有: localStorage.setItem('construction-review-history', ...)
  新增: api.saveReviewHistory(type, projectName, reviewData)

Backend: POST /api/ai/review/history
  { type, projectName, results, report, fileName, time }
  → 存入 ai_review_history 表 (或复用 audit_log)
```

### Phase 4: 启动时数据恢复

```
App.tsx mount:
  现有: 先读 localStorage → 再读 API
  新增: API 优先 → 成功后覆盖 localStorage → localStorage 仅作离线兜底
  (当前已有此逻辑，但需确保 API 调用不被 stale token 阻塞)
```

### Phase 5: 离线队列增强

```
offlineQueue.ts:
  现有: 仅处理照片上传
  新增: 通用离线队列 (指南进度/表单/审查历史/日报)
  联网后批量同步 → 成功后清除本地队列
```

## 三、数据库新增表

```sql
-- Phase 1
CREATE TABLE guide_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  completed_items TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_name, chapter_id)
);

-- Phase 2
CREATE TABLE guide_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  form_code TEXT NOT NULL,
  content TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_name, chapter_id, form_code)
);

-- Phase 3
CREATE TABLE ai_review_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  review_type TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  results TEXT DEFAULT '[]',
  report TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
```

## 四、防屎山约束

- 每 Phase 独立提交，≤3 文件变更
- 新增 API 端点 ≤50 行/个
- localStorage 写操作保留，API 写为附加（不删除 localStorage 逻辑）
- API 失败不影响用户操作（静默降级）
- 每 Phase TSC + 测试验证

## 五、执行优先级

| Phase | 价值 | 工作量 | 建议 |
|-------|------|--------|------|
| Phase 1 指南进度 | 🔴 高 | 小 (1端点+1表+前端1处修改) | 立即 |
| Phase 2 表单内容 | 🔴 高 | 小 (1端点+1表+前端1处修改) | 立即 |
| Phase 4 启动恢复 | 🟡 中 | 小 (修改已有逻辑) | 立即 |
| Phase 3 审查历史 | 🟡 中 | 中 (1端点+1表+3页面) | 随后 |
| Phase 5 离线队列 | 🟢 低 | 大 (重构离线队列) | 延迟 |

---

> 确认后按 Phase 1→2→4→3→5 顺序执行。
