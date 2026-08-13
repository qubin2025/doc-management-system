/**
 * 项目数据缓存层 — v5.2 延后项7
 *
 * 替代 indicatorEngine / financeMetrics / knowledgeGraph / projectAggregator
 * 直接读 localStorage 的架构异味。
 *
 * 工作原理：
 *   App.tsx 在 fetchProjects 成功后调用 setCachedProjects() 填充内存缓存
 *   数据模块通过 getCachedProjects() 同步读取（无需改 async）
 *   缓存为空时降级到 localStorage（App.tsx 写入的缓存键）
 */

import { ProjectInfo } from '../types';

// 内存缓存（由 App.tsx 在 API 加载后填充）
let cachedProjects: ProjectInfo[] | null = null;

// 文档上传记录缓存（由 App.tsx 在 fetchDocuments 后填充）
let cachedUploads: Record<string, any> | null = null;

const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020'];

/**
 * 填充项目列表缓存（App.tsx 在 fetchProjects 成功后调用）
 */
export function setCachedProjects(projects: ProjectInfo[]): void {
  cachedProjects = projects;
}

/**
 * 填充文档上传记录缓存（App.tsx 在 fetchDocuments 后调用）
 */
export function setCachedUploads(uploads: Record<string, any>): void {
  cachedUploads = uploads;
}

/**
 * 同步获取项目列表（优先内存缓存，降级 localStorage）
 * 替代各模块的 localStorage.getItem('doc-mgmt-projects-*') 直读
 */
export function getCachedProjects(): ProjectInfo[] {
  if (cachedProjects && cachedProjects.length > 0) {
    return cachedProjects;
  }
  // 降级：读 localStorage 缓存（App.tsx 写入）
  const merged: ProjectInfo[] = [];
  for (const std of STANDARDS) {
    try {
      const list = JSON.parse(localStorage.getItem(`doc-mgmt-projects-${std}`) || '[]');
      if (Array.isArray(list)) merged.push(...list);
    } catch { /* 忽略解析错误 */ }
  }
  return merged;
}

/**
 * 同步获取文档上传记录（优先内存缓存，降级 localStorage）
 * 替代各模块的 localStorage.getItem('doc-mgmt-upload-*') 直读
 */
export function getCachedUploads(): Record<string, any> {
  if (cachedUploads) {
    return cachedUploads;
  }
  // 降级：合并两个标准的 localStorage 缓存
  const merged: Record<string, any> = {};
  for (const std of STANDARDS) {
    try {
      const data = JSON.parse(localStorage.getItem(`doc-mgmt-upload-${std}`) || '{}');
      if (data && typeof data === 'object') Object.assign(merged, data);
    } catch { /* 忽略解析错误 */ }
  }
  return merged;
}
