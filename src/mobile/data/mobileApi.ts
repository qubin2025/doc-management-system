// 移动端 API 封装 — 复用桌面端 token 体系（src/data/api.ts 的 setAuthToken/getAuthToken）
import { getAuthToken } from '../../data/api';
import { MobileProject, WatermarkTemplate } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}

/** 项目列表（保留 id — 桌面端 fetchProjects 丢弃了 id，照片上传必须要 id） */
export async function fetchProjectsWithId(): Promise<MobileProject[]> {
  const res = await fetch(`${API_BASE}/projects`, { headers: jsonHeaders() });
  if (!res.ok) throw new Error('获取项目列表失败');
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((p: any) => ({ id: p.id, name: p.name }));
}

export interface PhotoMeta {
  projectId: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  poi?: string;
  address?: string;
  watermarkData?: Record<string, unknown>;
}

/** 水印照片上传（FormData：不手动设 Content-Type，浏览器自动带 boundary） */
export async function uploadPhoto(blob: Blob, fileName: string, meta: PhotoMeta): Promise<{ id: number }> {
  const fd = new FormData();
  fd.append('photo', blob, fileName);
  fd.append('projectId', String(meta.projectId));
  if (meta.location) fd.append('location', meta.location);
  if (meta.latitude != null) fd.append('latitude', String(meta.latitude));
  if (meta.longitude != null) fd.append('longitude', String(meta.longitude));
  if (meta.poi) fd.append('poi', meta.poi);
  if (meta.address) fd.append('address', meta.address);
  if (meta.watermarkData) fd.append('watermarkData', JSON.stringify(meta.watermarkData));

  const res = await fetch(`${API_BASE}/mobile/photo/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '照片上传失败');
  return data;
}

/** 模板云端保存（后端 body 格式：{ templateData: { name, data } }） */
export async function saveTemplateCloud(template: WatermarkTemplate): Promise<void> {
  const res = await fetch(`${API_BASE}/mobile/template/save`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ templateData: { name: template.name, data: template } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '模板云端保存失败');
  }
}

/** 查询手机照片列表 */
export interface MobilePhotoItem {
  id: number;
  projectId: number;
  projectName: string;
  filePath: string;
  watermarkData: Record<string, unknown>;
  location: string;
  latitude: number | null;
  longitude: number | null;
  poi: string;
  address: string;
  uploadedBy: string;
  createdAt: string;
}

export async function listMobilePhotos(projectId?: number): Promise<MobilePhotoItem[]> {
  const params = projectId ? `?projectId=${projectId}` : '';
  const res = await fetch(`${API_BASE}/mobile/photo/list${params}`, { headers: jsonHeaders() });
  if (!res.ok) throw new Error('获取照片列表失败');
  return await res.json();
}

export async function getMobilePhotoFile(id: number): Promise<{ fileName: string; fileData: string }> {
  const res = await fetch(`${API_BASE}/mobile/photo/file/${id}`, { headers: jsonHeaders() });
  if (!res.ok) throw new Error('获取照片文件失败');
  return await res.json();
}

export async function deleteMobilePhoto(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/mobile/photo/${id}`, { method: 'DELETE', headers: jsonHeaders() });
  if (!res.ok) throw new Error('删除照片失败');
}

/** 桌面端直接上传照片 (FormData, 不含水印), 用于项目展示 */
export async function uploadDisplayPhoto(file: File, projectId: number, location?: string): Promise<{ id: number }> {
  const fd = new FormData();
  fd.append('photo', file);
  fd.append('projectId', String(projectId));
  if (location) fd.append('location', location);
  const res = await fetch(`${API_BASE}/mobile/photo/upload`, { method: 'POST', headers: authHeaders(), body: fd });
  if (!res.ok) throw new Error('上传失败');
  return await res.json();
}

/** 拉取云端模板列表，解析 template_data 为 WatermarkTemplate（解析失败的条目跳过） */
export async function listTemplatesCloud(): Promise<WatermarkTemplate[]> {
  const res = await fetch(`${API_BASE}/mobile/template/list`, { headers: jsonHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  const out: WatermarkTemplate[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.template_data);
      if (parsed && parsed.fields && parsed.style) out.push(parsed);
    } catch { /* 跳过非法条目 */ }
  }
  return out;
}

