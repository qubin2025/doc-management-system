/**
 * 知识库同步服务（方案 A）— 日报/问题/经验三表入库
 * 详见 docs/知识库开发专题文档_20260818.md
 */

import { vectorStore, VectorDoc } from './vectorStore';
import * as api from './api';

// ===== 类型 =====
interface DailyReportRaw {
  id: number; project_name: string; report_date: string;
  tasks: Array<{ area?: string; description?: string; workers?: number; todayPct?: string; totalPct?: string; schedule?: string; contractor?: string }>;
  quality_risks: Array<{ name?: string; inspected?: string; hazard?: string }>;
  issues: Array<{ problem?: string; cause?: string; measures?: string; delayDays?: number }>;
  original_text: string; notes: string; reported_by: string; created_at: string;
}
interface IssueRaw {
  id: number; project_name: string; title: string; description: string;
  severity: string; status: string; assignee: string; reported_by: string;
  created_at: string; updated_at: string;
}
interface ExperienceRaw {
  id: string; project_name: string; category: string; title: string;
  description: string; patterns: unknown; metrics: unknown;
  reference_count: number; created_at: string; updated_at: string;
}
interface ProjectSyncStatus {
  projectName: string;
  dailyMaxAt: string | null; dailyCount: number;
  issueMaxAt: string | null; issueCount: number;
  experienceMaxAt: string | null; experienceCount: number;
}
export interface SyncResult {
  success: boolean;
  totalSynced: number; totalSkipped: number;
  daily: { synced: number; skipped: number };
  issues: { synced: number; skipped: number };
  experiences: { synced: number; skipped: number };
  duration: number; error?: string;
}

// ===== 常量 =====
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SYNC_STATE_KEY = 'kb-sync-state';
const LOCAL_STORAGE_WARN_KB = 4 * 1024; // 4MB 预警阈值
const EMBED_CONCURRENCY = 5; // 并发嵌入数
const EMBED_DELAY_MS = 200; // 节流间隔

// ===== 同步状态持久化 =====
type SyncState = Record<string, { dailyAt: string | null; issueAt: string | null; expAt: string | null }>;

function loadSyncState(): SyncState {
  try { return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}'); } catch { return {}; }
}
function saveSyncState(state: SyncState): void {
  try { localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state)); } catch { /* 配额溢出忽略 */ }
}

// ===== HTTP 调用 =====
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('doc-system-token') || JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchSyncStatus(): Promise<{ projects: ProjectSyncStatus[] }> {
  const res = await fetch(`${API_BASE}/kb/sync/status`, { headers: authHeaders() });
  if (!res.ok) throw new Error('获取同步状态失败');
  return await res.json();
}

