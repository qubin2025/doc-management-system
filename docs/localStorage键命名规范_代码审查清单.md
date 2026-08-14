# localStorage 键命名规范与代码审查清单

> **版本**: v1.0 | **生效日期**: 2026-08-14 | **适用范围**: 全项目前端 + 数据层
>
> **背景**: 2026-08-14 发现新建项目「天宝北街跨凉水河桥」第一章显示已完成，
> 根因为 GuideChapter.tsx 中存在"全局匿名键→项目级键"的模糊迁移逻辑，
> 将旧项目遗留的全局演示数据污染到新项目中（DB 实锤：新项目 ch1=57条 ≡ 老项目 ch1=57条）。
> 同期发现 ProjectEntryPage/LocalStoragePanel 用 `k.includes(projectName)` 子串匹配删除，
> 导致删除"桥"项目时误删"天桥改造"项目的键。
> 本文档为制度化防污染机制，强制执行。

---

## 一、键命名规则

### 1.1 项目级键（必须带项目名）

所有与特定项目绑定的数据，**必须**使用 `prefix-${projectName}-suffix` 格式：

```
┌─────────────────────────────────────────────────────────────────┐
│  键名结构: ${prefix}-${projectName}-${suffix}                   │
│                                                                  │
│  prefix   = 业务域标识（如 guide-, plan-files-）                │
│  projectName = 当前项目名（用户可读的中文名称）                  │
│  suffix   = 子键标识（如 chapter-ch1-done, chapter-ch1-modules）│
└─────────────────────────────────────────────────────────────────┘
```

**已注册的项目级前缀清单**（定义于 `src/data/projectKeyUtils.ts`）：

| 前缀 | 用途 | 示例键名 |
|------|------|---------|
| `guide-` | 指南进度/模块/链接 | `guide-天宝北街-chapter-ch1-done` |
| `guide-forms-` | 指南表单内容/样本/成果 | `guide-forms-天宝北街-ch1-表1.3-1` |
| `guide-item-links-` | 指南工作项关联线 | `guide-item-links-天宝北街-ch1` |
| `stakeholder-` | 干系人 | `stakeholder-天宝北街` |
| `risk-` | 风险登记 | `risk-天宝北街` |
| `resources-` | 资源计划 | `resources-天宝北街` |
| `raci-` | RACI 矩阵 | `raci-天宝北街` |
| `tailoring-config-` | 裁剪配置 | `tailoring-config-天宝北街` |
| `project-objectives-` | 目标管理 | `project-objectives-天宝北街` |
| `schedule-` | 进度计划 | `schedule-天宝北街` |
| `knowledge-artifacts-` | 知识加工产物 | `knowledge-artifacts-天宝北街` |
| `plan-files-` | 进度计划文件 | `plan-files-天宝北街` |
| `doc-mgmt-upload-` | 上传数据（标准号维度） | `doc-mgmt-upload-DB11/T695-2025` |

### 1.2 全局键（禁止存储项目级数据）

全局键**仅允许**存储以下类型的数据：

| 类型 | 示例键名 | 说明 |
|------|---------|------|
| 认证/会话 | `doc-system-auth`, `doc-system-token` | 与项目无关 |
| 系统配置 | `document-management-standard` | 全局标准选择 |
| 主题/偏好 | `theme`, `kg-font-size` | 用户偏好 |
| 项目列表 | `doc-mgmt-projects-${standard}` | 项目索引（非项目内容） |
| 知识图谱缓存 | `knowledge-graph` | 跨项目聚合视图 |

**禁止**在全局键中存储任何项目的业务数据（指南进度、表单内容、裁剪配置等）。

### 1.3 演示模式键（如需保留）

如需保留"无项目关联的演示模式"功能，**必须**使用 `demo-` 前缀与项目级键物理隔离：

