// 项目信息
export interface ProjectInfo {
  name: string;
  createdAt: string;
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
