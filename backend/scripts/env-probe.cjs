/**
 * 迭代5 · 5.0 环境确认调研脚本
 * 功能：
 *   1. 检测 SQLite 所有表名 + 字段
 *   2. 检测 kb_sync_queue 表结构与索引
 *   3. 测试 DashScope 单条嵌入响应
 *   4. 测试 DashScope 批量嵌入响应（10 条）
 *   5. 输出 JSON 报告到 backend/data/env-probe-report.json
 *
 * 用法: node backend/scripts/env-probe.cjs
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const DB_PATH = path.resolve(__dirname, '../data/planning.db');
const ENV_PATH = path.resolve(__dirname, '../.env');
const REPORT_PATH = path.resolve(__dirname, '../data/env-probe-report.json');

// 读取 .env 中的 DASHSCOPE_API_KEY
function loadDashscopeKey() {
  if (!fs.existsSync(ENV_PATH)) return null;
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^DASHSCOPE_API_KEY=(.+)$/);
    if (m && !m[1].includes('your-')) return m[1].trim();
  }
  return null;
}

// ========== 1. SQLite 检测 ==========
function probeSqlite() {
  const result = { dbPath: DB_PATH, exists: false, tables: [], kb_sync_queue: null, vector_embeddings_exists: false };
  if (!fs.existsSync(DB_PATH)) return result;
  result.exists = true;

  const db = new Database(DB_PATH, { readonly: true });
  try {
    // 所有表名
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    result.tables = tables.map(t => {
      const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
      return {
        name: t.name,
        columns: cols.map(c => ({ name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk }))
      };
    });

    // kb_sync_queue 详细信息
    const queueCols = db.prepare('PRAGMA table_info(kb_sync_queue)').all();
    const queueIdx = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='kb_sync_queue'").all();
    const queueCount = db.prepare('SELECT COUNT(*) as cnt FROM kb_sync_queue').get();
    const queueStatusDist = db.prepare("SELECT status, COUNT(*) as cnt FROM kb_sync_queue GROUP BY status").all();
    result.kb_sync_queue = {
      columns: queueCols.map(c => ({ name: c.name, type: c.type, dflt_value: c.dflt_value })),
      indexes: queueIdx.map(i => ({ name: i.name, sql: i.sql })),
      totalRows: queueCount.cnt,
      statusDistribution: queueStatusDist
    };

    // vector_embeddings 是否已存在
    result.vector_embeddings_exists = tables.some(t => t.name === 'vector_embeddings');

    // project_members 检测（迭代4 验证）
    const pmCount = db.prepare('SELECT COUNT(*) as cnt FROM project_members').get();
    result.project_members = { exists: tables.some(t => t.name === 'project_members'), rows: pmCount.cnt };
  } finally {
    db.close();
  }
  return result;
}

// ========== 2. 嵌入服务检测 ==========
async function probeEmbedding() {
  const apiKey = loadDashscopeKey();
  if (!apiKey) {
    return { error: 'DASHSCOPE_API_KEY 未配置', single: null, batch: null };
  }

  const url = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
  const result = { apiKey: apiKey.slice(0, 10) + '***', single: null, batch: null };

  // 2.1 单条嵌入
  try {
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'text-embedding-v1',
        input: { texts: ['工程咨询管理平台嵌入测试'] },
        parameters: { text_type: 'document' }
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    const durationMs = Date.now() - t0;
    if (data.output?.embeddings?.[0]?.embedding) {
      const emb = data.output.embeddings[0].embedding;
      result.single = {
        status: 'ok',
        httpStatus: res.status,
        durationMs,
        dimension: emb.length,
        sample: emb.slice(0, 5).map(v => Number(v.toFixed(6))),
        requestId: data.request_id
      };
    } else {
      result.single = { status: 'fail', httpStatus: res.status, body: JSON.stringify(data).slice(0, 300) };
    }
  } catch (e) {
    result.single = { status: 'error', error: e.message };
  }

  // 2.2 批量嵌入（10 条）
  try {
    const texts = Array.from({ length: 10 }, (_, i) => `批量嵌入测试第 ${i + 1} 条：工程咨询管理平台`);
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'text-embedding-v1',
        input: { texts },
        parameters: { text_type: 'document' }
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    const durationMs = Date.now() - t0;
    if (data.output?.embeddings) {
      const embs = data.output.embeddings;
      result.batch = {
        status: 'ok',
        httpStatus: res.status,
        durationMs,
        count: embs.length,
        dimension: embs[0]?.embedding?.length || 0,
        avgPerItemMs: Math.round(durationMs / embs.length),
        requestId: data.request_id
      };
    } else {
      result.batch = { status: 'fail', httpStatus: res.status, body: JSON.stringify(data).slice(0, 300) };
    }
  } catch (e) {
    result.batch = { status: 'error', error: e.message };
  }

  return result;
}

// ========== 3. 主流程 ==========
async function main() {
  console.log('=== 迭代5 · 5.0 环境确认调研 ===\n');

  // 1. SQLite
  console.log('[1/3] 检测 SQLite...');
  const sqlite = probeSqlite();
  console.log(`  - DB: ${sqlite.dbPath}`);
  console.log(`  - 表总数: ${sqlite.tables.length}`);
  console.log(`  - kb_sync_queue 行数: ${sqlite.kb_sync_queue?.totalRows || 0}`);
  console.log(`  - vector_embeddings 已存在: ${sqlite.vector_embeddings_exists}`);
  console.log(`  - project_members 行数: ${sqlite.project_members?.rows || 0}`);

  // 2. 嵌入服务
  console.log('\n[2/3] 检测嵌入服务（DashScope）...');
  const embedding = await probeEmbedding();
  if (embedding.error) {
    console.log(`  - 错误: ${embedding.error}`);
  } else {
    console.log(`  - 单条: ${embedding.single?.status} (${embedding.single?.durationMs}ms, dim=${embedding.single?.dimension})`);
    console.log(`  - 批量: ${embedding.batch?.status} (${embedding.batch?.durationMs}ms, count=${embedding.batch?.count}, dim=${embedding.batch?.dimension})`);
  }

  // 3. 结论
  console.log('\n[3/3] 生成结论...');
  const conclusion = {
    embedStrategy: embedding.single?.status === 'ok' ? 'direct_dashscope' : 'unavailable',
    vectorStoreStrategy: 'sqlite_table',
    docParserStrategy: 'new_node_module',
    chunkerStrategy: 'reuse_frontend',
    batchSize: embedding.batch?.status === 'ok' ? 10 : 1,
    dimension: embedding.single?.dimension || 0,
    notes: [
      embedding.single?.status === 'ok' ? '单条嵌入可用' : '单条嵌入不可用',
      embedding.batch?.status === 'ok' ? '批量嵌入可用（10 条）' : '批量嵌入不可用',
      sqlite.vector_embeddings_exists ? 'vector_embeddings 已存在（跳过 5.1）' : 'vector_embeddings 不存在（需 5.1 创建）'
    ]
  };
  console.log(`  - 嵌入策略: ${conclusion.embedStrategy}`);
  console.log(`  - 向量维度: ${conclusion.dimension}`);
  console.log(`  - 批量大小: ${conclusion.batchSize}`);

  // 4. 输出报告
  const report = {
    generatedAt: new Date().toISOString(),
    sqlite,
    embedding,
    conclusion
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✓ 报告已输出: ${REPORT_PATH}`);
}

main().catch(e => {
  console.error('调研失败:', e);
  process.exit(1);
});