```
demo-guide-chapter-ch1-done      ← 演示模式（安全）
guide-天宝北街-chapter-ch1-done  ← 项目级（安全）
guide-chapter-ch1-done           ← ❌ 禁止（全局裸键，污染源）
```

---

## 二、禁止模式

### 🚫 禁止 1: 全局裸键存储项目数据

```typescript
// ❌ 禁止：全局裸键，所有项目共享，必然污染
localStorage.setItem('guide-chapter-ch1-done', JSON.stringify(items));

// ✅ 正确：带项目名前缀
const key = `guide-${projectName}-chapter-ch1-done`;
localStorage.setItem(key, JSON.stringify(items));
```

### 🚫 禁止 2: 全局键→项目键模糊迁移

```typescript
// ❌ 禁止：将全局旧键内容拷贝到任意新项目键
if (!localStorage.getItem(newKey) && localStorage.getItem(oldGlobalKey)) {
  localStorage.setItem(newKey, localStorage.getItem(oldGlobalKey)!);
}

// ✅ 正确：项目重命名时的一对一精确迁移
if (key.startsWith(prefix + oldName)) {
  const newKey = key.replace(prefix + oldName, prefix + newName);
  localStorage.setItem(newKey, localStorage.getItem(key)!);
  localStorage.removeItem(key);
}
```

### 🚫 禁止 3: includes 子串匹配删除

```typescript
// ❌ 禁止：子串匹配，删除"桥"会误删"天桥改造"
if (k.includes(projectName)) keysToRemove.push(k);

// ✅ 正确：精确前缀匹配
import { collectKeysForTarget } from '../data/projectKeyUtils';
const keysToRemove = collectKeysForTarget(projectName);
```

### 🚫 禁止 4: 条件回退到全局键

```typescript
// ❌ 禁止：无项目名时回退到全局裸键（污染源）
const key = projectName
  ? `guide-${projectName}-chapter-ch1`
  : `guide-chapter-ch1`;  // ← 全局裸键！

// ✅ 正确：无项目名时使用 demo- 前缀
const key = projectName
  ? `guide-${projectName}-chapter-ch1`
  : `demo-guide-chapter-ch1`;
```

---

## 三、代码审查清单

> **使用方法**: 每次新增/修改 localStorage 相关代码时，逐项检查。全部通过方可合入。

### 3.1 键命名检查

- [ ] **R1**: 项目级数据键名包含 `${projectName}`，格式为 `prefix-${projectName}-suffix`
- [ ] **R2**: 未使用全局裸键存储项目业务数据（`guide-chapter-*` / `plan-files` 等无项目名前缀）
- [ ] **R3**: 演示模式数据使用 `demo-` 前缀，与项目级键物理隔离
- [ ] **R4**: 新增前缀时已同步更新 `src/data/projectKeyUtils.ts` 的 `PROJECT_KEY_PREFIXES`

### 3.2 读写安全检查

- [ ] **R5**: 读取项目数据时，键名中 `${projectName}` 来自当前选中项目（非硬编码）
- [ ] **R6**: 写入项目数据时，确认 `projectName` 非空（空值时不应写入项目级键）
- [ ] **R7**: 未使用 `k.includes(projectName)` 做删除/清理匹配（改用 `collectKeysForTarget`）
- [ ] **R8**: 未使用 `k.includes(name)` 做项目重命名迁移（改用 `key.startsWith(prefix + oldName)`）

### 3.3 迁移逻辑检查

- [ ] **R9**: 不存在"全局旧键→项目新键"的模糊迁移（`!newKey && oldGlobalKey → 拷贝`）
- [ ] **R10**: 项目重命名迁移使用精确前缀匹配 `startsWith(prefix + oldName)`
- [ ] **R11**: 迁移后删除旧键，不留残留副本
- [ ] **R12**: 迁移逻辑有一次性旗标控制（如 `guide-cleanup-v2`），不重复执行

### 3.4 清理逻辑检查

