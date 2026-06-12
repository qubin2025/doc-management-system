// CPM 关键路径法引擎 — ES/EF/LS/LF/Float/关键路径计算

export interface CpmTask {
  id: string;
  name: string;
  duration: number;     // 工期(天)
  predecessors: string[]; // 前置任务ID列表
  start?: string;        // 计划开始日期(YYYY-MM-DD)
  end?: string;          // 计划结束日期
  progress?: number;     // 完成百分比 0-100
}

export interface CpmResult {
  tasks: CpmTaskResult[];
  criticalPath: string[]; // 关键路径任务ID列表
  totalDuration: number;  // 项目总工期
}

export interface CpmTaskResult extends CpmTask {
  es: number;  // 最早开始 (第几天)
  ef: number;  // 最早完成
  ls: number;  // 最晚开始
  lf: number;  // 最晚完成
  float: number; // 总浮时
  critical: boolean; // 是否在关键路径上
}

/** 前推计算 ES/EF */
function forwardPass(tasks: CpmTaskResult[]): void {
  const visited = new Set<string>();
  const queue: CpmTaskResult[] = [];

  // 无前置任务的任务 ES=0
  for (const t of tasks) {
    if (t.predecessors.length === 0) {
      t.es = 0;
      t.ef = t.duration;
      visited.add(t.id);
      queue.push(t);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    // 找所有依赖当前任务的后继任务
    for (const t of tasks) {
      if (t.predecessors.includes(current.id)) {
        // 检查是否所有前置任务已计算
        const allPredsDone = t.predecessors.every(pid => visited.has(pid));
        if (allPredsDone && !visited.has(t.id)) {
          // EF = max(所有前置任务的EF)
          t.es = Math.max(...t.predecessors.map(pid => {
            const pred = tasks.find(p => p.id === pid);
            return pred ? pred.ef : 0;
          }));
          t.ef = t.es + t.duration;
          visited.add(t.id);
          queue.push(t);
        }
      }
    }
  }
}

/** 后推计算 LS/LF */
function backwardPass(tasks: CpmTaskResult[]): void {
  // 找所有没有后继任务的任务（终点任务）
  const hasSuccessor = new Set<string>();
  for (const t of tasks) {
    for (const pid of t.predecessors) hasSuccessor.add(pid);
  }
  const endTasks = tasks.filter(t => !hasSuccessor.has(t.id));

  // 项目结束时间 = max(所有终点任务的EF)
  const projectEnd = Math.max(...endTasks.map(t => t.ef));

  // 终点任务 LF = projectEnd
  const visited = new Set<string>();
  const queue: CpmTaskResult[] = [];

  for (const t of endTasks) {
    t.lf = projectEnd;
    t.ls = t.lf - t.duration;
    visited.add(t.id);
    queue.push(t);
  }

  while (queue.length > 0) {
    queue.shift();
    // 找所有被当前任务依赖的前置任务
    for (const t of tasks) {
      const successors = tasks.filter(s => s.predecessors.includes(t.id));
      const allSuccDone = successors.every(s => visited.has(s.id));
      if (allSuccDone && !visited.has(t.id)) {
        // LF = min(所有后继任务的LS)
        t.lf = Math.min(...successors.map(s => s.ls));
        t.ls = t.lf - t.duration;
        visited.add(t.id);
        queue.push(t);
      }
    }
  }
}

/** CPM 计算主函数 */
export function computeCpm(tasks: CpmTask[]): CpmResult {
  const results: CpmTaskResult[] = tasks.map(t => ({
    ...t,
    es: 0, ef: 0, ls: 0, lf: 0, float: 0, critical: false,
  }));

  forwardPass(results);
  backwardPass(results);

  // 计算浮时和关键路径
  for (const t of results) {
    t.float = t.ls - t.es;
    t.critical = t.float === 0;
  }

  const criticalPath = results.filter(t => t.critical).sort((a, b) => a.es - b.es).map(t => t.id);
  const totalDuration = Math.max(...results.map(t => t.lf), 0);

  return { tasks: results, criticalPath, totalDuration };
}

/** 从xlsx解析的计划数据转换为CpmTask[] */
export function parseScheduleFromRows(rows: any[][]): CpmTask[] {
  // 期望列: 序号 | 任务名称 | 工期(天) | 开始日期 | 结束日期 | 前置任务(逗号分隔) | 进度%
  const tasks: CpmTask[] = [];
  for (const row of rows) {
    if (!row[1] || !row[2]) continue; // 跳过空行
    tasks.push({
      id: String(row[0] || tasks.length + 1),
      name: String(row[1] || ''),
      duration: parseInt(String(row[2])) || 1,
      start: row[3] ? String(row[3]) : undefined,
      end: row[4] ? String(row[4]) : undefined,
      predecessors: row[5] ? String(row[5]).split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
      progress: row[6] ? parseInt(String(row[6])) || 0 : 0,
    });
  }
  return tasks;
}
