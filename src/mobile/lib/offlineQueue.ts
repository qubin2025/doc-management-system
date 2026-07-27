// 移动端离线上传队列 — IndexedDB 暂存 + 网络恢复自动上传
const DB_NAME = 'mobile-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';

interface QueuedItem {
  id?: number;
  blob: Blob;
  fileName: string;
  projectId: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  poi?: string;
  address?: string;
  watermarkData?: string;
  status: 'pending' | 'uploading' | 'failed';
  createdAt: number;
  retries: number;
  lastError?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 将待上传项加入离线队列 */
export async function enqueueUpload(blob: Blob, fileName: string, meta: {
  projectId: number; location?: string; latitude?: number | null;
  longitude?: number | null; poi?: string; address?: string;
  watermarkData?: Record<string, unknown>;
}): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add({
      blob, fileName,
      projectId: meta.projectId, location: meta.location || '',
      latitude: meta.latitude ?? null, longitude: meta.longitude ?? null,
      poi: meta.poi || '', address: meta.address || '',
      watermarkData: meta.watermarkData ? JSON.stringify(meta.watermarkData) : undefined,
      status: 'pending', createdAt: Date.now(), retries: 0,
    });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** 获取队列中所有待处理项 */
export async function getQueue(): Promise<QueuedItem[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    tx.oncomplete = () => db.close();
  });
}

/** 获取队列计数 */
export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    tx.oncomplete = () => db.close();
  });
}

/** 删除已完成的队列项 */
export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

/** 标记上传失败 */
export async function markFailed(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.status = 'failed';
        item.retries = (item.retries || 0) + 1;
        item.lastError = error;
        store.put(item);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

/** 清除失败超过3次的项目 */
export async function clearStale(): Promise<void> {
  const db = await openDB();
  const items = await getQueue();
  for (const item of items) {
    if (item.retries >= 3 && item.id) {
      await removeFromQueue(item.id);
    }
  }
  db.close();
}

/** 检测网络状态 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/** 监听网络恢复 */
export function onReconnect(callback: () => void): () => void {
  const handler = () => { if (navigator.onLine) callback(); };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
