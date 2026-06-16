/**
 * 数据迁移: 项目数据 → Neo4j 知识图谱
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const neo4j = require('../backend/node_modules/neo4j-driver');

const URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PWD  = process.env.NEO4J_PASSWORD || 'changeme123';

const driver = neo4j.default.driver(URI, neo4j.default.auth.basic(USER, PWD));

async function migrate() {
  console.log('🚀 迁移项目数据到 Neo4j...\n');
  const s = driver.session();

  // 清理旧数据
  await s.run('MATCH (n) DETACH DELETE n');

  // 模拟真实数据（实际部署时从 SQLite projects 表读取）
  const projects = [
    { id: 'proj-jianhua', type: 'project', label: '建华中学', props: { createdAt: '2025-05-28' } },
    { id: 'proj-xiaohongmen', type: 'project', label: '小红门调水干线', props: { createdAt: '2025-06-11' } },
    { id: 'proj-6school', type: 'project', label: '六大中心小学', props: { createdAt: '2025-05-29' } },
  ];
  const chapters = [
    { id: 'chapter-ch1', type: 'chapter', label: '第1章 前期工作' },
    { id: 'chapter-ch2', type: 'chapter', label: '第2章 招标采购' },
    { id: 'chapter-ch3', type: 'chapter', label: '第3章 工程施工' },
    { id: 'chapter-ch4', type: 'chapter', label: '第4章 竣工验收' },
  ];
  const forms = [
    { id: 'form-ch1-A1', type: 'form', label: '附表 A.1 项目建议书', ch: 'chapter-ch1' },
    { id: 'form-ch1-A2', type: 'form', label: '附表 A.2 可行性研究报告', ch: 'chapter-ch1' },
    { id: 'form-ch2-B1', type: 'form', label: '附表 B.1 招标方案', ch: 'chapter-ch2' },
    { id: 'form-ch3-C1', type: 'form', label: '附表 C.1 施工组织设计', ch: 'chapter-ch3' },
    { id: 'form-ch4-D1', type: 'form', label: '附表 D.1 竣工验收报告', ch: 'chapter-ch4' },
  ];

  // 插入节点
  const count = { nodes: 0, edges: 0 };
  for (const n of [...projects, ...chapters, ...forms]) {
    await s.run('MERGE (n:Node {id: $id}) SET n.type=$type, n.label=$label, n.props=$props', {
      id: n.id, type: n.type, label: n.label, props: JSON.stringify(n.props || {}),
    });
    count.nodes++;
  }

  // 创建关系: 章节→项目
  for (const p of projects) {
    await s.run('MATCH (a:Node {id: $ch}), (b:Node {id: $proj}) MERGE (a)-[r:BELONGS_TO]->(b) SET r.label="所属项目"', { ch: 'chapter-ch1', proj: p.id });
    count.edges++;
  }

  // 表单→章节
  for (const f of forms) {
    await s.run('MATCH (a:Node {id: $fid}), (b:Node {id: $ch}) MERGE (a)-[r:BELONGS_TO]->(b) SET r.label="所属章节"', { fid: f.id, ch: f.ch });
    count.edges++;
  }

  // 章节间顺序关系
  for (let i = 0; i < chapters.length - 1; i++) {
    await s.run('MATCH (a:Node {id: $c1}), (b:Node {id: $c2}) MERGE (a)-[r:PRECEDES]->(b) SET r.label="前一章"', { c1: chapters[i].id, c2: chapters[i+1].id });
    count.edges++;
  }

  await s.close();
  console.log(`✅ 迁移完成: ${count.nodes} 节点, ${count.edges} 边`);
  console.log('   打开 http://localhost:5173 → 知识图谱 → 查看结果');
  await driver.close();
}

migrate().catch(e => { console.error('❌', e.message); process.exit(1); });
