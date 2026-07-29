// 知识图谱 — 节点+边，JSON序列化到localStorage

export interface GraphNode {
  id: string;
  type:
    // 9 基础类型 (v2.5)
    | 'project' | 'chapter' | 'sub-module' | 'work-item' | 'form' | 'document' | 'supplier' | 'cost' | 'person'
    // 4 文档子类型 (v3.0 — 提升为顶层节点)
    | 'land-reserve' | 'policy' | 'regulation' | 'plan'
    // 5 审查关联类型 (v3.0 P1 — 审查组件直接注入 Neo4j)
    | 'construction-plan' | 'risk-point' | 'review-item' | 'contract' | 'bid-document'
    // 5 业务实体类型 (v4.4)
    | 'daily-report' | 'issue' | 'progress-report' | 'experience' | 'stakeholder'
    // 2 管理类型 (v3.0 P0)
    | 'objective' | 'baseline';
  label: string;
  props?: Record<string, string>;
  parentId?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'belongs-to' | 'references' | 'produces' | 'reviews' | 'assigned-to' | 'precedes'
       | 'supplements' | 'refers_to' | 'parent_of' | 'child_of' | 'conflicts_with';
  label?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: string;
}

const KG_KEY = 'knowledge-graph';

const CHAPTER_NAMES: Record<string, string> = {
  ch1: '前期工作', ch2: '招标采购', ch3: '工程施工', ch4: '竣工验收及移交',
};

// ================================================================
//  知识图谱生成 — 项目为中心、双维度架构
//  指南维度: 项目 → 章节 → 子模块 → 工作项
//  功能维度: 项目 → 资料分类 → 文档/供应商/造价
//  反向查询: 任意节点可追溯父节点链
// ================================================================

