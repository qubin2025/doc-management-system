// 本地向量存储 — 项目维度索引、768维向量、余弦相似度、localStorage持久化

export interface VectorDoc {
  id: string;
  text: string;
  embedding: number[];
  metadata?: {
    projectName?: string;
    fileName?: string;
    fileType?: string;
    formCode?: string;
    uploadTime?: string;
    chunkIndex?: number;
    chunkCount?: number;
    sensitivity?: number;  // v5.7 迭代4: 敏感等级 0=公开 1=内部 2=机密
  };
}

interface StoreData {
  version: number;
  updatedAt: string;
  vectors: VectorDoc[];
}

const STORE_PREFIX = 'vector-store-';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class LocalVectorStore {
  private vectors: Map<string, VectorDoc[]> = new Map(); // project → docs

  constructor() { this.loadAll(); }

  private key(project: string): string {
    return STORE_PREFIX + (project || 'default');
  }

  private loadProject(project: string): VectorDoc[] {
    try {
      const raw = localStorage.getItem(this.key(project));
      if (!raw) return [];
      const data: StoreData = JSON.parse(raw);
      if (!data.vectors) return [];
      return data.vectors;
    } catch { return []; }
  }

  private loadAll(): void {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX)) {
        const docs = this.loadProject(k.replace(STORE_PREFIX, ''));
        this.vectors.set(k.replace(STORE_PREFIX, ''), docs);
      }
    }
  }

  private saveProject(project: string): void {
    const docs = this.vectors.get(project) || [];
    const data: StoreData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      vectors: docs,
    };
    try {
      localStorage.setItem(this.key(project), JSON.stringify(data));
    } catch (e) {
      console.warn('[VectorStore] localStorage full, clearing oldest project');
      this.clearOldest();
      try { localStorage.setItem(this.key(project), JSON.stringify(data)); } catch {}
    }
  }

  private clearOldest(): void {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(k) || '{}');
          const t = new Date(data.updatedAt || 0).getTime();
          if (t < oldestTime) { oldestTime = t; oldestKey = k; }
        } catch {}
      }
    }
    if (oldestKey) localStorage.removeItem(oldestKey);
  }

  // ---- public API ----

  /** 添加文档（自动分块），返回添加的文档数 */
  add(doc: VectorDoc): number {
    const project = doc.metadata?.projectName || 'default';
    if (!this.vectors.has(project)) this.vectors.set(project, []);
    this.vectors.get(project)!.push(doc);
    this.saveProject(project);
    return 1;
  }

  /** 索引文档文本（单文档→单向量，精确语义检索） */
  addDocument(text: string, embedding: number[], metadata: VectorDoc['metadata']): number {
    const project = metadata?.projectName || 'default';
    if (!this.vectors.has(project)) this.vectors.set(project, []);
    const docs = this.vectors.get(project)!;
    docs.push({
      id: `${metadata?.fileName || 'doc'}_${Date.now()}`,
      text: text.slice(0, 8000), // 截断到8000字符(Embedding API限制)
      embedding,
      metadata,
    });
    this.saveProject(project);
    return docs.length;
  }

  /** 语义搜索 — 返回 Top-K 最相似文档 */
  search(queryEmbedding: number[], project: string, topK = 5): VectorDoc[] {
    const docs = this.vectors.get(project) || [];
    if (docs.length === 0) return [];
    const scored = docs.map(d => ({ doc: d, score: cosineSimilarity(queryEmbedding, d.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.doc);
  }

  /** v5.7 迭代4: 按 sensitivity 过滤搜索 — 仅返回用户有权访问的敏感等级数据
   * @param maxSensitivity 用户可访问的最高敏感等级（0=公开,1=内部,2=机密）
   */
  searchWithSensitivity(queryEmbedding: number[], project: string, topK = 5, maxSensitivity = 2): VectorDoc[] {
    const docs = this.vectors.get(project) || [];
    if (docs.length === 0) return [];
    // 过滤：仅返回 sensitivity <= maxSensitivity 的文档
    const filtered = docs.filter(d => (d.metadata?.sensitivity ?? 0) <= maxSensitivity);
    if (filtered.length === 0) return [];
    const scored = filtered.map(d => ({ doc: d, score: cosineSimilarity(queryEmbedding, d.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.doc);
  }

  /** 全项目搜索 — 不限定项目 */
  searchAll(queryEmbedding: number[], topK = 5): VectorDoc[] {
    const allDocs: VectorDoc[] = [];
    this.vectors.forEach(docs => allDocs.push(...docs));
    if (allDocs.length === 0) return [];
    const scored = allDocs.map(d => ({ doc: d, score: cosineSimilarity(queryEmbedding, d.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.doc);
  }

  /** 获取项目统计 */
  stats(project: string): { count: number; sizeKB: number } {
    const docs = this.vectors.get(project) || [];
    const raw = localStorage.getItem(this.key(project)) || '';
    return { count: docs.length, sizeKB: Math.round(raw.length / 1024) };
  }

  /** 所有项目 */
  projects(): string[] {
    return Array.from(this.vectors.keys());
  }

  /** 删除文档 */
  remove(id: string, project?: string): void {
    if (project && this.vectors.has(project)) {
      const docs = this.vectors.get(project)!;
      this.vectors.set(project, docs.filter(d => d.id !== id));
      this.saveProject(project);
    } else {
      this.vectors.forEach((docs, proj) => {
        this.vectors.set(proj, docs.filter(d => d.id !== id));
        this.saveProject(proj);
      });
    }
  }

  /** 获取指定项目的全部文档（按项目隔离读取） */
  getByProject(project: string): VectorDoc[] {
    return this.vectors.get(project) || [];
  }

  /** 按 ID 前缀批量删除（用于知识库同步去重，一次保存避免性能瓶颈） */
  removeByPrefix(prefix: string, project: string): number {
    if (!this.vectors.has(project)) return 0;
    const docs = this.vectors.get(project)!;
    const before = docs.length;
    const filtered = docs.filter(d => !d.id.startsWith(prefix));
    const removed = before - filtered.length;
    if (removed > 0) {
      this.vectors.set(project, filtered);
      this.saveProject(project);
    }
    return removed;
  }

  /** 批量添加文档（一次保存，避免多次 saveProject） */
  addDocuments(docs: VectorDoc[]): number {
    if (docs.length === 0) return 0;
    const project = docs[0].metadata?.projectName || 'default';
    if (!this.vectors.has(project)) this.vectors.set(project, []);
    const existing = this.vectors.get(project)!;
    for (const d of docs) existing.push(d);
    this.saveProject(project);
    return docs.length;
  }

  /** 清空项目 */
  clearProject(project: string): void {
    this.vectors.delete(project);
    localStorage.removeItem(this.key(project));
  }

  /** 清空全部 */
  /** 获取所有文档 */
  getAllDocs(): VectorDoc[] {
    const all: VectorDoc[] = [];
    this.vectors.forEach(docs => all.push(...docs));
    return all;
  }

  clearAll(): void {
    this.vectors.clear();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX)) localStorage.removeItem(k);
    }
  }
}

// ===== IndexedDB 异步层（容量治理+LRU+备份） =====
import * as idb from './indexedDBStore';

let idbAvailable = false;
let migrated = false;

/** 检查IndexedDB是否可用，自动迁移 */
async function ensureIDB(): Promise<boolean> {
  if (idbAvailable) return true;
  try {
    await idb.estimateSize(); // probe IndexedDB
    idbAvailable = true;
    if (!migrated) await migrateFromLocalStorage();
    return true;
  } catch {
    idbAvailable = false;
    return false;
  }
}

/** 一次性从localStorage迁移到IndexedDB */
async function migrateFromLocalStorage(): Promise<void> {
  const store = new LocalVectorStore();
  const allDocs = store.getAllDocs();
  if (allDocs.length === 0) { migrated = true; return; }
  let count = 0;
  for (const doc of allDocs) {
    try { await idb.addDocument(doc, doc.metadata?.projectName || 'default'); count++; } catch {}
  }
  console.log(`[VectorStore] Migrated ${count}/${allDocs.length} docs from localStorage to IndexedDB`);
  migrated = true;
}

/** IndexedDB异步版本的向量存储（包装现有接口） */
export const vectorStore = {
  // ===== 现有同步方法（localStorage，向后兼容） =====
  _store: new LocalVectorStore(),
  add(doc: VectorDoc): number { return this._store.add(doc); },
  addDocument(text: string, embedding: number[], metadata: VectorDoc['metadata']): number {
    const result = this._store.addDocument(text, embedding, metadata);
    // 异步写入IndexedDB
    ensureIDB().then(ok => {
      if (ok) {
        const id = `v-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
        idb.addDocument({ id, text, embedding, metadata: metadata as any }, (metadata as any)?.projectName || 'default').catch(() => {});
      }
    });
    return result;
  },
  search(queryEmbedding: number[], project: string, topK?: number): any[] {
    return this._store.search(queryEmbedding, project, topK);
  },
  // v5.7 迭代4: 按 sensitivity 过滤搜索
  searchWithSensitivity(queryEmbedding: number[], project: string, topK?: number, maxSensitivity?: number): any[] {
    return this._store.searchWithSensitivity(queryEmbedding, project, topK, maxSensitivity);
  },
  searchAll(queryEmbedding: number[], topK?: number): any[] {
    return this._store.searchAll(queryEmbedding, topK);
  },
  stats(project?: string): any { return this._store.stats(project || 'default'); },
  projects(): string[] { return this._store.projects(); },
  remove(id: string, project?: string): void { this._store.remove(id, project); },
  getByProject(project: string): any[] { return this._store.getByProject(project); },
  removeByPrefix(prefix: string, project: string): number {
    const removed = this._store.removeByPrefix(prefix, project);
    // IndexedDB 暂不同步删除（按前缀删除 IndexedDB 留待后续优化）
    // 残留旧数据不影响 localStorage 检索与 getAllDocs 显示，仅影响 searchAsync
    return removed;
  },
  addDocuments(docs: any[]): number {
    const n = this._store.addDocuments(docs);
    ensureIDB().then(ok => {
      if (ok && n > 0) {
        const project = docs[0]?.metadata?.projectName || 'default';
        for (const d of docs) {
          idb.addDocument(d, project).catch(() => {});
        }
      }
    });
    return n;
  },
  clearProject(project: string): void {
    this._store.clearProject(project);
    ensureIDB().then(ok => { if (ok) idb.clearProject(project); });
  },
  clearAll(): void {
    this._store.clearAll();
    ensureIDB().then(ok => { if (ok) idb.clearAll(); });
  },
  getAllDocs(): any[] { return this._store.getAllDocs(); },

  // ===== 新增异步方法（IndexedDB，推荐用于检索） =====
  async searchAsync(queryEmbedding: number[], project: string, topK = 5) {
    if (await ensureIDB()) return idb.searchByProject(queryEmbedding, project, topK);
    return this._store.search(queryEmbedding, project, topK).map((d: any) => ({ ...d, score: 0.5 }));
  },
  // v5.7 迭代4: 异步按 sensitivity 过滤搜索
  async searchWithSensitivityAsync(queryEmbedding: number[], project: string, topK = 5, maxSensitivity = 2) {
    if (await ensureIDB()) {
      // IndexedDB 暂不支持 sensitivity 过滤，返回全部后在前端过滤
      const results = await idb.searchByProject(queryEmbedding, project, topK * 3);
      return results.filter((d: any) => (d.metadata?.sensitivity ?? 0) <= maxSensitivity).slice(0, topK);
    }
    return this._store.searchWithSensitivity(queryEmbedding, project, topK, maxSensitivity).map((d: any) => ({ ...d, score: 0.5 }));
  },
  async searchAllAsync(queryEmbedding: number[], topK = 5) {
    if (await ensureIDB()) return idb.searchAll(queryEmbedding, topK);
    return this._store.searchAll(queryEmbedding, topK).map((d: any) => ({ ...d, score: 0.5 }));
  },
  async statsAsync(project?: string) {
    if (await ensureIDB()) return idb.getStoreStats(project);
    return { count: this._store.stats(project || 'default')?.count || 0, sizeKB: 0, nearQuota: false, lruAge: null };
  },
  async clearProjectAsync(project: string) {
    this._store.clearProject(project);
    if (await ensureIDB()) await idb.clearProject(project);
  },
  async clearAllAsync() {
    this._store.clearAll();
    if (await ensureIDB()) await idb.clearAll();
  },
  async exportVectors() {
    if (await ensureIDB()) return idb.exportAllVectors();
    return { vectors: this._store.getAllDocs(), exportedAt: new Date().toISOString() };
  },
  async importVectors(vectors: VectorDoc[]) {
    if (await ensureIDB()) return idb.importVectors(vectors);
    for (const v of vectors) this._store.add(v);
    return vectors.length;
  },
  async getCapacityInfo() {
    if (await ensureIDB()) {
      const s = await idb.estimateSize();
      const near = await idb.isNearQuota();
      return { sizeMB: s, softLimitMB: 200, nearQuota: near, warningThreshold: 0.85 };
    }
    return { sizeMB: 0, softLimitMB: 200, nearQuota: false, warningThreshold: 0.85 };
  },
};

export async function migrateToIndexedDB() {
  await ensureIDB();
}

