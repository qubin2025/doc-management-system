// 项目信息
export interface ProjectInfo {
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
  duration?: string;          // AI预计用时（如"2天"）
  resource?: string;          // 所需资源/负责人
  plannedDuration?: number;   // 计划用时（天）
  actualDuration?: number;    // 实际用时（天）
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
  flowImage?: string;  // 流程图base64(data URI)
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
}

// 附表内容（持久化存储）
export interface FormContent {
  chapterId: string;            // 所属章节
  formCode: string;             // 表单编号
  content: string;              // 编辑内容（Markdown）
  filledByAi: boolean;          // 是否AI填写
  lastModified: string;         // 最后修改时间（ISO）
  version: number;              // 版本号
}

// 附件的文件记录
export interface FormAttachment {
  fileName: string;
  fileData: string;             // Base64
  fileType: string;             // MIME type
  uploadTime: string;
  fileSize: number;
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