async function fetchDaily(projectName: string, since?: string): Promise<DailyReportRaw[]> {
  const qs = `projectName=${encodeURIComponent(projectName)}${since ? `&since=${encodeURIComponent(since)}` : ''}`;
  const res = await fetch(`${API_BASE}/kb/sync/daily?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('获取日报失败');
  return (await res.json()).items || [];
}

async function fetchIssues(projectName: string, since?: string): Promise<IssueRaw[]> {
  const qs = `projectName=${encodeURIComponent(projectName)}${since ? `&since=${encodeURIComponent(since)}` : ''}`;
  const res = await fetch(`${API_BASE}/kb/sync/issues?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('获取问题失败');
  return (await res.json()).items || [];
}

async function fetchExperiences(since?: string): Promise<ExperienceRaw[]> {
  const url = `${API_BASE}/kb/sync/experiences${since ? `?since=${encodeURIComponent(since)}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('获取经验失败');
  return (await res.json()).items || [];
}

// ===== 文本拼接 =====
type Chunk = { id: string; text: string; fileName: string; fileType: string; chunkIndex: number; chunkCount: number };

function buildDailyChunks(r: DailyReportRaw): Chunk[] {
  const proj = r.project_name, date = r.report_date;
  const chunks: Chunk[] = [];

  const taskStr = (r.tasks || []).map(t =>
    `区段=${t.area || ''} 描述=${t.description || ''} 工人=${t.workers || 0} 当日进度=${t.todayPct || ''} 累计进度=${t.totalPct || ''} 进度偏差=${t.schedule || ''} 承包商=${t.contractor || ''}`
  ).join('\n');
  if (taskStr.trim()) {
    chunks.push({ id: `daily-${r.id}-seg1`, text: `【项目日报·进度段】项目: ${proj} 日期: ${date}\n${taskStr}`, fileName: `日报-${date}-进度`, fileType: 'daily-segment', chunkIndex: 0, chunkCount: 4 });
  }

  const qrStr = (r.quality_risks || []).map(q =>
    `名称=${q.name || ''} 检查情况=${q.inspected || ''} 隐患=${q.hazard || ''}`
  ).join('\n');
  if (qrStr.trim()) {
    chunks.push({ id: `daily-${r.id}-seg2`, text: `【项目日报·质量风险段】项目: ${proj} 日期: ${date}\n${qrStr}`, fileName: `日报-${date}-质量风险`, fileType: 'daily-segment', chunkIndex: 1, chunkCount: 4 });
  }

  const issueStr = (r.issues || []).map(i =>
    `问题=${i.problem || ''} 原因=${i.cause || ''} 措施=${i.measures || ''} 延误天数=${i.delayDays || 0}`
  ).join('\n');
  if (issueStr.trim()) {
    chunks.push({ id: `daily-${r.id}-seg3`, text: `【项目日报·现场问题段】项目: ${proj} 日期: ${date}\n${issueStr}`, fileName: `日报-${date}-现场问题`, fileType: 'daily-segment', chunkIndex: 2, chunkCount: 4 });
  }

  const orig = (r.original_text || '').slice(0, 1500);
  if (orig.trim() || (r.notes || '').trim()) {
    chunks.push({ id: `daily-${r.id}-seg4`, text: `【项目日报·原文备注段】项目: ${proj} 日期: ${date}\n${orig}${r.notes ? `\n备注: ${r.notes}` : ''}`, fileName: `日报-${date}-原文备注`, fileType: 'daily-segment', chunkIndex: 3, chunkCount: 4 });
  }
  return chunks;
}

function buildIssueChunk(i: IssueRaw): Chunk {
  const text = `【现场问题】项目: ${i.project_name} 标题: ${i.title}\n描述: ${i.description || '无描述'}\n严重等级: ${i.severity} 状态: ${i.status} 责任人: ${i.assignee || '未分配'}\n报告人: ${i.reported_by} 创建时间: ${i.created_at}`;
  return { id: `issue-${i.id}`, text, fileName: `问题-${i.title}`, fileType: 'issue', chunkIndex: 0, chunkCount: 1 };
}

function buildExperienceChunk(e: ExperienceRaw): Chunk {
  const text = `【项目经验】项目: ${e.project_name} 分类: ${e.category}\n标题: ${e.title}\n描述: ${e.description}\n模式: ${JSON.stringify(e.patterns)}\n指标: ${JSON.stringify(e.metrics)}\n引用次数: ${e.reference_count}`;
  return { id: `exp-${e.id}`, text, fileName: `经验-${e.title}`, fileType: 'experience', chunkIndex: 0, chunkCount: 1 };
}

// ===== 并发嵌入 + 批量入库 =====
async function embedAndStore(projectName: string, chunks: Chunk[], onProgress?: (msg: string) => void): Promise<{ synced: number; skipped: number }> {
  let synced = 0, skipped = 0;
  const stats = vectorStore.stats(projectName);
  const skipLS = stats.sizeKB > LOCAL_STORAGE_WARN_KB; // 容量预警：单项目 > 4MB 时只写 IndexedDB

  for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
    const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
    const results = await Promise.all(batch.map(async c => {
      try {
        const emb = await api.embedText(c.text, 'document');
        return emb && emb.length > 0 ? { chunk: c, emb } : null;
      } catch { return null; }
    }));

    const docs: VectorDoc[] = [];
    for (const r of results) {
      if (r) {
        docs.push({
          id: r.chunk.id, text: r.chunk.text, embedding: r.emb,
          metadata: { projectName, fileName: r.chunk.fileName, fileType: r.chunk.fileType, uploadTime: new Date().toISOString(), chunkIndex: r.chunk.chunkIndex, chunkCount: r.chunk.chunkCount },
        });
        synced++;
      } else { skipped++; }
    }
    if (docs.length > 0) {
      if (skipLS) {
        // 容量预警：仅走 IndexedDB 异步层（不污染 localStorage）
        const { addDocument } = await import('./indexedDBStore');
        await Promise.all(docs.map(d => addDocument(d, projectName).catch(() => {})));
      } else {
        vectorStore.addDocuments(docs);
      }
    }
    if (onProgress && chunks.length > 10) {
      onProgress(`已处理 ${Math.min(i + EMBED_CONCURRENCY, chunks.length)}/${chunks.length} 段`);
    }
    await new Promise(r => setTimeout(r, EMBED_DELAY_MS));
  }
  return { synced, skipped };
}

