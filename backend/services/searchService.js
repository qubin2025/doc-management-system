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
