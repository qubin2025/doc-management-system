/**
 * 迭代5.7: 后端语义检索服务
 *
 * 从 vector_embeddings 表读取向量，计算余弦相似度，返回 Top-K 结果。
 * 替代前端 vectorStore.searchAll 的本地余弦相似度计算。
 *
 * 向量存储格式：Buffer.from(new Float32Array(emb).buffer) — BLOB 类型
 * 读取时转回 Float32Array 进行计算
 */
import { getDb } from '../db.js';

const LOG_PREFIX = '[searchService]';
const logger = {
  debug: (...args) => { if (process.env.KB_SEARCH_DEBUG === '1') console.debug(LOG_PREFIX, new Date().toISOString(), ...args); },
  info:  (...args) => console.log(LOG_PREFIX, new Date().toISOString(), ...args),
  warn:  (...args) => console.warn(LOG_PREFIX, new Date().toISOString(), ...args),
  error: (...args) => console.error(LOG_PREFIX, new Date().toISOString(), ...args),
};

/**
 * 将 BLOB (Buffer) 转换为 Float32Array
 * @param {Buffer} buf - SQLite BLOB 字段
 * @param {number} dimension - 期望的维度
 * @returns {Float32Array|null}
 */
function blobToFloat32(buf, dimension) {
  if (!buf || !Buffer.isBuffer(buf)) return null;
  const expectedBytes = dimension * 4;
  if (buf.length !== expectedBytes) {
    logger.warn(`向量维度不匹配: 期望 ${expectedBytes} bytes, 实际 ${buf.length} bytes`);
    return null;
  }
  // Buffer → Float32Array（共享底层 buffer，零拷贝）
  return new Float32Array(buf.buffer, buf.byteOffset, dimension);
}

/**
 * 计算余弦相似度（与前端 vectorStore.cosineSimilarity 逻辑一致）
 * @param {Float32Array} a - 查询向量
 * @param {Float32Array} b - 文档向量
 * @returns {number} 0-1 相似度
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 语义检索 — 从 vector_embeddings 表搜索 Top-K 最相似文档
 * @param {number[]} queryEmbedding - 查询向量
 * @param {object} opts
 * @param {string} [opts.project] - 可选项目名过滤（不传则全项目）
 * @param {number} [opts.topK=10] - 返回结果数
 * @param {number} [opts.maxSensitivity=2] - 用户可访问的最高敏感等级（0=公开,1=内部,2=机密）
 * @returns {Promise<Array<{id,project,docId,docName,chunkIndex,text,score,sensitivity,metadata}>>}
 */
export async function searchVectors(queryEmbedding, opts = {}) {
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error('queryEmbedding 不能为空');
  }
  const topK = Math.min(Math.max(opts.topK || 10, 1), 100);  // 1-100
  const maxSensitivity = opts.maxSensitivity != null ? opts.maxSensitivity : 2;
  const project = opts.project || null;

  const db = getDb();
  const dimension = queryEmbedding.length;
  const queryVec = new Float32Array(queryEmbedding);

  // 1. 查询 vector_embeddings 表（可选项目过滤 + sensitivity 过滤）
  const sql = project
    ? `SELECT id, project, doc_id, doc_name, chunk_index, text, embedding, dimension, sensitivity, metadata
       FROM vector_embeddings
       WHERE project = ? AND dimension = ? AND sensitivity <= ?
       ORDER BY id`
    : `SELECT id, project, doc_id, doc_name, chunk_index, text, embedding, dimension, sensitivity, metadata
       FROM vector_embeddings
       WHERE dimension = ? AND sensitivity <= ?
       ORDER BY id`;
  const params = project ? [project, dimension, maxSensitivity] : [dimension, maxSensitivity];

  const rows = db.prepare(sql).all(...params);
  logger.info(`检索: dim=${dimension}, project=${project || 'all'}, sens<=${maxSensitivity}, candidates=${rows.length}, topK=${topK}`);

  if (rows.length === 0) return [];

  // 2. 计算余弦相似度 + 排序
  const scored = [];
  for (const row of rows) {
    const docVec = blobToFloat32(row.embedding, row.dimension);
    if (!docVec) continue;
    const score = cosineSimilarity(queryVec, docVec);
    let metadata = null;
    try { metadata = JSON.parse(row.metadata || '{}'); } catch {}
    scored.push({
      id: row.id,
      project: row.project,
      docId: row.doc_id,
      docName: row.doc_name,
      chunkIndex: row.chunk_index,
      text: row.text,
      score,
      sensitivity: row.sensitivity,
      metadata,
    });
  }

  // 3. 排序取 Top-K
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  logger.info(`检索完成: ${scored.length} candidates → top ${results.length}, best score=${results[0]?.score?.toFixed(4) || 'N/A'}`);
  return results;
}

/**
 * 获取检索服务统计信息
 */
export function getSearchStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM vector_embeddings').get().c;
  const byProject = db.prepare('SELECT project, COUNT(*) as c FROM vector_embeddings GROUP BY project ORDER BY c DESC').all();
  const bySensitivity = db.prepare('SELECT sensitivity, COUNT(*) as c FROM vector_embeddings GROUP BY sensitivity ORDER BY sensitivity').all();
  return {
    totalVectors: total,
    projects: byProject.reduce((acc, r) => { acc[r.project] = r.c; return acc; }, {}),
    bySensitivity: bySensitivity.reduce((acc, r) => { acc[r.sensitivity] = r.c; return acc; }, {}),
  };
}