// ===== 单项目同步 =====
async function syncProjectDaily(projectName: string, since?: string): Promise<{ synced: number; skipped: number }> {
  const reports = await fetchDaily(projectName, since);
  if (reports.length === 0) return { synced: 0, skipped: 0 };
  const allChunks: Chunk[] = [];
  for (const r of reports) {
    vectorStore.removeByPrefix(`daily-${r.id}-`, projectName); // 去重
    allChunks.push(...buildDailyChunks(r));
  }
  return embedAndStore(projectName, allChunks);
}

async function syncProjectIssues(projectName: string, since?: string): Promise<{ synced: number; skipped: number }> {
  const items = await fetchIssues(projectName, since);
  if (items.length === 0) return { synced: 0, skipped: 0 };
  const chunks: Chunk[] = items.map(buildIssueChunk);
  for (const i of items) vectorStore.removeByPrefix(`issue-${i.id}`, projectName);
  return embedAndStore(projectName, chunks);
}

async function syncExperiencesInternal(since?: string): Promise<{ synced: number; skipped: number }> {
  const items = await fetchExperiences(since);
  if (items.length === 0) return { synced: 0, skipped: 0 };
  // 经验库按项目分组（同一项目批量入库）
  const byProject = new Map<string, Chunk[]>();
  for (const e of items) {
    if (!e.project_name) continue;
    vectorStore.removeByPrefix(`exp-${e.id}`, e.project_name);
    const list = byProject.get(e.project_name) || [];
    list.push(buildExperienceChunk(e));
    byProject.set(e.project_name, list);
  }
  let totalSynced = 0, totalSkipped = 0;
  for (const [proj, chunks] of byProject) {
    const r = await embedAndStore(proj, chunks);
    totalSynced += r.synced; totalSkipped += r.skipped;
  }
  return { synced: totalSynced, skipped: totalSkipped };
}

// ===== 同步入口 =====
export async function syncAll(forceFull: boolean, onProgress?: (msg: string) => void): Promise<SyncResult> {
  const start = Date.now();
  const state = loadSyncState();
  let dailyRes = { synced: 0, skipped: 0 };
  let issueRes = { synced: 0, skipped: 0 };
  let expRes = { synced: 0, skipped: 0 };

  try {
    onProgress?.('获取同步状态...');
    const status = await fetchSyncStatus();

    for (const p of status.projects) {
      const ps = state[p.projectName] || { dailyAt: null, issueAt: null, expAt: null };

      const dSince = forceFull ? undefined : (ps.dailyAt || undefined);
      if (forceFull || (p.dailyMaxAt && p.dailyMaxAt !== ps.dailyAt)) {
        onProgress?.(`同步 ${p.projectName} 日报（${p.dailyCount} 份）...`);
        dailyRes = await syncProjectDaily(p.projectName, dSince);
        ps.dailyAt = p.dailyMaxAt || new Date().toISOString();
      }

      const iSince = forceFull ? undefined : (ps.issueAt || undefined);
      if (forceFull || (p.issueMaxAt && p.issueMaxAt !== ps.issueAt)) {
        onProgress?.(`同步 ${p.projectName} 问题（${p.issueCount} 条）...`);
        issueRes = await syncProjectIssues(p.projectName, iSince);
        ps.issueAt = p.issueMaxAt || new Date().toISOString();
      }

      state[p.projectName] = ps;
      saveSyncState(state);
    }

    onProgress?.('同步经验库...');
    expRes = await syncExperiencesInternal(forceFull ? undefined : undefined);

    saveSyncState(state);

    return {
      success: true,
      totalSynced: dailyRes.synced + issueRes.synced + expRes.synced,
      totalSkipped: dailyRes.skipped + issueRes.skipped + expRes.skipped,
      daily: dailyRes, issues: issueRes, experiences: expRes,
      duration: Date.now() - start,
    };
  } catch (e: unknown) {
    return {
      success: false,
      totalSynced: dailyRes.synced + issueRes.synced + expRes.synced,
      totalSkipped: dailyRes.skipped + issueRes.skipped + expRes.skipped,
      daily: dailyRes, issues: issueRes, experiences: expRes,
      duration: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getSyncStatus(): Promise<{ projects: ProjectSyncStatus[] }> {
  return fetchSyncStatus();
}

export function getLocalSyncState(): SyncState {
  return loadSyncState();
}

export const kbSyncService = { syncAll, getSyncStatus, getLocalSyncState };
