/**
 * GraphRAG 图遍历检索 — Neo4j 知识图谱语义检索端点
 * 依赖 kg.js 的 initDriver() 共享 Neo4j 连接池
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { initDriver } from './kg.js';

const router = Router();

// ── 工具函数 ──

function toInt(n) {
  return Math.floor(n);
}

function parseProps(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function nodeSummary(node) {
  const props = parseProps(node.props);
  const parts = [];
  if (props.standard) parts.push(`[${props.standard}]`);
  if (props.description) parts.push(props.description);
  else if (props.content) parts.push(props.content.slice(0, 200));
  else if (props.summary) parts.push(props.summary);
  if (props.status) parts.push(`状态:${props.status}`);
  if (props.category) parts.push(`分类:${props.category}`);
  return parts.length ? parts.join(' ') : node.label;
}

function bfsTraverse(seedIds, edgeList, depth) {
  const adj = new Map();
  for (const e of edgeList) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push({ to: e.to, type: e.type, label: e.label });
    adj.get(e.to).push({ to: e.from, type: e.type, label: e.label });
  }

  const visited = new Set(seedIds);
  let frontier = [...seedIds];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const id of frontier) {
      const neighbors = adj.get(id) || [];
      for (const nb of neighbors) {
        if (!visited.has(nb.to)) { visited.add(nb.to); next.push(nb.to); }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return visited;
}

// ── GraphRAG 端点 ──

/**
 * GET /api/kg/graphrag/search
 * 按关键词匹配节点，BFS扩散获取关联子图
 */
router.get('/graphrag/search', requireAuth, async (req, res) => {
  await initDriver();
  const { default: neo4j } = await import('neo4j-driver');
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { maxConnectionLifetime: 3 * 60 * 60 * 1000, maxConnectionPoolSize: 5 });
  const keyword = (req.query.keyword || '').trim();
  if (!keyword) return res.status(400).json({ error: 'keyword 必填' });
  const depth = Math.min(parseInt(req.query.depth) || 2, 4);
  const seedLimit = Math.min(parseInt(req.query.seedLimit) || 10, 30);

  const session = driver.session();
  try {
    const seedResult = await session.run(
      'MATCH (n:Node) WHERE n.label CONTAINS $kw RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props ORDER BY n.label LIMIT $limit',
      { kw: keyword, limit: toInt(seedLimit) }
    );
    const seeds = seedResult.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));
    if (seeds.length === 0) {
      return res.json({ available: true, keyword, seeds: [], nodes: [], edges: [], paths: [], summary: '未找到匹配的知识图谱节点' });
    }

    const seedIds = seeds.map(s => s.id);
    const allEdgesResult = await session.run('MATCH (a:Node)-[r]->(b:Node) RETURN a.id AS from, b.id AS to, type(r) AS type, r.label AS label');
    const allEdges = allEdgesResult.records.map(r => ({
      from: r.get('from'), to: r.get('to'), type: r.get('type'), label: r.get('label') || ''
    }));

    const visitedIds = bfsTraverse(seedIds, allEdges, depth);
    const nodeResult = await session.run(
      'MATCH (n:Node) WHERE n.id IN $ids RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props',
      { ids: [...visitedIds] }
    );
    const subNodes = nodeResult.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));
    const subEdges = allEdges.filter(e => visitedIds.has(e.from) && visitedIds.has(e.to));

    const paths = [];
    for (const seed of seeds) {
      const seedEdges = subEdges.filter(e => e.from === seed.id || e.to === seed.id);
      for (const e of seedEdges) {
        const otherId = e.from === seed.id ? e.to : e.from;
        const otherNode = subNodes.find(n => n.id === otherId);
        const dir = e.from === seed.id ? '→' : '←';
        paths.push({ from: seed.label, relation: `${dir} ${e.type} ${dir}`, to: otherNode ? otherNode.label : otherId });
      }
    }

    res.json({
      available: true, keyword, depth,
      seeds, nodes: subNodes,
      edges: subEdges.map(e => ({ from: e.from, to: e.to, type: e.type, label: e.label })),
      paths, nodeCount: subNodes.length, edgeCount: subEdges.length,
    });
  } catch (e) {
    console.error('GraphRAG search:', e.message);
    res.status(500).json({ available: true, error: e.message });
  } finally { await session.close(); await driver.close(); }
});

/**
 * GET /api/kg/graphrag/context
 * 返回适合注入 AI prompt 的文本摘要
 */