/** 构建知识图谱 */
export function buildGraph(): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  function addNode(n: GraphNode) {
    if (!nodeMap.has(n.id)) { nodeMap.set(n.id, n); nodes.push(n); }
  }
  function addEdge(from: string, to: string, type: GraphEdge['type'], label?: string) {
    if (!edges.some(e => e.from === from && e.to === to)) {
      edges.push({ from, to, type, label });
    }
  }

  // ===== 1. 项目节点（根节点） =====
  try {
    const p695 = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]');
    const p808 = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]');
    for (const p of [...p695, ...p808]) {
      if (!p.name) continue;
      const pid = 'proj-' + p.name;
      addNode({ id: pid, type: 'project', label: p.name, props: { createdAt: p.createdAt } });
    }
  } catch {}

  // ===== 2. 指南维度：章节 → 子模块 → 工作项 =====
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    const chId = 'chapter-' + ch;
    const chName = CHAPTER_NAMES[ch] || ch;
    addNode({ id: chId, type: 'chapter', label: `第${ch.replace('ch','')}章 ${chName}` });

    // 章节→项目 边（链接到所有项目）
    nodeMap.forEach(n => {
      if (n.type === 'project') addEdge(chId, n.id, 'belongs-to', '所属项目');
    });

    try {
      const modules = JSON.parse(localStorage.getItem(`guide-chapter-${ch}-modules`) || '[]');
      const done = new Set(JSON.parse(localStorage.getItem(`guide-chapter-${ch}-done`) || '[]') as string[]);

      if (Array.isArray(modules)) {
        for (const sm of modules) {
          if (!sm.id || !sm.workItems) continue;

          // 子模块节点
          const smId = 'sm-' + sm.id;
          addNode({ id: smId, type: 'sub-module', label: sm.name, parentId: chId });

          // 子模块→章节
          addEdge(smId, chId, 'belongs-to', '所属章节');

          for (const wi of sm.workItems) {
            if (!wi.id) continue;
            // 工作项节点
            const wiId = 'wi-' + wi.id;
            const completed = done.has(wi.id);
            addNode({
              id: wiId, type: 'work-item', label: wi.name,
              parentId: smId,
              props: {
                completed: String(completed),
                chapter: ch,
                duration: wi.duration || '',
                subModule: sm.name,
              },
            });

            // 工作项→子模块
            addEdge(wiId, smId, 'belongs-to', '所属子模块');
          }
        }
      }
    } catch {}
  }

  // ===== 3. 功能维度 =====
  // 3a. 文档节点（从上传记录读取）
  try {
    const uploads = JSON.parse(localStorage.getItem('doc-mgmt-upload-DB11/T695-2025') || '{}');
    for (const [proj, docMap] of Object.entries(uploads)) {
      if (!docMap || typeof docMap !== 'object') continue;
      for (const [docId, files] of Object.entries(docMap as Record<string, any[]>)) {
        if (!Array.isArray(files) || files.length === 0) continue;
        const f = files[files.length - 1];
        if (!f.fileName) continue;

        const docNid = 'doc-' + docId;
        addNode({
          id: docNid, type: 'document', label: f.fileName,
          parentId: 'proj-' + proj,
          props: { project: proj, docId, uploadTime: f.uploadTime, category: docId[0] || '' },
        });
        // 文档→项目
        addEdge(docNid, 'proj-' + proj, 'belongs-to', '所属项目');

        // 文档→资料分类节点
        const cat = docId[0]; // A/B/C/D类
        if (cat) {
          const catId = 'cat-' + cat;
          addNode({ id: catId, type: 'document', label: cat + '类 资料分类' });
          addEdge(docNid, catId, 'belongs-to', '资料分类');
          addEdge(catId, 'proj-' + proj, 'belongs-to', '所属项目');
        }
      }
    }
  } catch {}

  // 3b. 表单节点
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('form-content-' + ch + '-')) continue;
      const code = key.replace('form-content-' + ch + '-', '');
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.content && data.content.trim().length > 10) {
          const fid = 'form-' + code;
          addNode({
            id: fid, type: 'form', label: code,
            parentId: 'chapter-' + ch,
            props: { lastModified: data.lastModified, chapter: ch },
          });
          // 表单→章节
          addEdge(fid, 'chapter-' + ch, 'belongs-to', '所属章节');
        }
      } catch {}
    }
  }

  // 3c. 供应商节点
  try {
    const suppliers = JSON.parse(localStorage.getItem('supplier-data') || '[]');
    if (Array.isArray(suppliers)) {
      for (const s of suppliers) {
        if (!s.name) continue;
        const sid = 'supplier-' + s.name;
        addNode({
          id: sid, type: 'supplier', label: s.name,
          props: { qualification: s.qualification || '', contact: s.contact || '' },
        });
        // 供应商→关联项目
        if (s.project) addEdge(sid, 'proj-' + s.project, 'references', '合作');
      }
    }
  } catch {}

  // 3d. 造价数据节点（从项目投资信息构建）
  nodeMap.forEach(n => {
    if (n.type !== 'project') return;
    const projName = n.label;
    try {
      const allProjects = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]')
        .concat(JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'));
      const proj = allProjects.find((p: any) => p.name === projName);
      if (proj?.details?.investment) {
        const cid = 'cost-' + projName;
        addNode({
          id: cid, type: 'cost', label: '投资:' + proj.details.investment,
          parentId: n.id,
          props: { area: proj.details.area || '', scale: proj.details.scale || '' },
        });
        addEdge(cid, n.id, 'belongs-to', '造价数据');
      }
    } catch {}
  });

  // 3e. 计划管理节点（甘特图/网络图）
  try {
    const planFiles = JSON.parse(localStorage.getItem('plan-files') || '[]');
    if (Array.isArray(planFiles)) {
      for (const f of planFiles) {
        if (!f.name) continue;
        const pid = 'plan-' + f.name;
        addNode({ id: pid, type: 'document', label: f.name, props: { type: 'plan', project: f.project || '' } });
        if (f.project) addEdge(pid, 'proj-' + f.project, 'belongs-to', '计划文档');
        // 关联到所有项目
        nodeMap.forEach(n => { if (n.type === 'project') addEdge(pid, n.id, 'belongs-to', '计划文档'); });
      }
    }
  } catch {}

  // 3f. 土地储备归档节点
  try {
    const landData = JSON.parse(localStorage.getItem('land-reserve-data') || '[]');
    if (Array.isArray(landData)) {
      for (const item of landData) {
        if (!item.id) continue;
        const lid = 'land-' + item.id;
        addNode({
          id: lid, type: 'document', label: item.name || item.id,
          props: { category: item.category || '', status: item.status || '', type: 'land-reserve' },
        });
        // 关联到项目
        nodeMap.forEach(n => { if (n.type === 'project') addEdge(lid, n.id, 'belongs-to', '土储归档'); });
      }
    }
  } catch {}

  // 3g. 政策库节点
  try {
    const policyData = JSON.parse(localStorage.getItem('policy-library-data') || '{}');
    for (const [cat, docs] of Object.entries(policyData)) {
      if (!Array.isArray(docs)) continue;
      for (const doc of docs as any[]) {
        if (!doc.title) continue;
        const did = 'policy-' + doc.title;
        addNode({
          id: did, type: 'document', label: doc.title,
          props: { category: cat, type: 'policy', date: doc.date || '' },
        });
        nodeMap.forEach(n => { if (n.type === 'project') addEdge(did, n.id, 'references', '政策法规'); });
      }
    }
  } catch {}

  // 3h. 制度规范库节点
  try {
    const regData = JSON.parse(localStorage.getItem('regulations-library-data') || '{}');
    for (const [cat, docs] of Object.entries(regData)) {
      if (!Array.isArray(docs)) continue;
      for (const doc of docs as any[]) {
        if (!doc.title) continue;
        const rid = 'regulation-' + doc.title;
        addNode({
          id: rid, type: 'document', label: doc.title,
          props: { category: cat, type: 'regulation', date: doc.date || '' },
        });
        nodeMap.forEach(n => { if (n.type === 'project') addEdge(rid, n.id, 'references', '制度规范'); });
      }
    }
  } catch {}

  // 3i. 人员节点
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('form-fields-' + ch + '-')) continue;
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.creator && data.creator !== '未知') {
          addNode({ id: 'person-' + data.creator, type: 'person', label: data.creator });
        }
      } catch {}
    }
  }

  // 4. 业务实体节点 (v4.4+)
  // 4a. 日报节点
  try {
    const drKey = 'desktop-daily-reports';
    const drData = JSON.parse(localStorage.getItem(drKey) || '[]');
    if (Array.isArray(drData)) {
      for (const dr of drData) {
        if (dr.projectId) {
          addNode({ id: `daily-${dr.id || dr.reportDate}`, type: 'daily-report', label: `${dr.projectName || ''} ${dr.reportDate || ''}`.trim(), parentId: dr.projectId, props: { reportDate: dr.reportDate, weatherDay: dr.weatherDay } });
          addEdge(`daily-${dr.id || dr.reportDate}`, dr.projectId, 'belongs-to', '日报→项目');
        }
      }
    }
  } catch {}
  // 4b. 现场问题节点
  try {
    const issueKey = 'desktop-issues';
    const issueData = JSON.parse(localStorage.getItem(issueKey) || '[]');
    if (Array.isArray(issueData)) {
      for (const iss of issueData) {
        if (iss.projectId) {
          addNode({ id: `issue-${iss.id}`, type: 'issue', label: iss.title || iss.description?.slice(0, 40) || '', parentId: iss.projectId, props: { status: iss.status, severity: iss.severity } });
          addEdge(`issue-${iss.id}`, iss.projectId, 'belongs-to', '问题→项目');
        }
      }
    }
  } catch {}
  // 4c. 经验节点
  try {
    const expKey = 'experience-items';
    const expData = JSON.parse(localStorage.getItem(expKey) || '[]');
    if (Array.isArray(expData)) {
      for (const exp of expData) {
        addNode({ id: `exp-${exp.id}`, type: 'experience', label: exp.title || '', parentId: exp.projectName, props: { category: exp.category, patterns: String(exp.patterns?.length || 0) } });
        if (exp.projectName) addEdge(`exp-${exp.id}`, exp.projectName, 'belongs-to', '经验→项目');
      }
    }
  } catch {}
  // 4d. 干系人节点
  try {
    const shKey = 'stakeholders-data';
    const shData = JSON.parse(localStorage.getItem(shKey) || '[]');
    if (Array.isArray(shData)) {
      for (const sh of shData) {
        addNode({ id: `stakeholder-${sh.id || sh.name}`, type: 'stakeholder', label: sh.name || '', props: { role: sh.role, influence: sh.influence, interest: sh.interest } });
      }
    }
  } catch {}

  const graph: KnowledgeGraph = { nodes, edges, updatedAt: new Date().toISOString() };
  localStorage.setItem(KG_KEY, JSON.stringify(graph));
  // 自动同步到Neo4j（后台静默，失败不影响前端）
  autoSyncToNeo4j(nodes, edges);
  return graph;
}

