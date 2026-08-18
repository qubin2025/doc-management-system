/**
 * IndexedDB 向量存储适配层 — localStorage→IndexedDB迁移
 * 功能: 768维向量存储 + 200MB软上限 + LRU淘汰 + 项目级清理 + 容量监控
 */
import type { VectorDoc } from './vectorStore';

const DB_NAME = 'doc-mgmt-vectors';
const DB_VERSION = 1;
const STORE_NAME = 'vectors';
const LRU_THRESHOLD = 0.85; // 使用率达到85%时触发LRU淘汰

interface StoredVector {
  id: string;
  project: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
  lastAccessed: number; // 毫秒时间戳，用于LRU
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    // 兼容性：jsdom/Node 环境下 indexedDB 可能未定义
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('project', 'project', { unique: false });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('[IndexedDB] Blocked — close other tabs');
  });
  return dbPromise;
}

/** 估算当前存储大小（MB） */
export async function estimateSize(): Promise<number> {
  if (!('storage' in navigator)) return 0;
  try {
    const estimate = await navigator.storage.estimate();
    return +(estimate.usage! / 1024 / 1024).toFixed(1);
  } catch { return 0; }
}

/** 检查是否接近配额 */
export async function isNearQuota(): Promise<boolean> {
  if (!('storage' in navigator)) return false;
  try {
    const est = await navigator.storage.estimate();
    if (!est.quota || !est.usage) return false;
    return est.usage / est.quota > LRU_THRESHOLD;
  } catch { return false; }
}

/** 获取存储统计 */
export async function getStoreStats(project?: string): Promise<{
  count: number;
  sizeKB: number;
  nearQuota: boolean;
  lruAge: number | null;
}> {
  const db = await openDB();
  let count = 0;
  let lruAge: number | null = null;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = project ? store.index('project').openCursor(IDBKeyRange.only(project)) : store.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        count++;
        const r = c.value as StoredVector;
        if (lruAge === null || r.lastAccessed < lruAge) lruAge = r.lastAccessed;
        c.continue();
      } else resolve();
    };
    req.onerror = () => resolve();
  });

  return { count, sizeKB: await estimateSize() * 1024, nearQuota: await isNearQuota(), lruAge };
}

/** 添加文档 */
export async function addDocument(doc: VectorDoc, project: string): Promise<number> {
  const db = await openDB();

  // LRU淘汰检查
  if (await isNearQuota()) {
    await evictLRU(50); // 淘汰最旧的50条
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const stored: StoredVector = {
      id: doc.id,
      project,
      text: doc.text,
      embedding: doc.embedding,
      metadata: doc.metadata || {},
      lastAccessed: Date.now(),
    };
    const req = store.put(stored);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/** 按项目搜索（余弦相似度） */
export async function searchByProject(
  queryEmbedding: number[],
  project: string,
  topK = 5
): Promise<Array<VectorDoc & { score: number }>> {
  const db = await openDB();
  const items: StoredVector[] = [];

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('project');
    const req = idx.openCursor(IDBKeyRange.only(project));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { items.push(c.value as StoredVector); c.continue(); }
      else resolve();
    };
    req.onerror = () => resolve();
  });

  // 更新访问时间（异步，不阻塞返回）
  updateAccessTime(items.map(i => i.id));

  // 余弦相似度计算 + 排序
  const scored = items.map(item => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** 跨项目搜索 */
export async function searchAll(
  queryEmbedding: number[],
  topK = 5
): Promise<Array<VectorDoc & { score: number; project: string }>> {
  const db = await openDB();
  const items: StoredVector[] = [];

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { items.push(c.value as StoredVector); c.continue(); }
      else resolve();
    };
    req.onerror = () => resolve();
  });

  updateAccessTime(items.map(i => i.id));

  const scored = items.map(item => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding),
    project: item.project,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** 删除单条文档 */
export async function removeDocument(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
  });
}

/** 按项目清除所有向量 */
export async function clearProject(project: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('project');
    const req = idx.openCursor(IDBKeyRange.only(project));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { c.delete(); c.continue(); }
      else resolve();
    };
  });
}

/** 清除全部 */
export async function clearAll(): Promise<void> {
  let db: IDBDatabase;
  try { db = await openDB(); } catch { return; }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
  });
}

/** LRU淘汰 — 删除最旧的N条记录 */
export async function evictLRU(n = 50): Promise<number> {
  const db = await openDB();
  const items: StoredVector[] = [];

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { items.push(c.value as StoredVector); c.continue(); }
      else resolve();
    };
    req.onerror = () => resolve();
  });

  items.sort((a, b) => a.lastAccessed - b.lastAccessed);
  const toRemove = items.slice(0, Math.min(n, items.length));

  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const item of toRemove) tx.objectStore(STORE_NAME).delete(item.id);
  await new Promise(r => { tx.oncomplete = r; });

  console.log(`[IndexedDB] LRU evicted ${toRemove.length} docs`);
  return toRemove.length;
}

/** 导出全部向量数据（用于备份） */
export async function exportAllVectors(): Promise<{ vectors: VectorDoc[]; exportedAt: string }> {
  const db = await openDB();
  const items: StoredVector[] = [];
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { items.push(c.value as StoredVector); c.continue(); }
      else resolve();
    };
    req.onerror = () => resolve();
  });
  return {
    vectors: items.map(i => ({ id: i.id, text: i.text, embedding: i.embedding, metadata: { ...i.metadata, projectName: i.project } as any })),
    exportedAt: new Date().toISOString(),
  };
}

/** 从备份导入向量 */
export async function importVectors(vectors: VectorDoc[]): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const v of vectors) {
    store.put({
      id: v.id,
      project: (v.metadata as any)?.project || v.metadata?.projectName || 'imported',
      text: v.text,
      embedding: v.embedding,
      metadata: v.metadata || {},
      lastAccessed: Date.now(),
    });
  }
  await new Promise(r => { tx.oncomplete = r; });
  return vectors.length;
}

/** 获取所有项目名列表 */
export async function getProjects(): Promise<string[]> {
  const db = await openDB();
  const projects = new Set<string>();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { projects.add((c.value as StoredVector).project); c.continue(); }
      else resolve();
    };
  });
  return Array.from(projects);
}

/** 获取所有文档 */
export async function getAllDocs(): Promise<VectorDoc[]> {
  const db = await openDB();
  const items: StoredVector[] = [];
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { items.push(c.value as StoredVector); c.continue(); }
      else resolve();
    };
  });
  return items.map(i => ({ id: i.id, text: i.text, embedding: i.embedding, metadata: { ...i.metadata, projectName: i.project } as any }));
}

// ===== 工具函数 =====

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

async function updateAccessTime(ids: string[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const now = Date.now();
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          const v = req.result as StoredVector;
          v.lastAccessed = now;
          store.put(v);
        }
      };
    }
  } catch { /* 访问时间更新失败不影响检索 */ }
}
