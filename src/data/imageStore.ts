/**
 * IndexedDB 图片存储 — 辅助 localStorage，不替代 state
 * 仅在 localStorage 配额不足时使用
 */
const DB = 'doc-mgmt-images', STORE = 'flowImages', VER = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function putImage(id: string, dataUrl: string): Promise<void> {
  if (!dataUrl || dataUrl.length < 100) return;
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(dataUrl, id);
    db.close();
  } catch {}
}

export async function getImage(id: string): Promise<string> {
  try {
    const db = await openDB();
    const data = await new Promise<string>((resolve) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      r.onsuccess = () => resolve(r.result || '');
      r.onerror = () => resolve('');
    });
    db.close();
    return data;
  } catch { return ''; }
}

export async function deleteImage(id: string): Promise<void> {
  try { const db = await openDB(); db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); db.close(); } catch {}
}

/** 保存：先尝试完整存储，超额时将 flowImage 迁至 IndexedDB */
export async function saveModules(subModules: any[], key: string): Promise<void> {
  // 备份所有 flowImage 到 IndexedDB（静默，失败忽略）
  for (const sm of subModules) {
    for (const wi of sm.workItems || []) {
      if (wi.flowImage && wi.flowImage.startsWith('data:image/') && wi.flowImage.length > 200) {
        putImage(`flow-${wi.id}`, wi.flowImage);
      }
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(subModules));
  } catch {
    // 超额：替换 flowImage 为引用
    const slim = subModules.map(sm => ({
      ...sm, workItems: (sm.workItems||[]).map((wi: any) =>
        wi.flowImage && wi.flowImage.startsWith('data:image/')
          ? { ...wi, flowImage: `__idb__flow-${wi.id}` } : wi)
    }));
    localStorage.setItem(key, JSON.stringify(slim));
  }
}

/** 加载：从 localStorage 读取，如有 __idb__ 引用则从 IndexedDB 恢复 */
export async function loadModules(key: string): Promise<any[] | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const result = [];
  for (const sm of parsed) {
    const items = [];
    for (const wi of sm.workItems || []) {
      if (typeof wi.flowImage === 'string' && wi.flowImage.startsWith('__idb__')) {
        items.push({ ...wi, flowImage: await getImage(wi.flowImage) });
      } else {
        items.push(wi);
      }
    }
    result.push({ ...sm, workItems: items });
  }
  return result;
}
