// 知识图谱 — 节点+边，JSON序列化到localStorage
// v5.2: 项目/文档数据通过 projectDataCache 读取（API-backed）

import { getCachedProjects, getCachedUploads } from './projectDataCache';

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
    | 'objective' | 'baseline'
    // 1 AI 类型 (v5.2 — Agent 协作网络注入)
    | 'agent';
  label: string;
  props?: Record<string, string>;
  parentId?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'belongs-to' | 'references' | 'produces' | 'reviews' | 'assigned-to' | 'precedes'
       | 'supplements' | 'refers_to' | 'parent_of' | 'child_of' | 'conflicts_with'
       | 'collaborates';
  label?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: string;
  version: number;
}

const KG_KEY = 'knowledge-graph';
const KG_VERSION = 2; // v2: 新增 Agent 节点 + collaborates 关系

const CHAPTER_NAMES: Record<string, string> = {
  ch1: '前期工作', ch2: '招标采购', ch3: '工程施工', ch4: '竣工验收及移交',
};

// ===== 节点类型 → 中文名称映射 =====
export const TYPE_NAMES: Record<string, string> = {
  // 9 基础类型
  project: '项目', chapter: '章节', 'sub-module': '子模块', 'work-item': '工作项',
  form: '表单', document: '资料', supplier: '供应商', cost: '造价', person: '人员',
  // 4 文档子类型
  'land-reserve': '土地储备', policy: '政策法规', regulation: '制度规范', plan: '计划管理',
  // 5 审查关联类型
  'construction-plan': '施工方案', 'standard-clause': '标准条款',
  'review-item': '审核项', 'risk-point': '风险点',
  contract: '合同', 'bid-document': '招投标文件',
  // 5 业务实体类型
  'daily-report': '日报', issue: '现场问题', 'progress-report': '进度快报',
  experience: '经验库', stakeholder: '干系人',
  // 2 管理类型
  objective: '目标', baseline: '基线',
  // 1 AI 类型
  agent: 'Agent智能体',
};

// ===== 边类型 → 中文名称映射 =====
export const TYPE_EDGE_NAMES: Record<string, string> = {
  'belongs-to': '所属', references: '引用', produces: '产出', reviews: '审查',
  'assigned-to': '服务于', precedes: '前置', supplements: '补充', refers_to: '参考',
  'parent_of': '父级', 'child_of': '子级', 'conflicts_with': '冲突', collaborates: '协作',
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
    // v5.2: 从 API-backed 缓存读取项目列表
    for (const p of getCachedProjects()) {
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
    const uploads = getCachedUploads();  // v5.2: API-backed 缓存
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

  // ===== 5. AI Agent 节点 + 协作关系（v5.2 注入） =====
  // 注：为避免循环依赖（multiAgentOrchestrator → agentFramework → knowledgeGraph），
  // 此处硬编码 5 个 Agent 基本信息，与 AGENT_PROFILES 保持同步
  try {
    const AGENTS = [
      { id: 'safety-inspector', name: '安全审查员', role: '施工安全专家', color: 'bg-red-500' },
      { id: 'quality-engineer', name: '质量工程师', role: '施工质量专家', color: 'bg-green-500' },
      { id: 'contract-analyst', name: '合同分析师', role: '合同法律专家', color: 'bg-blue-500' },
      { id: 'cost-analyst', name: '造价分析师', role: '工程造价专家', color: 'bg-amber-500' },
      { id: 'general-engineer', name: '综合工程Agent', role: '全过程工程咨询专家', color: 'bg-violet-500' },
    ];

    // 5a. Agent 节点
    for (const a of AGENTS) {
      addNode({
        id: `agent-${a.id}`,
        type: 'agent',
        label: a.name,
        props: { role: a.role, color: a.color },
      });
    }

    // 5b. Agent 协作关系（基于角色互补性）
    const collaborations: Array<{ from: string; to: string; label: string }> = [
      { from: 'agent-general-engineer', to: 'agent-safety-inspector', label: '安全咨询协作' },
      { from: 'agent-general-engineer', to: 'agent-quality-engineer', label: '质量咨询协作' },
      { from: 'agent-general-engineer', to: 'agent-contract-analyst', label: '合同咨询协作' },
      { from: 'agent-general-engineer', to: 'agent-cost-analyst', label: '造价咨询协作' },
      { from: 'agent-safety-inspector', to: 'agent-quality-engineer', label: '安全质量联动' },
      { from: 'agent-contract-analyst', to: 'agent-cost-analyst', label: '合同造价联动' },
    ];
    for (const c of collaborations) {
      if (nodeMap.has(c.from) && nodeMap.has(c.to)) {
        addEdge(c.from, c.to, 'collaborates', c.label);
      }
    }

    // 5c. Agent → 项目 关联（Agent 服务于所有项目）
    nodeMap.forEach(n => {
      if (n.type === 'project') {
        nodeMap.forEach(agent => {
          if (agent.type === 'agent') {
            addEdge(agent.id, n.id, 'assigned-to', '服务项目');
          }
        });
      }
    });
  } catch {}

  const graph: KnowledgeGraph = { nodes, edges, updatedAt: new Date().toISOString(), version: KG_VERSION };
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

/** 获取已构建的知识图谱（版本检测：旧版本自动重建） */
export function getGraph(): KnowledgeGraph | null {
  try {
    const raw = localStorage.getItem(KG_KEY);
    if (!raw) return null;
    const graph: KnowledgeGraph = JSON.parse(raw);
    // 版本检测：如果版本落后，自动触发重建
    if (!graph.version || graph.version < KG_VERSION) {
      console.log(`[KnowledgeGraph] 检测到旧版本(v${graph.version || 0})，自动重建为v${KG_VERSION}...`);
      return buildGraph();
    }
    return graph;
  } catch { return null; }
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