// ================================================================
//  反向查询：获取某节点的完整父节点链 + 子节点链
// ================================================================

/** 获取与某节点相关的所有节点（含父链追溯） */
export function getRelated(nodeId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const graph = getGraph();
  if (!graph) return { nodes: [], edges: [] };

  const relatedIds = new Set<string>([nodeId]);
  const relatedEdges = new Set<GraphEdge>();

  // BFS 向外扩散2层
  const queue = [nodeId];
  for (let depth = 0; depth < 3 && queue.length > 0; depth++) {
    const level = [...queue];
    queue.length = 0;
    for (const current of level) {
      for (const e of graph.edges) {
        if (e.from === current || e.to === current) {
          relatedEdges.add(e);
          const other = e.from === current ? e.to : e.from;
          if (!relatedIds.has(other)) {
            relatedIds.add(other);
            queue.push(other);
          }
        }
      }
    }
  }

  return {
    nodes: graph.nodes.filter(n => relatedIds.has(n.id)),
    edges: Array.from(relatedEdges),
  };
}

/** 获取节点的父节点链（从当前节点追溯到根项目节点） */
export function getParentChain(nodeId: string, allNodes: GraphNode[], allEdges: GraphEdge[]): GraphNode[] {
  const chain: GraphNode[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = nodeId;

  while (currentId && !visited.has(currentId)) {
    const node = allNodes.find(n => n.id === currentId);
    if (!node) break;
    visited.add(currentId);
    chain.unshift(node); // 插到前面，根节点在索引0

    // 找父节点：parentId 优先，其次找 belows-to 边的目标
    if (node.parentId && !visited.has(node.parentId)) {
      currentId = node.parentId;
    } else {
      const parentEdge = allEdges.find(e =>
        (e.from === currentId && (e.type === 'belongs-to' || e.type === 'precedes'))
      );
      currentId = parentEdge?.to;
    }
  }

  return chain;
}

/** 获取已构建的知识图谱 */
export function getGraph(): KnowledgeGraph | null {
  try { return JSON.parse(localStorage.getItem(KG_KEY) || 'null'); } catch { return null; }
}

/** 自动同步图谱到Neo4j后端（后台静默，失败不影响前端） */
let _syncTimer: any = null;
let _pendingSync: { nodes: GraphNode[]; edges: GraphEdge[] } | null = null;

function autoSyncToNeo4j(nodes: GraphNode[], edges: GraphEdge[]) {
  // 防抖：300ms内多次调用只执行最后一次
  _pendingSync = { nodes, edges };
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    const data = _pendingSync;
    if (!data) return;
    _pendingSync = null;
    try {
      const token = localStorage.getItem('doc-system-token') || '';
      const res = await fetch('/api/kg/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nodes: data.nodes.slice(0, 200), edges: data.edges.slice(0, 500) }),
      });
      if (res.ok) console.log('✅ 图谱已自动同步到Neo4j');
    } catch { /* 静默失败，不影响前端 */ }
  }, 300);
}
