/**
 * v5.7 迭代1第3条: 知识库同步队列处理器
 *
 * 职责：
 * 1. 轮询 /api/kb/sync/queue 获取 pending 任务（后端原子标记为 processing）
 * 2. 对每个任务：GET /sync/task/:source/:recordId 拉取单条业务记录
 * 3. 调用 kbSyncService 的 buildChunk + embedAndStore 入库（复用已有分块/嵌入逻辑）
 * 4. 标记任务 done/failed（失败支持自动重试，由后端 markTaskFailed 控制）
 *
 * 使用方式：
 * - 手动触发一批：await processQueueOnce(onProgress)
 * - 自动轮询：startQueuePoller(onProgress) / stopQueuePoller()
 */

import { vectorStore } from './vectorStore';
import {
  buildDailyChunks,
  buildIssueChunk,
  buildExperienceChunk,
  embedAndStore,
  type Chunk,
  type DailyReportRaw,
  type IssueRaw,
  type ExperienceRaw,
} from './kbSyncService';

export interface QueueTask {
  id: number;
  project_name: string;
  source: 'daily' | 'issue' | 'experience' | 'document';
  record_id: string;
  action: 'upsert' | 'delete';
  priority: number;
  created_at: string;
}

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  synced: number;
  skipped: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const POLL_INTERVAL_MS = 10000;
const BATCH_SIZE = 5;

let pollerTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('doc-system-token') || JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchPendingTasks(limit: number = BATCH_SIZE): Promise<QueueTask[]> {
  const res = await fetch(`${API_BASE}/kb/sync/queue?limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`获取队列失败: ${res.status}`);
  const data = await res.json();
  return (data.tasks || []) as QueueTask[];
}

async function fetchTaskRecord(task: QueueTask): Promise<{ projectName: string; record: unknown }> {
  const res = await fetch(`${API_BASE}/kb/sync/task/${task.source}/${task.record_id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`拉取任务记录失败: ${res.status}`);
  const data = await res.json();
  if (!data.success || !data.task) throw new Error(data.error || '任务记录不存在');
  return { projectName: data.task.projectName as string, record: data.task.record };
}

async function markTaskDone(taskId: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/kb/sync/queue/done`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ taskId }),
    });
  } catch (e) {
    console.error(`[kbQueue] markDone #${taskId} 失败:`, e);
  }
}

async function markTaskFailed(taskId: number, error: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/kb/sync/queue/failed`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ taskId, error: error.slice(0, 500) }),
    });
  } catch (e) {
    console.error(`[kbQueue] markFailed #${taskId} 失败:`, e);
  }
}

function buildChunksForTask(task: QueueTask, record: unknown): Chunk[] {
  if (task.source === 'daily') return buildDailyChunks(record as DailyReportRaw);
  if (task.source === 'issue') return [buildIssueChunk(record as IssueRaw)];
  if (task.source === 'experience') return [buildExperienceChunk(record as ExperienceRaw)];
  return [];
}

function dedupPrefix(task: QueueTask): string {
  if (task.source === 'daily') return `daily-${task.record_id}-`;
  if (task.source === 'issue') return `issue-${task.record_id}`;
  if (task.source === 'document') return `doc-${task.record_id}`;
  return `exp-${task.record_id}`;
}

async function processTask(task: QueueTask): Promise<{ synced: number; skipped: number }> {
  // 项目级删除：清理整个项目的所有向量（项目删除时入队，recordId=__PROJECT__）
  if (task.action === 'delete' && task.record_id === '__PROJECT__') {
    vectorStore.clearProject(task.project_name);
    return { synced: 0, skipped: 0 };
  }

  // delete action: 不需要拉取记录（记录可能已删除），直接用 task.project_name 清理向量
  if (task.action === 'delete') {
    vectorStore.removeByPrefix(dedupPrefix(task), task.project_name);
    return { synced: 0, skipped: 0 };
  }

  const { projectName, record } = await fetchTaskRecord(task);

  // document upsert: 文档解析入库由 ProjectEntryPage 上传时负责，队列只记录状态
  if (task.source === 'document') {
    return { synced: 0, skipped: 1 };
  }

  const chunks = buildChunksForTask(task, record);
  if (chunks.length === 0) return { synced: 0, skipped: 0 };

  // v5.7 迭代4: 从记录中提取 sensitivity（如果有的话），传递给 embedAndStore
  const sens = (record as Record<string, unknown>)?.sensitivity as number | undefined;

  vectorStore.removeByPrefix(dedupPrefix(task), projectName);
  return await embedAndStore(projectName, chunks, undefined, sens);
}

export async function processQueueOnce(onProgress?: (msg: string) => void): Promise<ProcessResult> {
  if (processing) {
    onProgress?.('队列正在处理中，跳过本次');
    return { processed: 0, succeeded: 0, failed: 0, synced: 0, skipped: 0 };
  }
  processing = true;

  let processed = 0, succeeded = 0, failed = 0, synced = 0, skipped = 0;
  try {
    const tasks = await fetchPendingTasks(BATCH_SIZE);
    if (tasks.length === 0) {
      onProgress?.('队列为空，无待处理任务');
      return { processed: 0, succeeded: 0, failed: 0, synced: 0, skipped: 0 };
    }
    onProgress?.(`获取到 ${tasks.length} 个待处理任务`);

    for (const task of tasks) {
      processed++;
      try {
        onProgress?.(`处理 #${task.id}: ${task.source}/${task.record_id} (${task.action})`);
        const r = await processTask(task);
        synced += r.synced;
        skipped += r.skipped;
        await markTaskDone(task.id);
        succeeded++;
        onProgress?.(`#${task.id} 完成: 入库 ${r.synced} 块`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[kbQueue] #${task.id} 失败:`, msg);
        await markTaskFailed(task.id, msg);
        onProgress?.(`#${task.id} 失败: ${msg}`);
      }
    }

    onProgress?.(`本轮完成: 处理 ${processed}, 成功 ${succeeded}, 失败 ${failed}, 入库 ${synced} 块`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[kbQueue] 处理异常:', msg);
    onProgress?.(`处理异常: ${msg}`);
  } finally {
    processing = false;
  }

  return { processed, succeeded, failed, synced, skipped };
}

export function startQueuePoller(onProgress?: (msg: string) => void): void {
  if (pollerTimer) {
    console.log('[kbQueue] 轮询已在运行');
    return;
  }
  console.log(`[kbQueue] 启动自动轮询, 间隔 ${POLL_INTERVAL_MS}ms`);
  processQueueOnce(onProgress);
  pollerTimer = setInterval(() => processQueueOnce(onProgress), POLL_INTERVAL_MS);
}

export function stopQueuePoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
    console.log('[kbQueue] 已停止轮询');
  }
}

export function isPollerRunning(): boolean {
  return pollerTimer !== null;
}

export async function getQueueStats(): Promise<{
  pending: number; processing: number; done: number; failed: number; total: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/kb/sync/queue/stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('获取统计失败');
    const data = await res.json();
    return {
      pending: data.pending || 0,
      processing: data.processing || 0,
      done: data.done || 0,
      failed: data.failed || 0,
      total: data.total || 0,
    };
  } catch {
    return { pending: 0, processing: 0, done: 0, failed: 0, total: 0 };
  }
}
