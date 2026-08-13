// 项目信息
export interface ProjectInfo {
  id?: number;               // v5.2: 后端项目 ID（用于 DELETE/PUT 操作）
  name: string;
  createdAt: string;
  details?: {
    overview?: string;       // 项目概况
    area?: string;           // 建筑面积
    scale?: string;          // 建设规模
    investment?: string;     // 投资额
    pipeline?: string;       // 市政管线
    aiReport?: string;       // AI分析报告
    aiReportTime?: string;   // 报告更新时间
    customFields?: { key: string; value: string }[]; // 自定义字段
    projectDocs?: { fileName: string; uploader: string; uploadTime: string; data: string }[]; // 项目概况文件
  };
}

// 工程资料类型
// 规程类型
export type StandardType = 'DB11/T695-2025' | 'DB11/T808-2020';

export interface DocumentItem {
  id: string;
  category: string;        // 类别 (A类/B类/C类/D类)
  subCategory: string;     // 子类别编号 (如A1, B-1, C1等)
  subCategoryName: string; // 子类别名称 (如决策立项文件)
  name: string;            // 工程资料名称
  tableCode: string;       // 表格编号
  standard: string;        // 规范依据
  archiveUnits: {
    construction: boolean; // 施工
    supervision: boolean;  // 监理
    constructionUnit: boolean; // 建设
    archive: boolean;      // 档案馆
  };
}

// 上传文件记录（单个文件）
export interface UploadInfo {
  fileName: string;        // 上传文件名
  uploadTime: string;     // 上传时间
  uploader: string;       // 上传人
  version: string;        // 版本号
  fileData?: string;      // Base64 文件数据
}

// 筛选条件
export interface FilterOptions {
  category: string;       // 资料类别
  archiveUnit: string;    // 归档保存单位
  searchKeyword: string;  // 搜索关键词
}

// 类别统计
export interface CategoryStats {
  total: number;
  uploaded: number;
  pending: number;
}

// 权限
export interface Permissions {
  can_upload: boolean;
  can_download: boolean;
  can_use_ai: boolean;
}

// 用户信息
export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

// 登录态
export interface AuthState {
  token: string;
  user: UserInfo;
  permissions: Permissions;
}

// AI 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ===== 全过程项目管理指南模块类型 =====

// 子任务（AI拆解生成）
export interface GuideSubTask {
  id: string;
  name: string;
  duration?: string;
  resource?: string;
  plannedDuration?: number;
  actualDuration?: number;
  swimlane?: string;         // 所属泳道/责任方
  checked: boolean;
  isCustom?: boolean;
}

// 工作项（可勾选）
export interface GuideWorkItem {
  id: string;
  name: string;
  checked: boolean;
  duration?: string;
  attachmentFormat?: string;
  isCustom?: boolean;
  completedAt?: string;
  plannedDate?: string;
  attachments?: { fileName: string; version: string; uploadTime: string; data?: string }[];
  subTasks?: GuideSubTask[];
  flowImage?: string;
  guideNotes?: string;  // 办理指南
}

// 子模块
export interface GuideSubModule {
  id: string;
  name: string;
  workItems: GuideWorkItem[];
}

// 逻辑关系连线 (workItemId → workItemId)
export interface GuideLink {
  from: string;       // 源工作项ID
  to: string;         // 目标工作项ID
  label?: string;     // 连线标签
  duration?: string;  // 用时
  startTime?: string; // 开始时间
  endTime?: string;   // 结束时间
  isCustom?: boolean;
  srcAnchor?: string; // 用户指定源锚点
  dstAnchor?: string; // 用户指定目标锚点
  waypoints?: { x: number; y: number }[]; // 自定义中间拐点
}

// 节点位置
export interface GuideNodePosition {
  itemId: string;
  x: number;
  y: number;
}

// 附表字段定义
export interface FormField {
  key: string;          // 字段标识
  label: string;        // 中文标签
  type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'table';
  placeholder?: string;
  options?: string[];   // select 类型的选项
  required?: boolean;
  layout?: 'single' | 'double'; // 单列/双列布局（默认单列）
  pairKey?: string;     // 双列时配对字段key（同行右侧字段）
}

// 附表模板（含字段结构）
export interface GuideForm {
  code: string;
  name: string;
  description?: string;
  fields?: FormField[];          // 模板字段结构
  sampleContent?: string;        // 示例内容（Markdown格式）
  aiPrompt?: string;             // AI填写提示词（可编辑）
  sampleFiles?: FormSampleFile[];   // 样本文件
  artifacts?: FormArtifact[];        // 成果文件（带版本号）
}

// 样本文件
export interface FormSampleFile {
  id: string;
  fileName: string;
  fileData: string;             // Base64
  uploadedAt: string;
  uploadedBy: string;
}

