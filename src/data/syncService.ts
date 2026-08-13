/**
 * 数据持久化同步服务 — 将localStorage数据定时同步到后端SQLite
 * 启动后每60秒自动同步，失败时记录错误次数
 */

import * as api from './api';
import { loadObjectives } from './objectiveEngine';
import { loadTailoringConfig } from './tailoringEngine';

interface SyncStatus {
  lastSync: string | null;
  pendingChanges: number;
  errors: number;
  syncing: boolean;
}

let status: SyncStatus = { lastSync: null, pendingChanges: 0, errors: 0, syncing: false };
let timer: ReturnType<typeof setInterval> | null = null;
let projectName: string | null = null;

export function getSyncStatus(): SyncStatus {
  return { ...status };
}

/** 收集当前项目所有需同步的数据 */
function collectProjectData(proj: string): Record<string, any[]> {
  const data: Record<string, any[]> = {};

  // 目标
  try {
    const obj = loadObjectives(proj);
    if (obj.length > 0) data.objectives = obj;
  } catch {}

  // 裁剪配置
  try {
    const cfg = loadTailoringConfig(proj);
    if (cfg) data.tailoring = [cfg];
  } catch {}

  // 干系人
  try {
    const sh = localStorage.getItem(`stakeholder-${proj}`);
    if (sh) data.stakeholders = JSON.parse(sh);
  } catch {}

  // 风险
  try {
    const rk = localStorage.getItem(`risk-${proj}`);
    if (rk) data.risks = JSON.parse(rk);
  } catch {}

  // 资源团队
  try {
    const rs = localStorage.getItem(`resources-${proj}`);
    if (rs) data.resources = JSON.parse(rs);
  } catch {}

  // RACI
  try {
    const rc = localStorage.getItem(`raci-${proj}`);
    if (rc) data.raci = JSON.parse(rc);
  } catch {}

  // 指南进度（四章）— v5.2: done/modules 键名均带项目名，与 GuideChapter 写入方一致
  try {
    const chapters: any[] = [];
    for (let ch = 1; ch <= 4; ch++) {
      const done = localStorage.getItem(`guide-${proj}-chapter-ch${ch}-done`);
      const modules = localStorage.getItem(`guide-${proj}-chapter-ch${ch}-modules`);
      if (done || modules) {
        chapters.push({ chapter: ch, done: done ? JSON.parse(done) : [], modules: modules ? JSON.parse(modules) : [] });
      }
    }
    if (chapters.length > 0) data.guideProgress = chapters;
  } catch {}

  // v5.2: 工作流知识产物（项目级）
  try {
    const ka = localStorage.getItem(`knowledge-artifacts-${proj}`);
    if (ka) data.knowledgeArtifacts = JSON.parse(ka);
  } catch {}

  // v5.2: 计划文件（项目级，CPM/甘特图数据）
  try {
    const pf = localStorage.getItem(`plan-files-${proj}`);
    if (pf) data.planFiles = JSON.parse(pf);
  } catch {}

  return data;
}

/** 执行一次同步 */
export async function syncNow(proj?: string): Promise<boolean> {
  const p = proj || projectName;
  if (!p) return false;
  if (status.syncing) return false;

  status.syncing = true;
  try {
    const data = collectProjectData(p);
    const payload = { projectName: p, data };
    await api.syncProjectData(p, payload);
    status.lastSync = new Date().toISOString();
    status.errors = 0;
    status.pendingChanges = 0;
    console.log(`[Sync] Synced ${Object.keys(data).length} data types for "${p}"`);
    return true;
  } catch (e: any) {
    status.errors++;
    status.pendingChanges++;
    console.warn('[Sync] Failed:', e.message);
    return false;
  } finally {
    status.syncing = false;
  }
}

/** 标记有待同步的变更 */
export function markChanged(): void {
  status.pendingChanges++;
}

/** 启动自动同步 */
export function startSync(proj: string, intervalMs = 60000): void {
  projectName = proj;
  if (timer) clearInterval(timer);
  // 首次同步延迟5秒
  setTimeout(() => syncNow(proj), 5000);
  timer = setInterval(() => syncNow(proj), intervalMs);
  console.log(`[Sync] Auto-sync started for "${proj}", every ${intervalMs / 1000}s`);
}

/** 停止自动同步 */
export function stopSync(): void {
  if (timer) { clearInterval(timer); timer = null; }
  projectName = null;
}
