import { ProjectInfo, UploadInfo } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ========== 项目 ==========
export async function fetchProjects(): Promise<ProjectInfo[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('获取项目列表失败');
  const data = await res.json();
  return data.map((p: any) => ({ name: p.name, createdAt: p.created_at }));
}

export async function createProject(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '创建项目失败');
  }
}

export async function deleteProjectApi(projectName: string): Promise<void> {
  // 需要先获取项目 id
  const projects = await fetchProjects();
  const proj = projects.find(p => p.name === projectName);
  if (!proj) return;
  const res = await fetch(`${API_BASE}/projects/${(proj as any).id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('删除项目失败');
}

// ========== 文档 ==========
export async function fetchDocuments(projectName: string, standard: string): Promise<Record<string, UploadInfo[]>> {
  const projects = await fetchProjects();
  const proj = projects.find(p => p.name === projectName);
  if (!proj) return {};

  const url = `${API_BASE}/documents/project/${(proj as any).id}?standard=${encodeURIComponent(standard)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('获取文档列表失败');
  return await res.json();
}

export async function uploadDocument(
  projectName: string,
  docId: string,
  info: UploadInfo,
  standard: string
): Promise<void> {
  const projects = await fetchProjects();
  let proj = projects.find(p => p.name === projectName);

  if (!proj) {
    // 自动创建项目
    await createProject(projectName);
    const newProjects = await fetchProjects();
    proj = newProjects.find(p => p.name === projectName);
  }

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: (proj as any).id,
      docId,
      fileName: info.fileName,
      fileData: info.fileData || null,
      uploadTime: info.uploadTime,
      uploader: info.uploader,
      version: info.version,
      standard,
    }),
  });
  if (!res.ok) throw new Error('上传文档失败');
}

export async function deleteDocumentApi(docId: string, fileIndex: number, projectName: string, standard: string): Promise<void> {
  const docs = await fetchDocuments(projectName, standard);
  const files = docs[docId] || [];
  if (fileIndex >= files.length) return;

  const file = files[fileIndex] as any;
  if (!file.id) return;

  const res = await fetch(`${API_BASE}/documents/${file.id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('删除文档失败');
}

// ========== 登录 ==========
export async function login(username: string, password: string): Promise<{ id: number; username: string; role: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('登录失败');
  return await res.json();
}
