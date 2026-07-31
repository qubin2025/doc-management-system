/**
 * 附录A法规标准导入Neo4j知识图谱
 * 用法: node scripts/import-standards.js
 * 从appendixA数据中提取法规标准编号, 创建图谱节点
 */
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 法规标准关键词映射 (从appendixA.standard字段提取的标准名称)
const STANDARDS = [
  // 法律法规
  { id: 'law-01', type: 'regulation', label: '中华人民共和国土地管理法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-02', type: 'regulation', label: '中华人民共和国城乡规划法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-03', type: 'regulation', label: '中华人民共和国建筑法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-04', type: 'regulation', label: '中华人民共和国消防法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-05', type: 'regulation', label: '中华人民共和国环境保护法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-06', type: 'regulation', label: '中华人民共和国安全生产法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-07', type: 'regulation', label: '中华人民共和国招标投标法', props: { category: '法律', source: 'appendixA' } },
  { id: 'law-08', type: 'regulation', label: '建设工程质量管理条例', props: { category: '行政法规', source: 'appendixA' } },
  { id: 'law-09', type: 'regulation', label: '建设工程安全生产管理条例', props: { category: '行政法规', source: 'appendixA' } },
  { id: 'law-10', type: 'regulation', label: '建设工程勘察设计管理条例', props: { category: '行政法规', source: 'appendixA' } },
  { id: 'law-11', type: 'regulation', label: '生产安全事故报告和调查处理条例', props: { category: '行政法规', source: 'appendixA' } },
  { id: 'law-12', type: 'regulation', label: '房屋建筑工程和市政基础设施工程竣工验收备案管理暂行办法', props: { category: '部门规章', source: 'appendixA' } },
  { id: 'law-13', type: 'regulation', label: '房屋建筑工程质量保修办法', props: { category: '部门规章', source: 'appendixA' } },
  { id: 'law-14', type: 'regulation', label: '城市建设档案管理规定', props: { category: '部门规章', source: 'appendixA' } },
  { id: 'law-15', type: 'regulation', label: '中华人民共和国国土资源部令第63号', props: { category: '部门规章', source: 'appendixA' } },

  // GB 国家标准
  { id: 'gb-01', type: 'regulation', label: 'GB50300-2013 建筑工程施工质量验收统一标准', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-02', type: 'regulation', label: 'GB50204-2015 混凝土结构工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-03', type: 'regulation', label: 'GB50203-2011 砌体结构工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-04', type: 'regulation', label: 'GB50208-2011 地下防水工程质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-05', type: 'regulation', label: 'GB50210-2018 建筑装饰装修工程质量验收标准', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-06', type: 'regulation', label: 'GB50209-2010 建筑地面工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-07', type: 'regulation', label: 'GB50207-2012 屋面工程质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-08', type: 'regulation', label: 'GB50303-2015 建筑电气工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-09', type: 'regulation', label: 'GB50242-2002 建筑给水排水及采暖工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-10', type: 'regulation', label: 'GB50243-2016 通风与空调工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-11', type: 'regulation', label: 'GB50310-2002 电梯工程施工质量验收规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-12', type: 'regulation', label: 'GB/T50319-2013 建设工程监理规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-13', type: 'regulation', label: 'GB50500-2013 建设工程工程量清单计价规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-14', type: 'regulation', label: 'GB50870-2013 建筑施工安全技术统一规范', props: { category: '国家标准', source: 'appendixA' } },
  { id: 'gb-15', type: 'regulation', label: 'GB/T50502-2009 建筑施工组织设计规范', props: { category: '国家标准', source: 'appendixA' } },

  // JGJ 行业标准
  { id: 'jgj-01', type: 'regulation', label: 'JGJ59-2011 建筑施工安全检查标准', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-02', type: 'regulation', label: 'JGJ130-2011 建筑施工扣件式钢管脚手架安全技术规范', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-03', type: 'regulation', label: 'JGJ80-2016 建筑施工高处作业安全技术规范', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-04', type: 'regulation', label: 'JGJ46-2005 施工现场临时用电安全技术规范', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-05', type: 'regulation', label: 'JGJ33-2012 建筑机械使用安全技术规程', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-06', type: 'regulation', label: 'JGJ160-2016 施工现场机械设备检查技术规范', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-07', type: 'regulation', label: 'JGJ166-2016 建筑施工模板安全技术规范', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-08', type: 'regulation', label: 'JGJ120-2012 建筑基坑支护技术规程', props: { category: '行业标准', source: 'appendixA' } },
  { id: 'jgj-09', type: 'regulation', label: 'JGJ/T185-2009 建筑工程资料管理规程', props: { category: '行业标准', source: 'appendixA' } },

  // DB 地方标准
  { id: 'db-01', type: 'regulation', label: 'DB11/T695-2025 建筑工程资料管理规程', props: { category: '地方标准', source: 'appendixA' } },
  { id: 'db-02', type: 'regulation', label: 'DB11/T808-2020 市政基础设施工程资料管理规程', props: { category: '地方标准', source: 'appendixA' } },
  { id: 'db-03', type: 'regulation', label: 'DB11/T2000-2021 建筑工程施工质量验收规程', props: { category: '地方标准', source: 'appendixA' } },

  // 合同范本
  { id: 'contract-01', type: 'regulation', label: 'GF-2017-0201 建设工程施工合同（示范文本）', props: { category: '合同范本', source: 'appendixA' } },
  { id: 'contract-02', type: 'regulation', label: 'GF-2012-0202 建设工程监理合同（示范文本）', props: { category: '合同范本', source: 'appendixA' } },
];

// 创建引用关系边
const EDGES = [
  { from: 'gb-01', to: 'gb-02', type: 'references', label: 'GB50300引用GB50204混凝土验收' },
  { from: 'gb-01', to: 'gb-03', type: 'references', label: 'GB50300引用GB50203砌体验收' },
  { from: 'gb-01', to: 'db-01', type: 'references', label: 'GB50300引用DB11/T695资料管理' },
  { from: 'jgj-01', to: 'gb-14', type: 'supplements', label: 'JGJ59补充GB50870安全技术' },
  { from: 'jgj-02', to: 'jgj-01', type: 'references', label: '脚手架规范引用安全检查标准' },
  { from: 'jgj-03', to: 'jgj-01', type: 'references', label: '高处作业引用安全检查标准' },
  { from: 'jgj-04', to: 'jgj-01', type: 'references', label: '临时用电引用安全检查标准' },
  { from: 'jgj-07', to: 'jgj-02', type: 'supplements', label: '模板安全补充脚手架规范' },
  { from: 'jgj-08', to: 'gb-14', type: 'references', label: '基坑支护引用安全技术规范' },
  { from: 'gb-15', to: 'gb-01', type: 'references', label: '施工组织设计引用质量验收标准' },
  { from: 'law-01', to: 'law-08', type: 'references', label: '土地管理法引用质量管理条例' },
  { from: 'law-03', to: 'law-08', type: 'references', label: '建筑法引用质量管理条例' },
  { from: 'law-06', to: 'law-09', type: 'references', label: '安全生产法引用安全管理条例' },
  { from: 'contract-01', to: 'gb-05', type: 'references', label: '施工合同引用计价规范' },
  { from: 'jgj-09', to: 'db-01', type: 'SUPERSEDE', label: 'JGJ/T185-2009被DB11/T695-2025废止' },
  { from: 'db-01', to: 'jgj-09', type: 'REPLACE_BY', label: 'DB11/T695-2025替代JGJ/T185-2009' },
];

async function main() {
  try {
    const neo4j = await import('neo4j-driver');
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const pwd = process.env.NEO4J_PASSWORD || 'changeme123';
    const driver = neo4j.default.driver(uri, neo4j.default.auth.basic(user, pwd), { maxConnectionLifetime: 3 * 60 * 60 * 1000, maxConnectionPoolSize: 10 });
    const session = driver.session();

    try {
      await session.run('RETURN 1');
      console.log(`Neo4j connected: ${uri}`);

      // 创建节点
      let nodeCount = 0;
      for (const n of STANDARDS) {
        await session.run(
          'MERGE (n:Node {id: $id}) SET n.type=$type, n.label=$label, n.props=$props',
          { id: n.id, type: n.type, label: n.label, props: JSON.stringify(n.props) }
        );
        nodeCount++;
      }
      console.log(`Nodes created/updated: ${nodeCount}`);

      // 创建边
      let edgeCount = 0;
      for (const e of EDGES) {
        const et = e.type.toUpperCase().replace(/-/g, '_');
        try {
          await session.run(
            `MATCH (a:Node {id:$from}), (b:Node {id:$to}) MERGE (a)-[r:${et}]->(b) SET r.label=$label`,
            { from: e.from, to: e.to, label: e.label }
          );
          edgeCount++;
        } catch { /* skip */ }
      }
      console.log(`Edges created: ${edgeCount}`);

      // 统计
      const count = await session.run('MATCH (n:Node) RETURN count(n) AS c');
      console.log(`Total nodes: ${count.records[0].get('c')}`);
    } finally {
      await session.close();
      await driver.close();
    }
    console.log('Import complete');
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' || e.message?.includes('Cannot find')) {
      console.log('Neo4j driver not installed, skipping import. Install: npm install neo4j-driver');
    } else {
      console.error(`Import failed: ${e.message}`);
      console.log('Is Neo4j running? docker compose -p docmgmt up -d neo4j');
    }
  }
}

main();