// ========== 5.9: BM25 全文检索 + 混合检索 ==========

/**
 * BM25 全文检索 — 使用 SQLite FTS5
 * @param {string} query - 查询文本（会自动分词为 OR 查询）
 * @param {object} opts - project/topK/maxSensitivity
 * @returns {Promise<Array>}
 */
export async function searchBM25(query, opts = {}) {
  if (!query || !query.trim()) return [];
  const topK = Math.min(Math.max(opts.topK || 10, 1), 100);
  const maxSensitivity = opts.maxSensitivity != null ? opts.maxSensitivity : 2;
  const project = opts.project || null;

  const db = getDb();
  // FTS5 查询：trigram 分词器下直接用关键词 OR 连接
  const words = query.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];
  const ftsQuery = words.map(w => w.replace(/['"]/g, ' ')).join(' OR ');

  let rows;
  try {
    rows = db.prepare(`
      SELECT external_id, text, bm25(vector_embeddings_fts) as bm25_score
      FROM vector_embeddings_fts
      WHERE text MATCH ?
      ORDER BY bm25_score
      LIMIT ?
    `).all(ftsQuery, topK * 2);
  } catch (e) {
    logger.warn(`FTS5 查询失败: ${e.message}, ftsQuery="${ftsQuery}"`);
    return [];
  }
  if (rows.length === 0) return [];

  // 从 vector_embeddings 表查询完整数据 + sensitivity 过滤
  const ids = rows.map(r => r.external_id);
  const placeholders = ids.map(() => '?').join(',');
  let sql = `SELECT id, project, doc_id, doc_name, chunk_index, text, sensitivity, metadata FROM vector_embeddings WHERE id IN (${placeholders})`;
  const params = [...ids];
  if (project) { sql += ` AND project = ?`; params.push(project); }
  sql += ` AND sensitivity <= ?`;
  params.push(maxSensitivity);
  const fullRows = db.prepare(sql).all(...params);
  const fullMap = new Map(fullRows.map(r => [r.id, r]));

  // 合并 BM25 score + 归一化（bm25() 返回负数，越小越相关）
  const results = [];
  for (const row of rows) {
    const full = fullMap.get(row.external_id);
    if (!full) continue;
    const bm25Normalized = 1 / (1 + Math.abs(row.bm25_score));
    let metadata = null;
    try { metadata = JSON.parse(full.metadata || '{}'); } catch {}
    results.push({
      id: full.id, project: full.project, docId: full.doc_id,
      docName: full.doc_name, chunkIndex: full.chunk_index, text: full.text,
      score: bm25Normalized, bm25Raw: row.bm25_score,
      sensitivity: full.sensitivity, metadata,
    });
  }
  results.sort((a, b) => b.score - a.score);
  logger.info(`BM25 检索: query="${query}", candidates=${rows.length}, results=${results.length}, best=${results[0]?.score?.toFixed(4) || 'N/A'}`);
  return results.slice(0, topK);
}

/**
 * 混合检索 — 融合向量搜索 + BM25 全文检索
 * @param {number[]} queryEmbedding - 查询向量
 * @param {string} query - 查询文本（用于 BM25）
 * @param {object} opts - alpha(向量权重0-1)/project/topK/maxSensitivity
 * @returns {Promise<Array>}
 */
export async function searchHybrid(queryEmbedding, query, opts = {}) {
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error('queryEmbedding 不能为空');
  }
  const alpha = opts.alpha != null ? Math.min(Math.max(opts.alpha, 0), 1) : 0.7;
  const topK = Math.min(Math.max(opts.topK || 10, 1), 100);

  // 并行执行向量检索 + BM25 检索
  const [vecResults, bm25Results] = await Promise.all([
    searchVectors(queryEmbedding, opts),
    query && query.trim() ? searchBM25(query, opts) : Promise.resolve([]),
  ]);
  logger.info(`混合检索: vec=${vecResults.length}, bm25=${bm25Results.length}, alpha=${alpha}`);

  // 合并结果（加权平均）
  const merged = new Map();
  for (const r of vecResults) {
    merged.set(r.id, { ...r, vecScore: r.score, bm25Score: 0, score: alpha * r.score });
  }
  for (const r of bm25Results) {
    const existing = merged.get(r.id);
    if (existing) {
      existing.bm25Score = r.score;
      existing.score = alpha * existing.vecScore + (1 - alpha) * r.score;
    } else {
      merged.set(r.id, { ...r, vecScore: 0, bm25Score: r.score, score: (1 - alpha) * r.score });
    }
  }

  // 排序取 Top-K
  const results = Array.from(merged.values());
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, topK);
  logger.info(`混合检索完成: merged=${results.length}, top=${top.length}, best score=${top[0]?.score?.toFixed(4) || 'N/A'} (vec=${top[0]?.vecScore?.toFixed(4)}, bm25=${top[0]?.bm25Score?.toFixed(4)})`);
  return top;
}

/**
 * 重建 FTS5 全文索引（从 vector_embeddings 表同步）
 */
export function rebuildFtsIndex() {
  const db = getDb();
  db.exec('DELETE FROM vector_embeddings_fts');
  const rows = db.prepare('SELECT id, text FROM vector_embeddings').all();
  if (rows.length === 0) return { total: 0 };
  const insertFts = db.prepare('INSERT INTO vector_embeddings_fts (text, external_id) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const r of rows) insertFts.run(r.text, r.id);
  });
  tx();
  logger.info(`FTS5 索引重建完成: ${rows.length} 条`);
  return { total: rows.length };
}
