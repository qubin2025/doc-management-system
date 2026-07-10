/**
 * IndexedDB 图片存储 — 替代 localStorage 存储 base64 流程图/附件
 * 解决 localStorage 5MB 配额限制
 */
const DB_NAME = 'doc-mgmt-images';
const DB_VERSION = 1;
const STORE = 'flowImages';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 存储图片（base64 data URI） */
export async function putImage(id: string, dataUrl: string): Promise<void> {
  if (!dataUrl || dataUrl.length < 100) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, id);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  } catch { /* IndexedDB 不可用，降级到 localStorage */ }
}

/** 读取图片 */
export async function getImage(id: string): Promise<string> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => { db.close(); resolve(req.result || ''); };
      req.onerror = () => { db.close(); resolve(''); };
    });
  } catch { return ''; }
}

/** 删除图片 */
export async function deleteImage(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    db.close();
  } catch {}
}

/** 批量提取并存储所有 flowImage，返回替换后的对象 */
export async function extractFlowImages(subModules: any[]): Promise<any[]> {
  const result = [];
  for (const sm of subModules) {
    const items = [];
    for (const wi of sm.workItems || []) {
      if (wi.flowImage && wi.flowImage.startsWith('data:image/') && wi.flowImage.length > 200) {
        await putImage(`flow-${wi.id}`, wi.flowImage);
        items.push({ ...wi, flowImage: `__idb__flow-${wi.id}` });
      } else {
        items.push(wi);
      }
    }
    result.push({ ...sm, workItems: items });
  }
  return result;
}

/** 批量从 IndexedDB 恢复 flowImage */
export async function restoreFlowImages(subModules: any[]): Promise<any[]> {
  const result = [];
  for (const sm of subModules) {
    const items = [];
    for (const wi of sm.workItems || []) {
      if (wi.flowImage && typeof wi.flowImage === 'string' && wi.flowImage.startsWith('__idb__')) {
        const real = await getImage(wi.flowImage);
        items.push({ ...wi, flowImage: real || '' });
      } else {
        items.push(wi);
      }
    }
    result.push({ ...sm, workItems: items });
  }
  return result;
}
