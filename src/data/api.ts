import { ProjectInfo, UploadInfo, AuthState, UserInfo, Permissions, FormField } from '../types';

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
export async function register(username: string, password: string, displayName?: string, phone?: string, dept?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName, phone, dept }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '注册失败');
}

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
// 构建含图片的vision消息
function buildVisionMessages(messages: { role: string; content: string }[], systemPrompt: string, images: string[]): any[] {
  const result: any[] = [{ role: 'system', content: systemPrompt }];
  for (const msg of messages) {
    if (msg.role === 'user' && images.length > 0) {
      const content: any[] = [{ type: 'text', text: msg.content }];
      for (const img of images) content.push({ type: 'image_url', image_url: { url: img } });
      result.push({ role: 'user', content });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
}

// 视觉模型统一调用
async function callVisionModel(messages: { role: string; content: string }[], systemPrompt: string, model: 'glm-4v' | 'qwen-vl-max', images: string[]): Promise<string> {
  const key = model === 'glm-4v' ? import.meta.env.VITE_ZHIPU_API_KEY : import.meta.env.VITE_QWEN_API_KEY;
  if (!key) throw new Error('未配置Key');
  const endpoint = model === 'glm-4v' ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions' : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const m = model === 'glm-4v' ? 'glm-4v' : 'qwen-vl-max';
  const visionMsgs = images.length > 0 ? buildVisionMessages(messages, systemPrompt, images) : [{ role: 'system', content: systemPrompt }, ...messages.map(msg => ({ role: msg.role, content: msg.content }))];
  const r = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: m, messages: visionMsgs, temperature: 0.7, max_tokens: 2000 }),
  });
  if (!r.ok) throw new Error('视觉模型错误: ' + await r.text());
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

/** 后端代理视觉模型 — 绕过前端网络限制 */
export async function visionChat(imageBase64: string, prompt: string, model = 'auto'): Promise<string> {
  const res = await fetch(`${API_BASE}/ai/vision`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ image: imageBase64, prompt, model }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '视觉模型调用失败');
  }
  const d = await res.json();
  return d.reply || '';
}

/** 前端脱敏 — 与后端sanitize.js一致，确保直连API时也脱敏 */
function sanitizeForAI(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证号已脱敏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已脱敏]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, '[邮箱已脱敏]')
    .replace(/\b(?:\d{3}-\d{8}|\d{4}-\d{7,8}|\d{4}-\d{3}-\d{3})\b/g, '[固定电话已脱敏]')
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:万|亿|元|USD|CNY)\b/g, '[金额已脱敏]')
    .replace(/(?:北京市?|上海市?|广东省?|深圳市?|广州市?|成都市?|杭州市?)\S{0,20}(?:路|街|道|巷|号|楼|室|层|座|单元|栋|幢)\S{0,10}/g, '[地址已脱敏]')
    .replace(/\b[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}\b/g, '[统一信用代码已脱敏]');
}