// ===== v4.4 日报类型与API =====
export interface MachineryItem { name: string; spec: string; count: number; }
export interface MaterialItem { name: string; spec: string; quantity: string; note: string; }
export interface TaskItem { area: string; description: string; workersAM: number; workersPM: number; workers: number; todayPct: string; totalPct: string; schedule: string; contractor: string; }
export interface QualityRiskItem { name: string; startDate: string; inspected: string; inspectionResult: string; hazard: string; }
export interface IssueItem2 { problem: string; cause: string; delayDays: number; measures: string; needHelp: string; }
export interface DailyReportFull {
  id: number; projectId: number; projectName?: string; reportDate: string;
  weatherDay: string; weatherNight: string; weatherAlert: string; weatherAlertLevel: string;
  managersMain: number; managersLabor: number; managersSpecialty: number;
  workersMain: number; workersLabor: number; workersSpecialty: number; workersSpecial: number; workersTotal: number;
  machinery: MachineryItem[]; machineryTotal: number; materials: MaterialItem[];
  tasks: TaskItem[]; qualityRisks: QualityRiskItem[]; issues: IssueItem2[]; photos: string[];
  originalText: string; notes: string; reportedBy: string; deleted?: number; createdAt: string;
}
export interface SubmitDailyReportParams {
  projectId: number; reportDate: string; weatherDay: string; weatherNight: string; weatherAlert: string; weatherAlertLevel: string;
  managersMain: number; managersLabor: number; managersSpecialty: number;
  workersMain: number; workersLabor: number; workersSpecialty: number; workersSpecial: number; workersTotal: number;
  machinery: MachineryItem[]; machineryTotal: number; materials: MaterialItem[];
  tasks: TaskItem[]; qualityRisks: QualityRiskItem[]; issues: IssueItem2[]; photos: string[];
  originalText?: string; notes: string;
}
export async function listDailyReports(projectId?: number): Promise<DailyReportFull[]> {
  const params = projectId ? `?projectId=${projectId}` : '';
  const res = await fetch(`${API_BASE}/mobile/daily/list${params}`, { headers: jsonHeaders() });
  if (!res.ok) return [];
  return await res.json();
}
export async function submitDailyReport(params: SubmitDailyReportParams): Promise<{ id: number; message: string }> {
  const res = await fetch(`${API_BASE}/mobile/daily/submit`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(params) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '提交失败');
  return data;
}
export async function uploadDailyFile(projectId: number, projectName: string, file: File): Promise<{
  parsed: Record<string, any> | null; saved?: { id: number; message: string }; rawText?: string;
}> {
  const fd = new FormData(); fd.append('file', file); fd.append('projectId', String(projectId)); fd.append('projectName', projectName);
  const res = await fetch(`${API_BASE}/mobile/daily/upload`, { method: 'POST', headers: authHeaders(), body: fd });
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || '文件上传失败'); }
  return await res.json();
}
export async function updateDailyReport(id: number, params: SubmitDailyReportParams): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/mobile/daily/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(params) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '修改失败');
  return data;
}
export async function deleteDailyReport(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/mobile/daily/${id}`, { method: 'DELETE', headers: jsonHeaders() });
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || '删除失败'); }
}

// ===== v4.4 预警与问题 =====
export interface NoticeData { totalMessages: number; urgentCount: number; todayTasks: number; upcomingDeadlines: { id: string; title: string; projectName: string; status: string; progress: number; deadline: string }[]; recentNotifications: { id: number; action: string; targetType: string; detail: string; time: string }[]; }
export async function checkNotices(): Promise<NoticeData> {
  const res = await fetch(`${API_BASE}/mobile/notice/check`, { headers: jsonHeaders() });
  if (!res.ok) throw new Error('获取通知失败');
  return await res.json();
}
export interface IssueItem { id: number; projectId: number; projectName: string; title: string; description: string; severity: 'normal'|'urgent'|'critical'; status: 'reported'|'processing'|'resolved'|'closed'; assignee: string; photoPath: string; reportedBy: string; createdAt: string; updatedAt: string; }
export async function reportIssue(params: { projectId: number; title: string; description?: string; severity?: string; assignee?: string; photoData?: string }): Promise<{ id: number }> {
  const res = await fetch(`${API_BASE}/mobile/issue/report`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(params) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '问题上报失败');
  return data;
}
export async function listIssues(projectId?: number, status?: string): Promise<IssueItem[]> {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', String(projectId));
  if (status) params.set('status', status);
  const res = await fetch(`${API_BASE}/mobile/issue/list?${params}`, { headers: jsonHeaders() });
  if (!res.ok) return [];
  return await res.json();
}
export async function updateIssueStatus(id: number, status: string, assignee?: string): Promise<void> {
  await fetch(`${API_BASE}/mobile/issue/update`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ id, status, assignee }) });
}
export async function listProgress(projectId?: number): Promise<ProgressEntry[]> { const params = projectId ? `?projectId=${projectId}` : ""; const res = await fetch(`${API_BASE}/mobile/progress/list${params}`, { headers: jsonHeaders() }); if (!res.ok) return []; return await res.json(); }

// ===== v4.4 进度管理 =====
export interface ProgressEntry { id: number; projectId: number; projectName?: string; planItemId: string | null; title: string; percentage: number; note: string; reportedBy: string; matchStatus: 'matched'|'unmatched'; createdAt: string; }
export async function reportProgress(params: { projectId: number; title: string; percentage: number; note?: string }): Promise<{ id: number; matchStatus: string }> {
  const res = await fetch(`${API_BASE}/mobile/progress/report`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(params) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '进度上报失败');
  return data;
}

// ===== v4.4 干系人 =====
export interface StakeholderItem { id: number; name: string; role: string; org: string; contact: string; }
export async function uploadDocument(params: { projectId: number; docId: string; fileName: string; fileData: string; uploadTime?: string; version?: string; standard?: string }): Promise<void> { const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ projectId: params.projectId, docId: params.docId, fileName: params.fileName, fileData: params.fileData, uploadTime: params.uploadTime || new Date().toISOString(), version: params.version || "1.0", standard: params.standard || "DB11/T695-2025" }) }); if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "文档上传失败"); } }
export async function fetchStakeholders(projectName: string): Promise<StakeholderItem[]> {
  const res = await fetch(`${API_BASE}/stakeholders?project=${encodeURIComponent(projectName)}`, { headers: jsonHeaders() });
  if (!res.ok) return [];
  return await res.json();
}
