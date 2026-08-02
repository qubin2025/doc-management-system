// 项目聚合器 — 全局看板数据源（照片/文档/截止日期聚合）
// 设计原则：所有函数接收已加载的项目数组作为输入，不自行读取 localStorage。
// 单一真相源：由调用方（GlobalDashboard）统一加载项目数据后传入。

export interface ProjectPhoto {
  fileName: string;
  dataUrl?: string;
  projectName: string;
  uploadTime: string;
  source: 'camera' | 'upload' | 'document';
  size?: number;
}

export interface ProjectDocUpdate {
  fileName: string;
  projectName: string;
  uploadTime: string;
  uploader?: string;
  category?: string;
}

export interface ProjectDeadline {
  projectName: string;
  title: string;
  deadline: string;
  daysLeft: number;
  type: 'milestone' | 'payment' | 'acceptance' | 'other';
}

export interface ProjectInfo {
  name: string;
  createdAt: string;
  standard?: string;
  details?: any;
}

const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020'] as const;

// ===== 项目列表加载（唯一的 localStorage 读取入口） =====

export function loadAllProjects(): ProjectInfo[] {
  const seen = new Set<string>();
  const results: ProjectInfo[] = [];
  try {
    for (const std of STANDARDS) {
      const raw = localStorage.getItem(`doc-mgmt-projects-${std}`);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      for (const p of list) {
        if (p.name && !seen.has(p.name)) {
          seen.add(p.name);
          results.push({
            name: p.name,
            createdAt: p.createdAt || '',
            standard: std,
            details: p.details,
          });
        }
      }
    }
  } catch {}
  return results;
}

// ===== 照片聚合 =====

/** 从项目数组中提取所有照片 */
export function extractAllPhotos(projects: ProjectInfo[]): ProjectPhoto[] {
  const photos: ProjectPhoto[] = [];

  for (const proj of projects) {
    // 来源1: 项目详情中的 projectDocs（含 data 字段的图片）
    const docs = proj.details?.projectDocs;
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc?.fileName || !doc?.data) continue;
        if (!isImageFile(doc.fileName)) continue;
        photos.push({
          fileName: doc.fileName,
          dataUrl: doc.data,
          projectName: proj.name,
          uploadTime: doc.uploadTime || proj.createdAt || '',
          source: 'document',
        });
      }
    }
  }

  // 来源2: upload 缓存 — { [项目名]: { [文档编号]: UploadInfo[] } }
  for (const std of STANDARDS) {
    try {
      const raw = localStorage.getItem(`doc-mgmt-upload-${std}`);
      if (!raw) continue;
      const uploads = JSON.parse(raw);
      for (const [projName, docMap] of Object.entries(uploads)) {
        if (!docMap || typeof docMap !== 'object') continue;
        for (const entries of Object.values(docMap as Record<string, any>)) {
          if (!Array.isArray(entries)) continue;
          for (const entry of entries) {
            if (!entry?.fileName) continue;
            if (!isImageFile(entry.fileName)) continue;
            photos.push({
              fileName: entry.fileName,
              dataUrl: entry.fileData || '',
              projectName: projName,
              uploadTime: entry.uploadTime || '',
              source: 'upload',
              size: entry.fileSize,
            });
          }
        }
      }
    } catch {}
  }

  return photos.sort((a, b) => sortByTime(b.uploadTime, a.uploadTime));
}

/** 某项目的照片 */
export function getProjectPhotos(projects: ProjectInfo[], projectName: string): ProjectPhoto[] {
  return extractAllPhotos(projects).filter(p => p.projectName === projectName);
}

// ===== 文档更新聚合 =====

export function extractRecentDocUpdates(projects: ProjectInfo[]): ProjectDocUpdate[] {
  const updates: ProjectDocUpdate[] = [];

  for (const proj of projects) {
    // 从 projectDocs 提取
    const docs = proj.details?.projectDocs;
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc?.fileName) continue;
        updates.push({
          fileName: doc.fileName,
          projectName: proj.name,
          uploadTime: doc.uploadTime || proj.createdAt || '',
          uploader: doc.uploader || '',
        });
      }
    }
  }

  // 从 upload 缓存提取
  for (const std of STANDARDS) {
    try {
      const raw = localStorage.getItem(`doc-mgmt-upload-${std}`);
      if (!raw) continue;
      const uploads = JSON.parse(raw);
      for (const [projName, docMap] of Object.entries(uploads)) {
        if (!docMap || typeof docMap !== 'object') continue;
        for (const [code, entries] of Object.entries(docMap as Record<string, any>)) {
          if (!Array.isArray(entries)) continue;
          for (const entry of entries) {
            if (!entry?.fileName) continue;
            updates.push({
              fileName: entry.fileName,
              projectName: projName,
              uploadTime: entry.uploadTime || '',
              uploader: entry.uploader || '',
              category: code,
            });
          }
        }
      }
    } catch {}
  }

  return updates.sort((a, b) => sortByTime(b.uploadTime, a.uploadTime));
}

// ===== 截止日期提取 =====

