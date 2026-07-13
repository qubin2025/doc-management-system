import type { ProjectObjective } from '../types';

/**
 * 构建WBS树：将扁平数组转为嵌套树结构
 */
export function buildObjectiveTree(items: ProjectObjective[]): ProjectObjective[] {
  const map = new Map<string, ProjectObjective>();
  items.forEach(item => map.set(item.id, { ...item, children: [] }));
  const roots: ProjectObjective[] = [];
  items.forEach(item => {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/**
 * 展平WBS树回到数组
 */
export function flattenTree(tree: ProjectObjective[]): ProjectObjective[] {
  const result: ProjectObjective[] = [];
  const walk = (nodes: ProjectObjective[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return result;
}

/**
 * 计算目标进度（基于关联工作项的完成状态）
 * @param objective 目标节点
 * @param allObjectives 所有目标（用于计算非叶子节点）
 * @param workItemCompletedMap 工作项ID → 是否已完成
 */
export function calculateProgress(
  objective: ProjectObjective,
  allObjectives: ProjectObjective[],
  workItemCompletedMap: Map<string, boolean>
): number {
  // 叶子节点：基于关联工作项
  if (objective.level === 'work-item' || !objective.children || objective.children.length === 0) {
    const linked = objective.linkedWorkItemIds;
    if (linked.length === 0) {
      return objective.status === 'completed' ? 1 : 0;
    }
    const completed = linked.filter(id => workItemCompletedMap.get(id)).length;
    return completed / linked.length;
  }

  // 非叶子节点：子节点加权平均
  const children = allObjectives.filter(o => o.parentId === objective.id);
  if (children.length === 0) return objective.progress;

  const totalWeight = children.reduce((s, c) => s + (c.weight || 1), 0);
  if (totalWeight === 0) {
    return children.reduce((s, c) => s + c.progress, 0) / children.length;
  }
  return children.reduce((s, c) => s + c.progress * (c.weight || 1), 0) / totalWeight;
}

/**
 * 递归重新计算整棵目标树的进度
 * @returns 更新后的目标数组
 */
export function recalculateAllProgress(
  objectives: ProjectObjective[],
  workItemCompletedMap: Map<string, boolean>
): ProjectObjective[] {
  const updated = objectives.map(o => ({ ...o }));

  // 先处理最深层节点（叶子），逐层向上
  const depth = (obj: ProjectObjective): number => {
    const children = updated.filter(c => c.parentId === obj.id);
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(depth));
  };

  const sorted = [...updated].sort((a, b) => {
    const depthA = depth(a);
    const depthB = depth(b);
    return depthB - depthA; // 深层优先
  });

  for (const obj of sorted) {
    obj.progress = calculateProgress(obj, updated, workItemCompletedMap);
    obj.status = obj.progress >= 1 ? 'completed'
      : obj.progress > 0 ? 'in-progress'
      : 'not-started';
  }

  return updated;
}

/**
 * 读取项目所有工作项的完成状态
 * 从localStorage读取guide章节的done集合
 */
export function getWorkItemCompletedMap(projectName: string): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (let ch = 1; ch <= 4; ch++) {
    try {
      const doneKey = `guide-${projectName}-chapter-ch${ch}-done`;
      const raw = localStorage.getItem(doneKey);
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) ids.forEach((id: string) => map.set(id, true));
      }
    } catch { /* 数据不存在或格式错误 */ }
  }
  return map;
}

/**
 * 从localStorage加载项目的目标数据
 */
export function loadObjectives(projectName: string): ProjectObjective[] {
  try {
    const key = `project-objectives-${projectName}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* 数据不存在 */ }
  return [];
}

/**
 * 保存目标数据到localStorage
 */
export function saveObjectives(projectName: string, objectives: ProjectObjective[]): void {
  const key = `project-objectives-${projectName}`;
  localStorage.setItem(key, JSON.stringify(objectives));
}

/**
 * 获取项目的目标概览统计
 */
export function getObjectiveStats(objectives: ProjectObjective[]) {
  const total = objectives.length;
  const completed = objectives.filter(o => o.status === 'completed').length;
  const inProgress = objectives.filter(o => o.status === 'in-progress').length;
  const notStarted = total - completed - inProgress;
  const overallProgress = total > 0
    ? objectives.reduce((s, o) => s + o.progress, 0) / total
    : 0;
  return { total, completed, inProgress, notStarted, overallProgress };
}