export async function aiChat(
  messages: { role: string; content: string }[],
  context?: string,
  opts?: { projectName?: string; standard?: string; model?: string; images?: string[] }
): Promise<string> {
  const images = opts?.images || [];
  // 脱敏所有消息内容
  const sanitizedMessages = messages.map(m => ({ ...m, content: sanitizeForAI(m.content) }));
  const sanitizedContext = sanitizeForAI(context || '');

  // 有图片时跳过代理直连视觉模型（后端代理不支持多模态）
  if (images.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST', body: JSON.stringify({
          messages: sanitizedMessages,
          context: sanitizedContext,
          projectName: opts?.projectName || '',
          standard: opts?.standard || '',
          model: opts?.model || 'auto',
        }), headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.reply || data.message || JSON.stringify(data);
      }
    } catch {}
  }

  // 构建系统提示
  const systemPrompt = opts?.projectName
    ? `你是全过程工程咨询管理系统AI。当前项目：${sanitizeForAI(opts.projectName)}。${opts?.standard ? `规程：${opts.standard}。` : ''}`
    : '你是一个智能对话助手。';

  // 检测是否需要视觉模型
  const needVision = sanitizedMessages.some(m => m.content.includes('[图片:') || m.content.includes('图像识别'))
    || (opts?.images && opts.images.length > 0);
  const userModel = opts?.model || 'auto';

  if (needVision && userModel !== 'deepseek-v4-pro' && userModel !== 'deepseek-v4-flash') {
    if (userModel === 'glm-4v' || userModel === 'glm-4v') {
      try { return await callVisionModel(sanitizedMessages, systemPrompt, 'glm-4v', images); } catch {}
      try { return await callVisionModel(sanitizedMessages, systemPrompt, 'qwen-vl-max', images); } catch {}
      return '视觉模型调用失败';
    }
    if (userModel === 'qwen-vl-max') {
      try { return await callVisionModel(sanitizedMessages, systemPrompt, 'qwen-vl-max', images); } catch {}
      try { return await callVisionModel(sanitizedMessages, systemPrompt, 'glm-4v', images); } catch {}
      return '视觉模型调用失败';
    }
    try { return await callVisionModel(sanitizedMessages, systemPrompt, 'glm-4v', images); } catch {}
    try { return await callVisionModel(sanitizedMessages, systemPrompt, 'qwen-vl-max', images); } catch {}
    return '视觉模型均不可用。';
  }

  // 纯文本：DeepSeek（60秒超时）— 使用脱敏后的消息
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const baseUrl = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat';
  if (!apiKey) throw new Error('请配置 DeepSeek API Key');
  const chatMessages = [{ role: 'system', content: systemPrompt }, ...sanitizedMessages.map(m => ({ role: m.role, content: m.content }))];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: chatMessages, temperature: 0.7, max_tokens: 2000 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('DeepSeek API 错误: ' + await res.text());
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    return msg?.content || msg?.reasoning_content || '无回复';
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('请求超时（60秒），请重试');
    throw e;
  }
}

// ========== AI 表单填写 ==========
export async function aiFillForm(
  formCode: string,
  formName: string,
  fields: FormField[],
  projectContext?: { name?: string; details?: ProjectInfo['details'] },
  formatTemplate?: string,
): Promise<string> {
  const fieldList = fields.map(f => `- ${f.label} (${f.type}${f.required ? ', 必填' : ''})${f.options ? ` [可选值: ${f.options.join('/')}]` : ''}`).join('\n');
  const projectInfo = projectContext?.name
    ? `项目名称: ${sanitizeForAI(projectContext.name)}
建筑面积: ${sanitizeForAI(projectContext.details?.area || '未提供')}
建设规模: ${sanitizeForAI(projectContext.details?.scale || '未提供')}
投资额: ${sanitizeForAI(projectContext.details?.investment || '未提供')}
项目概况: ${sanitizeForAI(projectContext.details?.overview || '未提供')}
${projectContext.details?.aiReport ? `\n【审核分析数据】\n${sanitizeForAI(projectContext.details.aiReport)}` : ''}`
    : '无项目上下文';

  const templateSection = formatTemplate
    ? `\n【输出格式模板 — 必须严格遵循此格式输出】\n${formatTemplate}\n\n【重要】请严格按照上述模板的格式、标题层级、分段结构、签章位置、表格样式输出，字段值填入模板中对应的占位符位置，不要改变模板的任何格式结构。\n`
    : '';

  const prompt = `你是全过程工程咨询管理系统的AI助手。请根据以下信息填写工程附表。

【表单信息】
编号: ${formCode}
名称: ${formName}

【表单字段】
${fieldList}

【项目上下文】
${projectInfo}
${templateSection}
【填写要求】
1. ${formatTemplate ? '严格遵循上述【输出格式模板】的格式结构，将字段值填入模板对应位置' : '以Markdown表格格式输出，表头为各字段标签'}
2. 对于数字类型字段，给出合理估算值（单位请注明）
3. 对于日期字段，使用 YYYY-MM-DD 格式给出建议日期
4. 对于select类型字段，从可选值中选择最合适的
5. 填写1-3行示例数据
6. 在表格下方用 --- 分隔，然后列出"填写说明"（简要说明各字段填写的依据和建议）

只输出${formatTemplate ? '格式模板填充后的完整内容' : '表格和填写说明'}，不要其他解释。`;

  // 优先尝试后端
  try {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], context: 'form-fill' }), headers: headers(),
    });
    if (res.ok) { const d = await res.json(); return d.reply || d.message || ''; }
  } catch {}

  // 回退：直接调 DeepSeek
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const baseUrl = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat';
  if (!apiKey) throw new Error('请配置 DeepSeek API Key');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2000 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('DeepSeek API 错误');
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('AI填写超时（60秒），请重试');
    throw e;
  }
}

