// 知识图谱 — 节点+边，JSON序列化到localStorage

export interface GraphNode {
  id: string;
  type: 'project' | 'form' | 'document' | 'work-item' | 'person';
  label: string;
  props?: Record<string, string>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'references' | 'produces' | 'reviews' | 'belongs-to' | 'assigned-to';
  label?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: string;
}

const KG_KEY = 'knowledge-graph';

/** 构建知识图谱 */
export function buildGraph(): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // 1. 项目节点
  try {
    const projects = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]')
      .concat(JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'));
    const seen = new Set<string>();
    for (const p of projects) {
      if (p.name && !seen.has(p.name)) {
        seen.add(p.name);
        nodes.push({ id: 'proj-' + p.name, type: 'project', label: p.name, props: { createdAt: p.createdAt } });
      }
    }
  } catch {}

  // 2. 表单节点（从localStorage中的form-content读取）
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('form-content-' + ch + '-')) {
        const code = key.replace('form-content-' + ch + '-', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.content && data.content.trim().length > 10) {
            nodes.push({ id: 'form-' + code, type: 'form', label: code, props: { lastModified: data.lastModified } });
          }
        } catch {}
      }
    }
  }

  // 3. 文档节点（从上传记录读取）
  try {
    const uploads = JSON.parse(localStorage.getItem('doc-mgmt-upload-DB11/T695-2025') || '{}');
    for (const [proj, docs] of Object.entries(uploads)) {
      if (Array.isArray(docs)) continue;
      for (const [docId, files] of Object.entries(docs as Record<string, any[]>)) {
        if (Array.isArray(files) && files.length > 0) {
          const file = files[files.length - 1];
          nodes.push({
            id: 'doc-' + docId,
            type: 'document',
            label: file.fileName || docId,
            props: { project: proj, uploadTime: file.uploadTime },
          });
          // 文档→项目 边
          edges.push({ from: 'doc-' + docId, to: 'proj-' + proj, type: 'belongs-to' });
        }
      }
    }
  } catch {}

  // 4. 工作项节点
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    try {
      const done = new Set(JSON.parse(localStorage.getItem('guide-chapter-' + ch + '-done') || '[]') as string[]);
      const modules = JSON.parse(localStorage.getItem('guide-chapter-' + ch + '-modules') || '[]');
      if (!Array.isArray(modules)) continue;
      for (const sm of modules) {
        if (!sm.workItems) continue;
        for (const wi of sm.workItems) {
          nodes.push({
            id: 'wi-' + wi.id,
            type: 'work-item',
            label: wi.name,
            props: { completed: String(done.has(wi.id)), chapter: ch },
          });
          // 工作项→章节 边
          edges.push({ from: 'wi-' + wi.id, to: 'ch-' + ch, type: 'belongs-to' });
        }
      }
    } catch {}
    // 章节节点
    nodes.push({ id: 'ch-' + ch, type: 'project', label: '第' + ch.replace('ch', '') + '章' });
  }

  // 5. 人员节点
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('form-fields-' + ch + '-')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.creator && data.creator !== '未知') {
            const personId = 'person-' + data.creator;
            if (!nodes.find(n => n.id === personId)) {
              nodes.push({ id: personId, type: 'person', label: data.creator });
            }
          }
        } catch {}
      }
    }
  }

  const graph: KnowledgeGraph = { nodes, edges, updatedAt: new Date().toISOString() };
  localStorage.setItem(KG_KEY, JSON.stringify(graph));
  return graph;
}

/** 获取已构建的知识图谱 */
export function getGraph(): KnowledgeGraph | null {
  try { return JSON.parse(localStorage.getItem(KG_KEY) || 'null'); } catch { return null; }
}

/** 获取与某节点相关的所有节点 */
export function getRelated(nodeId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const graph = getGraph();
  if (!graph) return { nodes: [], edges: [] };
  const relatedEdges = graph.edges.filter(e => e.from === nodeId || e.to === nodeId);
  const relatedIds = new Set<string>();
  relatedEdges.forEach(e => { relatedIds.add(e.from); relatedIds.add(e.to); });
  return {
    nodes: graph.nodes.filter(n => relatedIds.has(n.id)),
    edges: relatedEdges,
  };
}