router.get('/graphrag/context', requireAuth, async (req, res) => {
  await initDriver();
  const { default: neo4j } = await import('neo4j-driver');
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { maxConnectionLifetime: 3 * 60 * 60 * 1000, maxConnectionPoolSize: 5 });

  const keyword = (req.query.keyword || '').trim();
  if (!keyword) return res.status(400).json({ error: 'keyword 必填' });
  const depth = Math.min(parseInt(req.query.depth) || 2, 4);
  const fmt = req.query.format === 'markdown' ? 'markdown' : 'text';

  const session = driver.session();
  try {
    const seedResult = await session.run(
      'MATCH (n:Node) WHERE n.label CONTAINS $kw RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props ORDER BY n.label LIMIT 10',
      { kw: keyword }
    );
    const seeds = seedResult.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));
    if (seeds.length === 0) {
      return res.json({ available: true, context: '', hint: `知识图谱中未找到与「${keyword}」相关的节点` });
    }

    const allEdgesResult = await session.run('MATCH (a:Node)-[r]->(b:Node) RETURN a.id AS from, b.id AS to, type(r) AS type, r.label AS label');
    const allEdges = allEdgesResult.records.map(r => ({
      from: r.get('from'), to: r.get('to'), type: r.get('type'), label: r.get('label') || ''
    }));

    const visitedIds = bfsTraverse(seeds.map(s => s.id), allEdges, depth);
    const nodeResult = await session.run(
      'MATCH (n:Node) WHERE n.id IN $ids RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props',
      { ids: [...visitedIds] }
    );
    const subNodes = nodeResult.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));

    const lines = [];
    if (fmt === 'markdown') {
      lines.push(`## 知识图谱上下文：${keyword}`, '', '### 相关节点');
      for (const n of subNodes) {
        const isSeed = seeds.some(s => s.id === n.id);
        lines.push(`- ${isSeed ? '★' : '·'} **[${n.type}]** ${n.label} — ${nodeSummary(n)}`);
      }
      lines.push('', '### 关联关系');
      const subEdges = allEdges.filter(e => visitedIds.has(e.from) && visitedIds.has(e.to));
      for (const e of subEdges) {
        const fromNode = subNodes.find(n => n.id === e.from);
        const toNode = subNodes.find(n => n.id === e.to);
        lines.push(`- ${fromNode?.label || e.from} → *${e.type}* → ${toNode?.label || e.to}`);
      }
    } else {
      lines.push(`【知识图谱上下文 — 关键词: ${keyword}】`, '---相关节点---');
      for (const n of subNodes) {
        const isSeed = seeds.some(s => s.id === n.id);
        lines.push(`${isSeed ? '★' : '·'} [${n.type}] ${n.label} | ${nodeSummary(n)}`);
      }
      lines.push('---关联关系---');
      const subEdges = allEdges.filter(e => visitedIds.has(e.from) && visitedIds.has(e.to));
      for (const e of subEdges) {
        const fromNode = subNodes.find(n => n.id === e.from);
        const toNode = subNodes.find(n => n.id === e.to);
        lines.push(`${fromNode?.label || e.from} --[${e.type}]--> ${toNode?.label || e.to}`);
      }
    }

    res.json({ available: true, context: lines.join('\n'), nodeCount: subNodes.length, seedCount: seeds.length, keyword });
  } catch (e) {
    console.error('GraphRAG context:', e.message);
    res.json({ available: true, context: '', error: e.message });
  } finally { await session.close(); await driver.close(); }
});

/**
 * POST /api/kg/graphrag/enrich
 * 语义边富化 — 基于节点标签相似度和层级关系自动创建语义边
 */
router.post('/graphrag/enrich', requireAuth, async (req, res) => {
  await initDriver();
  const { default: neo4j } = await import('neo4j-driver');
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { maxConnectionLifetime: 3 * 60 * 60 * 1000, maxConnectionPoolSize: 5 });

  const types = req.body.types || ['chapter', 'sub-module', 'work-item', 'form', 'document'];
  const similarityThreshold = req.body.similarityThreshold || 0.4;
  const session = driver.session();
  let createdEdges = 0;
  const createdTypes = {};

  try {
    const nodeResult = await session.run(
      'MATCH (n:Node) WHERE n.type IN $types RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props',
      { types }
    );
    const nodes = nodeResult.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: parseProps(r.get('props'))
    }));
    if (nodes.length < 2) {
      return res.json({ success: true, createdEdges: 0, createdTypes: {}, hint: '节点数不足，无法创建语义边' });
    }

    const byParent = new Map();
    for (const n of nodes) {
      const pid = n.props.parentId;
      if (pid) {
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(n);
      }
    }

    // PARENT_OF 边
    for (const n of nodes) {
      const pid = n.props.parentId;
      if (pid) {
        try {
          await session.run(
            'MATCH (a:Node {id:$from}), (b:Node {id:$to}) MERGE (a)-[r:PARENT_OF]->(b) SET r.label=$label',
            { from: pid, to: n.id, label: `${nodes.find(x => x.id === pid)?.label || pid} → ${n.label}` }
          );
          createdEdges++;
          createdTypes['PARENT_OF'] = (createdTypes['PARENT_OF'] || 0) + 1;
        } catch { /* skip */ }
      }
    }

    // SUPPLEMENTS 边（同级节点）
    for (const [pid, children] of byParent) {
      for (let i = 0; i < children.length; i++) {
        for (let j = i + 1; j < children.length; j++) {
          try {
            await session.run(
              'MATCH (a:Node {id:$from}), (b:Node {id:$to}) MERGE (a)-[r:SUPPLEMENTS]->(b) SET r.label=$label',
              { from: children[i].id, to: children[j].id, label: `同级关联: ${children[i].label} ↔ ${children[j].label}` }
            );
            createdEdges++;
            createdTypes['SUPPLEMENTS'] = (createdTypes['SUPPLEMENTS'] || 0) + 1;
          } catch { /* skip */ }
        }
      }
    }

    // REFERS_TO 边（标签相似度）
    function charJaccard(a, b) {
      const setA = new Set(a.replace(/\s+/g, ''));
      const setB = new Set(b.replace(/\s+/g, ''));
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      return intersection.size / union.size;
    }

    const byType = new Map();
    for (const n of nodes) {
      if (!byType.has(n.type)) byType.set(n.type, []);
      byType.get(n.type).push(n);
    }

    for (const [type, typeNodes] of byType) {
      if (typeNodes.length < 2) continue;
      for (let i = 0; i < typeNodes.length; i++) {
        for (let j = i + 1; j < typeNodes.length; j++) {
          const sim = charJaccard(typeNodes[i].label, typeNodes[j].label);
          if (sim >= similarityThreshold) {
            try {
              await session.run(
                'MATCH (a:Node {id:$from}), (b:Node {id:$to}) MERGE (a)-[r:REFERS_TO]->(b) SET r.label=$label, r.similarity=$sim',
                { from: typeNodes[i].id, to: typeNodes[j].id, label: `语义相似 ${sim.toFixed(2)}: ${typeNodes[i].label} ↔ ${typeNodes[j].label}`, sim }
              );
              createdEdges++;
              createdTypes['REFERS_TO'] = (createdTypes['REFERS_TO'] || 0) + 1;
            } catch { /* skip */ }
          }
        }
      }
    }

    res.json({ success: true, createdEdges, createdTypes, nodesAnalyzed: nodes.length, similarityThreshold });
  } catch (e) {
    console.error('GraphRAG enrich:', e.message);
    res.status(500).json({ error: e.message });
  } finally { await session.close(); await driver.close(); }
});

