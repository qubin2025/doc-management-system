/**
 * Neo4j 知识图谱 API — 离线降级 + 增量同步
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Neo4j driver 懒加载（promise锁防并发）
let neo4j = null;
let driver = null;
let initPromise = null;

async function initDriver() {
  if (driver) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      neo4j = await import('neo4j-driver');
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
      driver = neo4j.default.driver(uri, neo4j.default.auth.basic(user, pwd), {
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 10,
      });
      const s = driver.session();
      try {
        await s.run('RETURN 1');
        await s.run('CREATE CONSTRAINT kg_node_id IF NOT EXISTS FOR (n:Node) REQUIRE n.id IS UNIQUE');
        await s.run('CREATE INDEX kg_node_type IF NOT EXISTS FOR (n:Node) ON (n.type)');
        console.log('✓ Neo4j 知识图谱已连接');
      } finally { await s.close(); }
    } catch {
      console.log('⚠ Neo4j 未连接，知识图谱使用离线模式（localStorage）');
      if (driver) { await driver.close().catch(() => {}); driver = null; }
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

/** GET /api/kg — 获取完整知识图谱 */
router.get('/', requireAuth, async (_req, res) => {
  await initDriver();
  if (!driver) return res.json({ available: false });

  const session = driver.session();
  try {
    const { type } = _req.query;
    let nq = 'MATCH (n:Node)', eq = 'MATCH (a:Node)-[r]->(b:Node)';
    const p = {};
    if (type && type !== 'all') {
      nq += ' WHERE n.type = $type'; eq += ' WHERE a.type = $type OR b.type = $type'; p.type = type;
    }
    nq += ' RETURN n.id AS id, n.type AS type, n.label AS label, n.props AS props';
    eq += ' RETURN a.id AS from, b.id AS to, type(r) AS type, r.label AS label';

    // Neo4j session 不支持并发查询，需要顺序执行
    const nr = await session.run(nq, p);
    const er = await session.run(eq, p);
    res.json({
      available: true,
      nodes: nr.records.map(r => ({ id: r.get('id'), type: r.get('type'), label: r.get('label'), props: r.get('props') })),
      edges: er.records.map(r => ({ from: r.get('from'), to: r.get('to'), type: r.get('type'), label: r.get('label') })),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('KG query:', e.message);
    res.json({ available: true, nodes: [], edges: [], error: e.message });
  } finally { await session.close(); }
});

/** POST /api/kg/sync — 同步节点和边到 Neo4j */
router.post('/sync', requireAuth, async (req, res) => {
  await initDriver();
  if (!driver) return res.status(503).json({ error: 'Neo4j 未配置' });
  const { nodes, edges } = req.body;
  if (!nodes?.length) return res.status(400).json({ error: 'nodes 必填' });

  const s = driver.session();
  const tx = s.beginTransaction();
  try {
    for (const n of nodes) {
      await tx.run('MERGE (n:Node {id: $id}) SET n.type=$type, n.label=$label, n.props=$props',
        { id: n.id, type: n.type || 'unknown', label: n.label || '', props: JSON.stringify(n.props || {}) });
    }
    if (edges?.length) {
      for (const e of edges) {
        const et = (e.type || 'REFERENCES').toUpperCase().replace(/-/g, '_');
        await tx.run(
          `MATCH (a:Node {id:$from}), (b:Node {id:$to}) MERGE (a)-[r:${et}]->(b) SET r.label=$label`,
          { from: e.from, to: e.to, label: e.label || '' });
      }
    }
    await tx.commit();
    res.json({ success: true, count: { nodes: nodes.length, edges: edges?.length || 0 } });
  } catch (e) {
    await tx.rollback();
    res.status(500).json({ error: e.message });
  } finally { await s.close(); }
});

/** DELETE /api/kg/clear */
router.delete('/clear', requireAuth, async (_req, res) => {
  await initDriver();
  if (!driver) return res.status(503).json({ error: 'Neo4j 未配置' });
  const s = driver.session();
  try { await s.run('MATCH (n) DETACH DELETE n'); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

router.delete('/nodes/:id', requireAuth, async (req, res) => {
  await initDriver();
  if (!driver) return res.status(503).json({ error: 'Neo4j 未配置' });
  const s = driver.session();
  try { await s.run('MATCH (n:Node {id: $id}) DETACH DELETE n', { id: req.params.id }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

export default router;