- [ ] **R13**: 项目删除时使用 `collectKeysForTarget(projectName)` 精确收集键
- [ ] **R14**: 项目列表键 `doc-mgmt-projects-*` 的清理是过滤数组元素，而非删除整个键
- [ ] **R15**: 孤立数据清理时同样使用精确匹配，不用 `includes`
- [ ] **R16**: "重置全部"操作保留认证键（`doc-system-auth` / `doc-system-token`）

---

## 四、合规示例

### 4.1 新增项目级数据（正确）

```typescript
import { PROJECT_KEY_PREFIXES } from '../data/projectKeyUtils';

// 新增前缀时同步注册
// PROJECT_KEY_PREFIXES 已包含 'meeting-'

function saveMeetingMinutes(projectName: string, meetingId: string, content: string) {
  if (!projectName) return; // R6: 空值保护
  const key = `meeting-${projectName}-${meetingId}`; // R1: 项目级格式
  localStorage.setItem(key, JSON.stringify({ content, ts: Date.now() }));
}
```

### 4.2 项目删除（正确）

```typescript
import { collectKeysForTarget } from '../data/projectKeyUtils';

async function deleteProject(projectName: string) {
  await api.deleteProjectApi(projectName);
  // R13: 精确收集，不误伤同名子串项目
  const keysToRemove = collectKeysForTarget(projectName);
  // R14: 项目列表键是过滤元素，不是删除整个键
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('doc-mgmt-projects-')) {
      const v = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(v)) {
        localStorage.setItem(k, JSON.stringify(v.filter((x: any) => x.name !== projectName)));
      }
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}
```

### 4.3 项目重命名（正确）

```typescript
// R10: 精确前缀匹配，一对一迁移
const prefixes = ['guide-', 'stakeholder-', 'risk-', /* ... */];
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i);
  if (!key) continue;
  for (const prefix of prefixes) {
    if (key.startsWith(prefix + oldName)) {      // R10: 精确匹配
      const newKey = key.replace(prefix + oldName, prefix + newName);
      localStorage.setItem(newKey, localStorage.getItem(key)!);
      localStorage.removeItem(key);                // R11: 删除旧键
      break;
    }
  }
}
```

---

## 五、违规场景与后果

| 违规编号 | 场景 | 后果 | 历史 case |
|---------|------|------|----------|
| V1 | 全局裸键存储项目数据 | 所有项目共享一份数据，互相覆盖 | guide-chapter-ch1-done（已修复） |
| V2 | 全局→项目模糊迁移 | 新项目继承旧项目数据，显示"已完成" | 天宝北街 ch1=57条（已修复） |
| V3 | includes 子串删除 | 删除短名项目误伤长名项目 | 删"桥"误删"天桥"（已修复） |
| V4 | 条件回退全局键 | 无项目名时写入全局裸键，成为未来污染源 | GuideChapter/PlanManager（已修复） |

---

## 六、工具函数参考

```typescript
// src/data/projectKeyUtils.ts

/** 判断键是否属于指定项目（精确前缀匹配） */
isKeyForTarget(key: string, target: string): boolean

/** 收集指定项目的所有 localStorage 键 */
collectKeysForTarget(target: string): string[]

/** 已注册的项目级前缀清单 */
PROJECT_KEY_PREFIXES: readonly string[]
```

**使用建议**: 任何涉及项目级 localStorage 键的删除/清理/迁移操作，**必须**通过 `projectKeyUtils.ts` 的函数执行，禁止自行实现 `includes` 或 `startsWith` 逻辑。

---

## 七、维护与更新

- 新增 localStorage 键前缀时，**同步更新** `PROJECT_KEY_PREFIXES` 和本文档§1.1 表格
- 发现新的违规模式时，在§二和§三中补充禁止项和审查项
- 每次版本发布前，按§三清单全量审查一次 localStorage 相关代码
- 文档版本与项目版本同步（如 v5.3 → 本文档 v1.0）
