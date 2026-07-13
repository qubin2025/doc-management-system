import { vectorStore } from './vectorStore';
import { chunkByParagraph, chunkBySentence, chunkByToken, autoChunk, type TextChunk } from './chunker';
import * as api from './api';
import { buildGraph } from './knowledgeGraph';

// ===== 类型定义 =====
export interface KnowledgeSource {
  name: string;
  type: 'vector' | 'graph' | 'fulltext' | 'hybrid' | 'llm';
  isAvailable: boolean;
  lastCheckedAt: string;
  priority: number;
  stats?: { docCount?: number; indexSize?: string };
}

export interface SearchRequest {
  query: string;
  projectName?: string;
  mode: 'auto' | 'fulltext' | 'semantic' | 'hybrid';
  topK: number;
  filters?: { artifactType?: string; sourceType?: string };
}

export interface SearchResult {
  items: SearchResultItem[];
  sources: string[];
  totalFound: number;
  latency: number;
  fallbackUsed: boolean;
}

export interface SearchResultItem {
  id: string;
  content: string;
  score: number;
  source: string;
  metadata: Record<string, string>;
}

export interface IndexRequest {
  text: string;
  fileName: string;
  projectName: string;
  chunkStrategy?: 'paragraph' | 'sentence' | 'token' | 'auto';
  metadata?: Record<string, string>;
}

export interface IndexResult {
  chunks: number;
  indexedSources: string[];
  vectorCount: number;
}

// ===== 知识编排器 =====
export class KnowledgeOrchestrator {
  private capabilities: Map<string, KnowledgeSource> = new Map();
  private lastCapabilityCheck = 0;
  private readonly CAPABILITY_TTL = 30000; // 30秒

  constructor() {
    this.initCapabilities();
  }

  private initCapabilities() {
    this.capabilities.set('local-vector', {
      name: '本地向量库',
      type: 'vector',
      isAvailable: true,
      lastCheckedAt: new Date().toISOString(),
      priority: 3,
    });
    this.capabilities.set('local-graph', {
      name: '本地知识图谱',
      type: 'graph',
      isAvailable: true,
      lastCheckedAt: new Date().toISOString(),
      priority: 3,
    });
    this.capabilities.set('lightrag', {
      name: 'LightRAG',
      type: 'hybrid',
      isAvailable: false,
      lastCheckedAt: new Date().toISOString(),
      priority: 2,
    });
    this.capabilities.set('ragflow', {
      name: 'RAGFlow',
      type: 'hybrid',
      isAvailable: false,
      lastCheckedAt: new Date().toISOString(),
      priority: 1,
    });
  }

  /** 刷新能力探测 */
  async refreshCapabilities(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCapabilityCheck < this.CAPABILITY_TTL) return;
    this.lastCapabilityCheck = now;

    // 并行探测
    const [lrOk, rfOk] = await Promise.all([
      this.probeLightRAG(),
      this.probeRAGFlow(),
    ]);