/**
 * GET /api/kg/graphrag/related/:nodeId
 * BFS 获取指定节点的关联子图
 */
router.get('/graphrag/related/:nodeId', requireAuth, async (req, res) => {
  await initDriver();
  const { default: neo4j } = await import('neo4j-driver');
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { maxConnectionLifetime: 3 * 60 * 60 * 1000, maxConnectionPoolSize: 5 });

  const { nodeId } = req.params;
  const depth = Math.min(parseInt(req.query.depth) || 2, 4);
  const session = driver.session();
  try {
    const seedR = await session.run('MATCH (n:Node {id:$id}) RETURN n', { id: nodeId });
    if (seedR.records.length === 0) return res.status(404).json({ error: '节点不存在' });

    const allEdgesResult = await session.run('MATCH (a:Node)-[r]->(b:Node) RETURN a.id AS from, b.id AS to, type(r) AS type, r.label AS label');
    const allEdges = allEdgesResult.records.map(r => ({
      from: r.get('from'), to: r.get('to'), type: r.get('type'), label: r.get('label') || ''
    }));

    const visitedIds = bfsTraverse([nodeId], allEdges, depth);
    const nodeResult = await session.run(
      'MATCH (n:Node) WHERE n.id IN $ids RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props',
      { ids: [...visitedIds] }
    );
    const subNodes = nodeResult.records.map(r => ({
      id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props')
    }));
    const subEdges = allEdges.filter(e => visitedIds.has(e.from) && visitedIds.has(e.to));

    res.json({
      available: true,
      seed: seedR.records[0].get('n').properties,
      nodes: subNodes,
      edges: subEdges.map(e => ({ from: e.from, to: e.to, type: e.type, label: e.label })),
      depth,
    });
  } catch (e) {
    console.error('GraphRAG related:', e.message);
    res.status(500).json({ error: e.message });
  } finally { await session.close(); await driver.close(); }
});

/**
 * GET /api/kg/graphrag/stats
 * 图统计信息
 */
router.get('/graphrag/stats', requireAuth, async (_req, res) => {
  await initDriver();
  const { default: neo4j } = await import('neo4j-driver');
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { maxConnectionLifetime: 3 * 60 * 60 * 1000, maxConnectionPoolSize: 5 });

  const session = driver.session();
  try {
    const nodeStats = await session.run('MATCH (n:Node) RETURN n.type AS type, count(n) AS count ORDER BY count DESC');
    const edgeStats = await session.run('MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC');
    const totalNodes = await session.run('MATCH (n:Node) RETURN count(n) AS c');
    const totalEdges = await session.run('MATCH ()-[r]->() RETURN count(r) AS c');

    res.json({
      available: true,
      totalNodes: totalNodes.records[0].get('c').toNumber(),
      totalEdges: totalEdges.records[0].get('c').toNumber(),
      nodeTypes: nodeStats.records.map(r => ({ type: r.get('type'), count: r.get('count').toNumber() })),
      edgeTypes: edgeStats.records.map(r => ({ type: r.get('type'), count: r.get('count').toNumber() })),
    });
  } catch (e) {
    res.json({ available: true, error: e.message });
  } finally { await session.close(); await driver.close(); }
});

export default router;
