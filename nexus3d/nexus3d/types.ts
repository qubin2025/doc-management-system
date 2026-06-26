
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'GROUP_LEADER' | 'COMPANY_LEADER';
export type ThemeType = 'dusk' | 'starlight' | 'dawn' | 'space' | 'moonlight';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
  createdAt: number;
}

export type RelationType = 
  | 'Work_Superior' 
  | 'Work_Subordinate' 
  | 'Work_Partner' 
  | 'Family_ParentChild' 
  | 'Family_Sibling' 
  | 'Family_Spouse' 
  | 'Friend' 
  | 'Other';

export interface Node {
  id: string;
  name: string;
  phone?: string;
  weight: number; // Controls node size (1-10)
  category: string;
  organization?: string;
  position?: string;
  title?: string;
  bio: string;
  createdBy: string;
  color?: string;
}

export interface Link {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  strength: number; // Controls line thickness (1-10)
  description?: string;
  createdBy: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: 'ADD_NODE' | 'DELETE_NODE' | 'UPDATE_NODE' | 'ADD_LINK' | 'DELETE_LINK' | 'UPDATE_LINK' | 'EXPORT_DATA' | 'IMPORT_DATA' | 'VERSION_UPDATE' | 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'USER_CREATE' | 'USER_DELETE';
  details: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}