// ========== AI 向量化 & 语义检索 ==========

/** 文本向量化 — 优先后端代理(安全)，回退直接调用 */
export async function embedText(text: string, textType: 'document' | 'query' = 'document'): Promise<number[]> {
  // 优先走后端
  try {
    const res = await fetch(`${API_BASE}/ai/embed`, {
      method: 'POST', body: JSON.stringify({ text, textType }), headers: headers(),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) { const d = await res.json(); if (d.embedding) return d.embedding; }
  } catch {}

  // 回退: 直接用 DashScope（需Key在.env中）
  const apiKey = import.meta.env.VITE_QWEN_API_KEY;
  if (!apiKey) throw new Error('Embedding服务不可用：后端未配置且前端无Key');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'text-embedding-v1', input: { texts: [text] }, parameters: { text_type: textType } }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('Embedding API 错误');
    const data = await res.json();
    const embedding = data.output?.embeddings?.[0]?.embedding;
    if (!embedding) throw new Error('Embedding 返回格式异常');
    return embedding;
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

/** 批量向量化 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
}

// ========== 备份 ==========
export function getBackupUrl(projectId?: number | string): string {
  const base = `${API_BASE}/backup`;
  const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
  const url = projectId ? `${base}/project/${projectId}${token}` : `${base}/all${token}`;
  return url;
}

// ========== 知识图谱 ==========
export async function fetchKnowledgeGraph(type?: string): Promise<{ available: boolean; nodes: any[]; edges: any[]; updatedAt: string }> {
  try {
    const qs = type && type !== 'all' ? `?type=${encodeURIComponent(type)}` : '';
    const res = await fetch(`${API_BASE}/kg${qs}`, { headers: headers() });
    if (!res.ok) throw new Error('KG fetch failed');
    return await res.json();
  } catch {
    return { available: false, nodes: [], edges: [], updatedAt: '' };
  }
}

export async function syncKnowledgeGraph(nodes: any[], edges: any[]): Promise<void> {
  try {
    await fetch(`${API_BASE}/kg/sync`, {
      method: 'POST', body: JSON.stringify({ nodes, edges }), headers: headers(),
    });
  } catch {}
}

// ========== LightRAG 微服务（方案B） ==========
const LIGHTRAG_BASE = import.meta.env.VITE_LIGHTRAG_URL || 'http://localhost:8000/api/lightrag';

export async function lightragHealth(): Promise<{ status: string; total_docs: number }> {
  const res = await fetch(`${LIGHTRAG_BASE}/health`);
  return res.json();
}

export async function lightragIndex(file: File, project?: string): Promise<{ doc_id: string; chunks: number; entities: any }> {
  const form = new FormData();
  form.append('file', file);
  if (project) form.append('project', project);
  const res = await fetch(`${LIGHTRAG_BASE}/index`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('索引失败');
  return res.json();
}

export async function lightragSearch(query: string, topK = 5, mode = 'hybrid'): Promise<{ results: any[]; total: number }> {
  const res = await fetch(`${LIGHTRAG_BASE}/search`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK, mode }),
  });
  if (!res.ok) throw new Error('搜索失败');
  return res.json();
}

export async function lightragGraph(): Promise<{ nodes: any[]; edges: any[] }> {
  const res = await fetch(`${LIGHTRAG_BASE}/graph`);
  return res.json();
}

// ========== RAGFlow 知识库引擎 ==========

/** 检查 RAGFlow 可用性 */
export async function ragflowHealth(): Promise<{ available: boolean; version?: string }> {
  const res = await fetch(`${API_BASE}/ragflow/health`, { headers: headers() });
  return res.json();
}

/** 创建知识库 */
export async function ragflowCreateDataset(name: string, desc = '') {
  const res = await fetch(`${API_BASE}/ragflow/datasets`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ name, description: desc }),
  });
  return res.json();
}