// 成果文件（自动版本号）
export interface FormArtifact {
  id: string;
  fileName: string;
  fileData: string;             // Base64
  version: number;              // 自动版本号
  uploadedAt: string;
  uploadedBy: string;
  note?: string;                // 版本备注
}

// 附表内容（持久化存储）
export interface FormContent {
  chapterId: string;            // 所属章节
  formCode: string;             // 表单编号
  content: string;              // 编辑内容（Markdown）
  filledByAi: boolean;          // 是否AI填写
  lastModified: string;         // 最后修改时间（ISO）
  version: number;              // 版本号
  aiPrompt?: string;            // 保存的AI提示词
}

// 附件的文件记录
export interface FormAttachment {
  fileName: string;
  fileData: string;             // Base64
  fileType: string;             // MIME type
  uploadTime: string;
  fileSize: number;
}

// ===== 目标管理体系 (P0-1) =====
export interface ProjectObjective {
  id: string;
  projectName: string;
  parentId: string | null;
  title: string;
  description: string;
  level: 'root' | 'phase' | 'deliverable' | 'work-item';
  weight: number;
  progress: number;
  status: 'not-started' | 'in-progress' | 'completed';
  linkedWorkItemIds: string[];
  children?: ProjectObjective[];
  createdAt: string;
  updatedAt: string;
}

// ===== 三大基线 (P0-4) =====
export interface Baseline {
  id: string;
  projectName: string;
  baselineType: 'scope' | 'schedule' | 'cost';
  version: number;
  snapshot: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

// ===== 知识加工产物索引 (P0-2) =====
export interface KnowledgeArtifact {
  id: string;
  projectName: string;
  artifactType: 'chunk' | 'summary' | 'graph' | 'category' | 'qa-pair';
  sourceType: 'document' | 'form' | 'work-item' | 'ai-generated';
  sourceId: string;
  content: string;
  metadata: string;
  vectorId: string | null;
  confidence: number;
  createdAt: string;
}

// ===== 操作审计 (P0-4) =====
export interface AuditLog {
  id: number;
  projectName: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'import';
  targetType: 'project' | 'objective' | 'baseline' | 'document' | 'work-item' | 'form' | 'configuration';
  targetId: string;
  detail: string;
  ipAddress: string;
  createdAt: string;
}

// 章节
export interface GuideChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;       // lucide icon name
  color: string;      // tailwind color
  subModules: GuideSubModule[];
  links: GuideLink[];  // 默认时序逻辑关系
  forms: GuideForm[];   // 附表清单
}

// ===== Agent智能体框架 (P1-1) =====
export interface AgentAction {
  name: string;
  description: string;
  category: 'query' | 'compute' | 'mutate' | 'knowledge' | 'system';
  handler: (params: Record<string, unknown>, context: AgentContext) => Promise<ActionResult>;
  requiresConfirmation?: boolean;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentContext {
  projectName: string;
  userId: string;
  conversationId: string;
  history: AgentStep[];
  memory: Map<string, unknown>;
}

export interface AgentStep {
  stepIndex: number;
  thought: string;
  actionName: string | null;
  actionParams: Record<string, unknown> | null;
  observation: string | null;
  completedAt: string | null;
  status: 'pending' | 'thinking' | 'executing' | 'completed' | 'failed';
}

export interface AgentTask {
  id: string;
  goal: string;
  steps: AgentStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';
  maxSteps: number;
  startedAt: string;
  completedAt?: string;
  result?: string;
}

// ===== Skill技能机制 (P1-2) =====
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'review' | 'generate' | 'fill' | 'guide' | 'analysis';
  icon: string;
  tags: string[];
  executor: (input: SkillInput, context: SkillContext) => Promise<SkillResult>;
  agentActionName?: string;
  uiComponent?: string;
}

export interface SkillInput {
  projectName: string;
  params: Record<string, unknown>;
  files?: File[];
  options?: { model?: string };
}

export interface SkillContext {
  projectName: string;
  userId: string;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  report?: string;
  suggestions?: string[];
  duration: number;
}

// ===== 工作流引擎 (P2-1) =====
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent-task' | 'skill' | 'mcp-tool' | 'condition' | 'wait' | 'parallel' | 'human-approval';
  agentGoal?: string;
  skillId?: string;
  toolName?: string;
  params?: Record<string, unknown>;
  timeout?: number;
  retryCount?: number;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  projectName: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  context: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

// ===== Multi-Agent 协作 (v5.0) =====
export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  expertise: string[];
  systemPrompt: string;
}

export interface AgentDispatchResult {
  profile: AgentProfile;
  score: number;
  reason: string;
}

export interface MultiAgentReport {
  goal: string;
  profile: AgentProfile;
  steps: AgentStep[];
  result: string;
  startedAt: string;
  completedAt?: string;
}
