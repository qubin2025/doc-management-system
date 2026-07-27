// 手机端消息通知系统 — 全局项目看板消息徽章数据源

export interface MobileNotification {
  id: string;
  projectName: string;       // 关联项目（空字符串 = 全局消息）
  type: 'alert' | 'requirement' | 'warning';
  message: string;           // 消息正文（≤200字）
  fromUser: string;          // 发送者
  timestamp: string;         // ISO 时间戳
  read: boolean;
  readAt?: string;
}

const STORAGE_KEY = 'mobile-notifications';
const MAX_HISTORY = 50;
const RETENTION_DAYS = 7;

function loadAll(): MobileNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAll(list: MobileNotification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

/** 清理7天前已读消息 */
function prune(): void {
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  const list = loadAll().filter(n => !n.read || new Date(n.timestamp).getTime() > cutoff);
  saveAll(list);
}

/** 发送一条通知 */
export function sendNotification(
  projectName: string,
  type: MobileNotification['type'],
  message: string,
  fromUser: string
): MobileNotification {
  const n: MobileNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectName,
    type,
    message: message.slice(0, 200),
    fromUser,
    timestamp: new Date().toISOString(),
    read: false,
  };
  const list = loadAll();
  list.unshift(n);
  saveAll(list);
  prune();
  return n;
}

/** 获取所有通知（最新优先） */
export function getAllNotifications(): MobileNotification[] {
  prune();
  return loadAll();
}

/** 获取某项目的未读通知数 */
export function getUnreadCount(projectName?: string): number {
  const list = loadAll();
  if (projectName) {
    return list.filter(n => n.projectName === projectName && !n.read).length;
  }
  return list.filter(n => !n.read).length;
}

/** 获取某项目的通知列表 */
export function getProjectNotifications(projectName: string): MobileNotification[] {
  return loadAll().filter(n => n.projectName === projectName);
}

/** 标记单条已读 */
export function markRead(id: string): void {
  const list = loadAll();
  const n = list.find(x => x.id === id);
  if (n) { n.read = true; n.readAt = new Date().toISOString(); }
  saveAll(list);
}

/** 标记某项目全部已读 */
export function markProjectRead(projectName: string): void {
  const list = loadAll();
  list.forEach(n => { if (n.projectName === projectName && !n.read) { n.read = true; n.readAt = new Date().toISOString(); } });
  saveAll(list);
}

/** 标记全部已读 */
export function markAllRead(): void {
  const list = loadAll();
  list.forEach(n => { if (!n.read) { n.read = true; n.readAt = new Date().toISOString(); } });
  saveAll(list);
}

/** 删除单条 */
export function deleteNotification(id: string): void {
  saveAll(loadAll().filter(n => n.id !== id));
}

/** 清空某项目通知 */
export function clearProjectNotifications(projectName: string): void {
  saveAll(loadAll().filter(n => n.projectName !== projectName));
}
