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
