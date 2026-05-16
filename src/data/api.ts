import { ProjectInfo, UploadInfo, AuthState, UserInfo, Permissions } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
let authToken = localStorage.getItem('doc-system-token') || '';

export function setAuthToken(token: string) {
  authToken = token;
  if (token) localStorage.setItem('doc-system-token', token);
  else localStorage.removeItem('doc-system-token');
}

export function getAuthToken() { return authToken; }

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

// ========== 连接检查 ==========
export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/`, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch { return false; }
}

// ========== 认证 ==========
export async function login(username: string, password: string): Promise<AuthState> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '登录失败');
  setAuthToken(data.token);
  return { token: data.token, user: data.user, permissions: data.permissions };
}

export async function getMe(): Promise<{ user: UserInfo; permissions: Permissions } | null> {
  if (!authToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: headers() });
    if (!res.ok) { setAuthToken(''); return null; }
    return await res.json();
  } catch { return null; }
}

export async function logout() {
  try { await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: headers() }); } catch {}
  setAuthToken('');
}

// ========== 用户管理（admin） ==========
export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/auth/users`, { headers: headers() });
  if (!res.ok) throw new Error('获取用户列表失败');
  return await res.json();
}

export async function createUser(data: { username: string; password: string; displayName?: string; role?: string; permissions?: Permissions }) {
  const res = await fetch(`${API_BASE}/auth/users`, { method: 'POST', body: JSON.stringify(data), headers: headers() });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '创建用户失败');
  return d;
}

export async function updateUser(id: number, data: any) {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: headers() });
  if (!res.ok) throw new Error('更新用户失败');
  return await res.json();
}

export async function deleteUser(id: number) {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error('删除用户失败');
  return await res.json();
}

// ========== 项目 ==========
export async function fetchProjects(): Promise<ProjectInfo[]> {
  const res = await fetch(`${API_BASE}/projects`, { headers: headers() });
  if (!res.ok) throw new Error('获取项目列表失败');
  const data = await res.json();
  return data.map((p: any) => ({ name: p.name, createdAt: p.created_at }));
}

export async function createProject(name: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects`, { method: 'POST', body: JSON.stringify({ name }), headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '创建项目失败');
  return data;
}

export async function deleteProjectApi(projectName: string): Promise<void> {
  const projects = await fetchProjects();
  const proj = projects.find(p => p.name === projectName);
  if (!proj) return;
  await fetch(`${API_BASE}/projects/${(proj as any).id}`, { method: 'DELETE', headers: headers() });
}

// ========== 文档 ==========
export async function fetchDocuments(projectName: string, standard: string): Promise<Record<string, UploadInfo[]>> {
  const projects = await fetchProjects();
  const proj = projects.find(p => p.name === projectName);
  if (!proj) return {};
  const res = await fetch(`${API_BASE}/documents/project/${(proj as any).id}?standard=${encodeURIComponent(standard)}`, { headers: headers() });
  if (!res.ok) throw new Error('获取文档列表失败');
  return await res.json();
}

export async function uploadDocument(projectName: string, docId: string, info: UploadInfo, standard: string): Promise<any> {
  const projects = await fetchProjects();
  let proj = projects.find(p => p.name === projectName);
  if (!proj) { await createProject(projectName); const np = await fetchProjects(); proj = np.find(p => p.name === projectName); }
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST', body: JSON.stringify({
      projectId: (proj as any).id, docId, fileName: info.fileName, fileData: info.fileData || null,
      uploadTime: info.uploadTime, uploader: info.uploader, version: info.version, standard,
    }), headers: headers(),
  });
  if (!res.ok) throw new Error('上传文档失败');
  return await res.json();
}

export async function deleteDocumentApi(docId: string, fileIndex: number, projectName: string, standard: string): Promise<void> {
  const docs = await fetchDocuments(projectName, standard);
  const files = docs[docId] || [];
  if (fileIndex >= files.length) return;
  const file = files[fileIndex] as any;
  if (!file.id) return;
  await fetch(`${API_BASE}/documents/${file.id}`, { method: 'DELETE', headers: headers() });
}

// ========== AI 聊天 ==========
export async function aiChat(
  messages: { role: string; content: string }[],
  context?: string,
  opts?: { projectName?: string; standard?: string }
): Promise<string> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST', body: JSON.stringify({
      messages,
      context: context || '',
      projectName: opts?.projectName || '',
      standard: opts?.standard || '',
    }), headers: headers(),
  });
  if (!res.ok) throw new Error('AI 请求失败');
  const data = await res.json();
  return data.reply || data.message || JSON.stringify(data);
}

// ========== 备份 ==========
export function getBackupUrl(projectId?: number | string): string {
  const base = `${API_BASE}/backup`;
  const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
  const url = projectId ? `${base}/project/${projectId}${token}` : `${base}/all${token}`;
  return url;
}