    this.updateCapability('lightrag', lrOk);
    this.updateCapability('ragflow', rfOk);
  }

  private updateCapability(name: string, available: boolean) {
    const cap = this.capabilities.get(name);
    if (cap) {
      cap.isAvailable = available;
      cap.lastCheckedAt = new Date().toISOString();
    }
  }

  private async probeLightRAG(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch('http://localhost:8000/api/lightrag/health', { signal: ctrl.signal });
      return res.ok;
    } catch { return false; }
  }

  private async probeRAGFlow(): Promise<boolean> {
    try {
      const res = await api.ragflowHealth();
      return res?.available === true;
    } catch { return false; }
  }

  /** 获取所有可用源 */
  getAvailableSources(): KnowledgeSource[] {
    return Array.from(this.capabilities.values())
      .filter(s => s.isAvailable)
      .sort((a, b) => a.priority - b.priority);
  }

  /** 健康检查 */
  async health(): Promise<{
    sources: KnowledgeSource[];
    vectorCount: number;
    graphNodes: number;
  }> {
    await this.refreshCapabilities();
    const allDocs = vectorStore.getAllDocs();
    const graph = buildGraph();
    return {
      sources: this.getAvailableSources(),
      vectorCount: allDocs.length,
      graphNodes: graph?.nodes.length || 0,
    };
  }

  // ===== 检索 =====
  async search(request: SearchRequest): Promise<SearchResult> {
    const startTime = performance.now();
    await this.refreshCapabilities();
    const { query, projectName, mode, topK = 5 } = request;

    let items: SearchResultItem[] = [];
    let sources: string[] = [];
    let fallbackUsed = false;

    // 降级链检索
    if (mode === 'auto' || mode === 'hybrid') {
      // 1. 尝试 RAGFlow
      const rfResult = await this.trySearch('ragflow', () => this.searchRAGFlow(query, topK));
      if (rfResult.length > 0) {
        items = rfResult;
        sources.push('ragflow');
      } else {
        fallbackUsed = true;
        // 2. 降级 LightRAG
        const lrResult = await this.trySearch('lightrag', () => this.searchLightRAG(query, topK));
        if (lrResult.length > 0) {
          items = lrResult;
          sources.push('lightrag');
        } else {
          fallbackUsed = true;
          // 3. 降级本地向量 + 全文
          items = await this.searchLocal(query, projectName, topK);
          sources.push('local-vector');
        }
      }
    } else if (mode === 'semantic') {
      items = await this.searchLocal(query, projectName, topK);
      sources.push('local-vector');
    } else {
      // fulltext only - via local embedding search
      items = await this.searchLocal(query, projectName, topK);
      sources.push('local-vector');
    }

    const latency = Math.round(performance.now() - startTime);

    return {
      items: this.deduplicate(items).slice(0, topK),
      sources,
      totalFound: items.length,
      latency,
      fallbackUsed,
    };
  }

  private async trySearch(
    source: string,
    searchFn: () => Promise<SearchResultItem[]>
  ): Promise<SearchResultItem[]> {
    const cap = this.capabilities.get(source);
    if (!cap?.isAvailable) return [];
    try {
      return await searchFn();
    } catch {
      this.updateCapability(source, false);
      return [];
    }
  }

  private async searchRAGFlow(query: string, topK: number): Promise<SearchResultItem[]> {
    try {
      const res = await api.ragflowRetrieval(query, [], topK);
      const chunks = res?.data?.chunks || res?.chunks || [];
      if (Array.isArray(chunks)) {
        return chunks.map((c: any, i: number) => ({
          id: `rf-${i}`,
          content: c.content || c.text || c.chunk || '',
          score: c.similarity || c.score || 0.5,
          source: 'ragflow',
          metadata: { document: c.document_name || c.doc_name || '' },
        }));
      }
    } catch { /* 降级 */ }
    return [];
  }

  private async searchLightRAG(
    query: string, topK: number
  ): Promise<SearchResultItem[]> {
    try {
      const res = await api.lightragSearch(query, topK, 'hybrid');
      const results = res?.results || [];
      if (Array.isArray(results)) {
        return results.slice(0, topK).map((r: any, i: number) => ({
          id: `lr-${i}`,
          content: r.content || r.text || r.chunk || '',
          score: r.score || r.relevance || 0.5,
          source: 'lightrag',
          metadata: { type: r.type || 'chunk' },
        }));
      }
    } catch { /* 降级 */ }
    return [];
  }

  private async searchLocal(
    query: string, projectName?: string, topK = 5
  ): Promise<SearchResultItem[]> {
    try {
      const qEmbedding = await api.embedText(query, 'query');
      if (!qEmbedding || qEmbedding.length === 0) return [];

      const results = projectName
        ? vectorStore.search(qEmbedding, projectName, topK)
        : vectorStore.searchAll(qEmbedding, topK);

      return results.map((r: any, i: number) => ({
        id: r.id || `local-${i}`,
        content: r.text || r.content || '',
        score: r.score || r.similarity || 0.5,
        source: 'local-vector',
        metadata: r.metadata || {},
      }));
    } catch { return []; }
  }

  private deduplicate(items: SearchResultItem[]): SearchResultItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.content.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ===== 索引 =====
  async index(request: IndexRequest): Promise<IndexResult> {
    const { text, fileName, projectName, chunkStrategy = 'auto', metadata } = request;

    // 1. 分块
    let chunks: TextChunk[];
    switch (chunkStrategy) {
      case 'paragraph': chunks = chunkByParagraph(text); break;
      case 'sentence': chunks = chunkBySentence(text); break;
      case 'token': chunks = chunkByToken(text); break;
      default: chunks = autoChunk(text);
    }

    // 2. 向量化并索引到本地
    const indexedSources: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await api.embedText(chunk.text, 'document');
        if (embedding && embedding.length > 0) {
          vectorStore.addDocument(chunk.text, embedding, {
            fileName,
            chunkIndex: i,
            chunkCount: chunks.length,
            projectName: projectName,
            ...metadata,
          });
        }
      } catch { /* 跳过失败的chunk */ }
    }
    indexedSources.push('local-vector');

    // 3. 异步尝试索引到 LightRAG (需要File，此处通过health检查可用性)
    try {
      const lrOk = await this.probeLightRAG();
      if (lrOk) indexedSources.push('lightrag-ready');
    } catch { /* LightRAG不可用 */ }

    return {
      chunks: chunks.length,
      indexedSources,
      vectorCount: vectorStore.stats(projectName)?.count || 0,
    };
  }

  /** 获取知识图谱 */
  getGraph() {
    return buildGraph();
  }

  /** 获取向量存储统计 */
  getVectorStats(projectName?: string) {
    if (projectName) return vectorStore.stats(projectName);
    const projects = vectorStore.projects();
    let total = 0;
    projects.forEach(p => {
      const s = vectorStore.stats(p);
      total += s?.count || 0;
    });
    return { count: total, projects };
  }
}

// 全局单例
export const orchestrator = new KnowledgeOrchestrator();