export function extractProjectDeadlines(projects: ProjectInfo[]): ProjectDeadline[] {
  const deadlines: ProjectDeadline[] = [];

  for (const proj of projects) {
    // 从目标管理提取
    try {
      const objectives = JSON.parse(localStorage.getItem(`project-objectives-${proj.name}`) || '[]');
      for (const obj of objectives) {
        if (!obj?.deadline) continue;
        const d = new Date(obj.deadline);
        if (isNaN(d.getTime())) continue;
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
        if (daysLeft > 30) continue; // 只看30天内
        deadlines.push({
          projectName: proj.name,
          title: obj.title || '里程碑',
          deadline: obj.deadline,
          daysLeft,
          type: 'milestone',
        });
      }
    } catch {}

    // 从自定义字段提取
    const customFields = proj.details?.customFields;
    if (Array.isArray(customFields)) {
      for (const f of customFields) {
        if (!f?.key || !f?.value) continue;
        if (!/日期|截止|验收|竣工/.test(f.key)) continue;
        const d = new Date(f.value);
        if (isNaN(d.getTime())) continue;
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
        if (daysLeft > 30) continue;
        deadlines.push({
          projectName: proj.name,
          title: f.key,
          deadline: f.value,
          daysLeft,
          type: /竣工|验收/.test(f.key) ? 'acceptance' : 'milestone',
        });
      }
    }
  }

  return deadlines.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 8);
}

// ===== 统计 =====

export function getProjectPhotoCount(proj: ProjectInfo): number {
  const docs = proj.details?.projectDocs;
  if (!Array.isArray(docs)) return 0;
  return docs.filter((d: any) => d?.data && isImageFile(d.fileName || '')).length;
}

export function getProjectDocCount(proj: ProjectInfo): number {
  const docs = proj.details?.projectDocs;
  return Array.isArray(docs) ? docs.length : 0;
}

export function countProjects(projects: ProjectInfo[]): number {
  return projects.length;
}

export function countNewThisMonth(projects: ProjectInfo[]): number {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  return projects.filter(p => {
    const t = new Date(p.createdAt).getTime();
    return !isNaN(t) && t >= monthStart;
  }).length;
}

export function countNewThisWeek(projects: ProjectInfo[]): number {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  return projects.filter(p => {
    const t = new Date(p.createdAt).getTime();
    return !isNaN(t) && t >= weekStart;
  }).length;
}

// ===== 工具 =====

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i;
function isImageFile(name: string): boolean {
  return IMAGE_RE.test(name);
}

function sortByTime(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (isNaN(a) && isNaN(b)) return 0;
  if (isNaN(a)) return 1;
  if (isNaN(b)) return -1;
  return a - b;
}

// ===== 手机端水印照片 API 集成 =====

export interface MobilePhotoStat {
  projectName: string;
  count: number;
}

/** 通过后端 API 获取各项目的手机水印照片数量 */
export async function fetchMobilePhotoStats(projects: ProjectInfo[]): Promise<MobilePhotoStat[]> {
  const results: MobilePhotoStat[] = [];
  try {
    // 先通过 API 获取带 id 的项目映射
    const API_BASE = '/api';
    const token = (() => { try { return JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token || ''; } catch { return ''; } })();
    const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) hdrs['Authorization'] = `Bearer ${token}`;

    const projRes = await fetch(`${API_BASE}/projects`, { headers: hdrs });
    if (!projRes.ok) return results;
    const apiProjects: { id: number; name: string }[] = (await projRes.json()).map((p: any) => ({ id: p.id, name: p.name }));

    // 为每个项目查询照片列表
    for (const proj of projects) {
      const apiProj = apiProjects.find(ap => ap.name === proj.name);
      if (!apiProj) continue;
      try {
        const photoRes = await fetch(`${API_BASE}/mobile/photo/list?projectId=${apiProj.id}`, { headers: hdrs });
        if (!photoRes.ok) continue;
        const photos = await photoRes.json();
        if (Array.isArray(photos)) {
          results.push({ projectName: proj.name, count: photos.length });
        }
      } catch { /* 单个项目失败不影响其他 */ }
    }
  } catch {}
  return results;
}

/** 通过后端 API 加载手机照片缩略图（最多 maxCount 张） */
export async function fetchMobilePhotosPreview(maxCount: number = 12): Promise<ProjectPhoto[]> {
  const photos: ProjectPhoto[] = [];
  try {
    const API_BASE = '/api';
    const token = (() => { try { return JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token || ''; } catch { return ''; } })();
    const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) hdrs['Authorization'] = `Bearer ${token}`;

    // 先获取所有项目的照片列表
    const listRes = await fetch(`${API_BASE}/mobile/photo/list`, { headers: hdrs });
    if (!listRes.ok) return photos;
    const allPhotos = await listRes.json();
    if (!Array.isArray(allPhotos)) return photos;

    // 取最新的 maxCount 张，加载缩略图
    const recent = allPhotos.slice(0, maxCount);
    for (const p of recent) {
      try {
        const fileRes = await fetch(`${API_BASE}/mobile/photo/file/${p.id}`, { headers: hdrs });
        if (!fileRes.ok) continue;
        const file = await fileRes.json();
        photos.push({
          fileName: file.fileName || p.filePath || 'photo.jpg',
          dataUrl: file.fileData || '',
          projectName: p.projectName || '',
          uploadTime: p.createdAt || new Date().toISOString(),
          source: 'camera',
        });
      } catch { continue; }
    }
  } catch {}
  return photos;
}