/** 列出知识库 */
export async function ragflowListDatasets() {
  const res = await fetch(`${API_BASE}/ragflow/datasets`, { headers: headers() });
  return res.json();
}

/** 上传文档到知识库 */
export async function ragflowUploadDocument(datasetId: string, file: File, projectName?: string) {
  const form = new FormData();
  form.append('file', file);
  if (projectName) form.append('project', projectName);
  const res = await fetch(`${API_BASE}/ragflow/datasets/${datasetId}/documents`, {
    method: 'POST',
    headers: { Authorization: headers()['Authorization'] || '' },
    body: form,
  });
  return res.json();
}

/** RAG检索 */
export async function ragflowRetrieval(query: string, datasetIds: string[], topK = 10) {
  const res = await fetch(`${API_BASE}/ragflow/retrieval`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ question: query, dataset_ids: datasetIds, top_k: topK }),
  });
  return res.json();
}

/** 知识库对话 */
export async function ragflowChat(datasetIds: string[], query: string) {
  const res = await fetch(`${API_BASE}/ragflow/chats`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ dataset_ids: datasetIds, question: query }),
  });
  return res.json();
}

// ========== 数据同步 (持久化修复) ==========

export async function syncProjectData(_projectName: string, payload: { projectName: string; data: Record<string, any[]> }) {
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('同步失败');
  return res.json();
}

export async function fetchProjectConfig(projectName: string) {
  const res = await fetch(`${API_BASE}/sync/${encodeURIComponent(projectName)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('获取配置失败');
  return res.json();
}

// ========== 目标管理体系 (P0-1) ==========

export async function fetchObjectives(projectName: string) {
  const res = await fetch(`${API_BASE}/objectives?project=${encodeURIComponent(projectName)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('获取目标失败');
  return res.json();
}

export async function createObjective(data: {
  projectName: string;
  parentId?: string | null;
  title: string;
  description?: string;
  level: string;
  weight?: number;
  linkedWorkItemIds?: string[];
}) {
  const res = await fetch(`${API_BASE}/objectives`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('创建目标失败');
  return res.json();
}

export async function updateObjective(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/objectives/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('更新目标失败');
  return res.json();
}

export async function deleteObjective(id: string) {
  const res = await fetch(`${API_BASE}/objectives/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: headers(),
  });
  if (!res.ok) throw new Error('删除目标失败');
  return res.json();
}

export async function linkWorkItem(objectiveId: string, workItemId: string) {
  const res = await fetch(`${API_BASE}/objectives/${encodeURIComponent(objectiveId)}/link`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ workItemId }),
  });
  if (!res.ok) throw new Error('关联工作项失败');
  return res.json();
}

export async function unlinkWorkItem(objectiveId: string, workItemId: string) {
  const res = await fetch(`${API_BASE}/objectives/${encodeURIComponent(objectiveId)}/link/${encodeURIComponent(workItemId)}`, {
    method: 'DELETE', headers: headers(),
  });
  if (!res.ok) throw new Error('取消关联失败');
  return res.json();
}
