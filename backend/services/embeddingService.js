/**
 * 迭代5 · 5.3 embeddingService.js
 *
 * 职责：封装 DashScope text-embedding-v1 批量嵌入接口
 *
 * 特性：
 *   - 批量分片：每 25 条/批（DashScope 上限）
 *   - 并发控制：并发=3（避免 429）
 *   - 超时：单批 30s
 *   - 重试：429 指数退避（1s, 2s, 4s）
 *   - 降级：单批失败时降级为逐条嵌入
 *
 * 接口：
 *   - embedText(text, textType='document')  → Promise<number[]>
 *   - embedBatch(texts, textType='document') → Promise<number[][]>
 */
import { Buffer } from 'buffer';
import crypto from 'crypto';
import { getDb } from '../db.js';

// ========== 配置 ==========
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const MODEL = 'text-embedding-v1';
const BATCH_SIZE = 25;          // DashScope 每批上限
const MAX_CONCURRENT = 3;       // 最大并发数
const TIMEOUT_MS = 30000;       // 单批超时 30s
const MAX_RETRIES = 3;          // 重试次数
const EMBEDDING_DIM = 1536;      // text-embedding-v1 维度

// 5.8: Embedding 缓存开关（默认开启，环境变量 KB_EMBEDDING_CACHE=0 可关闭）
const CACHE_ENABLED = process.env.KB_EMBEDDING_CACHE !== '0';

// 日志器
const logger = {
  info:  (...a) => console.log('[embed]', new Date().toISOString(), ...a),
  warn:  (...a) => console.warn('[embed]', new Date().toISOString(), ...a),
  error: (...a) => console.error('[embed]', new Date().toISOString(), ...a),
  debug: (...a) => { if (process.env.KB_WORKER_DEBUG === '1') console.debug('[embed]', new Date().toISOString(), ...a); },
};

// ========== 5.8 Embedding 缓存 ==========

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function getCacheKey(text, textType) {
  return sha256(text + '|' + textType + '|' + MODEL);
}

/**
 * 查询缓存中的 embedding
 * @returns {number[]|null} — 命中返回向量数组，未命中返回 null
 */
function getCachedEmbedding(cacheKey) {
  if (!CACHE_ENABLED) return null;
  try {
    const db = getDb();
    const row = db.prepare('SELECT embedding, dimension, hit_count FROM embedding_cache WHERE cache_key = ?').get(cacheKey);
    if (!row) return null;
    const buf = Buffer.from(row.embedding);
    const dim = row.dimension;
    if (buf.length !== dim * 4) {
      logger.warn(`缓存向量维度不匹配: ${buf.length} bytes vs dim=${dim}`);
      return null;
    }
    const float32 = new Float32Array(buf.buffer, buf.byteOffset, dim);
    // 转为普通数组返回
    const arr = new Array(dim);
    for (let i = 0; i < dim; i++) arr[i] = float32[i];
    // 异步更新 hit_count 和 last_hit_at（不阻塞）
    db.prepare("UPDATE embedding_cache SET hit_count = hit_count + 1, last_hit_at = datetime('now') WHERE cache_key = ?").run(cacheKey);
    return arr;
  } catch (e) {
    logger.warn(`缓存查询失败: ${e.message}`);
    return null;
  }
}

/**
 * 批量查询缓存
 * @param {Array<{text, idx, cacheKey}>} items
 * @returns {Map<number, number[]>} — idx → embedding
 */
function batchGetCachedEmbeddings(items) {
  const hits = new Map();
  if (!CACHE_ENABLED || items.length === 0) return hits;
  try {
    const db = getDb();
    const placeholders = items.map(() => '?').join(',');
    const keys = items.map(it => it.cacheKey);
    const rows = db.prepare(`SELECT cache_key, embedding, dimension FROM embedding_cache WHERE cache_key IN (${placeholders})`).all(...keys);
    const keyToItem = new Map(items.map(it => [it.cacheKey, it]));
    const now = new Date().toISOString();
    const updateStmt = db.prepare("UPDATE embedding_cache SET hit_count = hit_count + 1, last_hit_at = datetime('now') WHERE cache_key = ?");
    for (const row of rows) {
      const it = keyToItem.get(row.cache_key);
      if (!it) continue;
      const buf = Buffer.from(row.embedding);
      const dim = row.dimension;
      if (buf.length !== dim * 4) continue;
      const float32 = new Float32Array(buf.buffer, buf.byteOffset, dim);
      const arr = new Array(dim);
      for (let i = 0; i < dim; i++) arr[i] = float32[i];
      hits.set(it.idx, arr);
    }
    // 批量更新 hit_count（事务）
    if (rows.length > 0) {
      const tx = db.transaction((keysToUpdate) => {
        for (const k of keysToUpdate) updateStmt.run(k);
      });
      tx(rows.map(r => r.cache_key));
    }
  } catch (e) {
    logger.warn(`批量缓存查询失败: ${e.message}`);
  }
  return hits;
}

/**
 * 存入缓存
 */
function setCachedEmbedding(text, textType, embedding) {
  if (!CACHE_ENABLED || !embedding || embedding.length === 0) return;
  try {
    const db = getDb();
    const cacheKey = getCacheKey(text, textType);
    const textHash = sha256(text);
    const buf = Buffer.from(new Float32Array(embedding).buffer);
    db.prepare(
      `INSERT OR REPLACE INTO embedding_cache (cache_key, text_hash, text_type, model, embedding, dimension, hit_count, created_at, last_hit_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), NULL)`
    ).run(cacheKey, textHash, textType, MODEL, buf, embedding.length);
  } catch (e) {
    logger.warn(`缓存存入失败: ${e.message}`);
  }
}

/**
 * 批量存入缓存
 */
function batchSetCachedEmbeddings(items, embeddings, textType) {
  if (!CACHE_ENABLED || items.length === 0) return;
  try {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO embedding_cache (cache_key, text_hash, text_type, model, embedding, dimension, hit_count, created_at, last_hit_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), NULL)`
    );
    const tx = db.transaction(() => {
      for (let i = 0; i < items.length; i++) {
        const emb = embeddings[i];
        if (!emb || emb.length === 0) continue;
        const it = items[i];
        const buf = Buffer.from(new Float32Array(emb).buffer);
        stmt.run(it.cacheKey, it.textHash, textType, MODEL, buf, emb.length);
      }
    });
    tx();
  } catch (e) {
    logger.warn(`批量缓存存入失败: ${e.message}`);
  }
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  try {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as c FROM embedding_cache').get().c;
    const totalHits = db.prepare('SELECT COALESCE(SUM(hit_count), 0) as s FROM embedding_cache').get().s;
    const byType = db.prepare('SELECT text_type, COUNT(*) as c FROM embedding_cache GROUP BY text_type').all();
    const recentlyUsed = db.prepare("SELECT COUNT(*) as c FROM embedding_cache WHERE last_hit_at IS NOT NULL").get().c;
    const oldestAt = db.prepare('SELECT MIN(created_at) as d FROM embedding_cache').get().d;
    return {
      enabled: CACHE_ENABLED,
      totalCached: total,
      totalHits,
      recentlyUsed,
      oldestAt,
      byType: byType.reduce((acc, r) => { acc[r.text_type] = r.c; return acc; }, {}),
    };
  } catch (e) {
    return { enabled: CACHE_ENABLED, error: e.message };
  }
}

/**
 * 清空缓存
 */
export function clearCache() {
  const db = getDb();
  const r = db.prepare('DELETE FROM embedding_cache').run();
  logger.info(`缓存已清空: ${r.changes} 条`);
  return { deleted: r.changes };
}

/**
 * 清理长期未使用的缓存（默认 30 天）
 */
export function pruneCache(daysOld = 30) {
  const db = getDb();
  const r = db.prepare(
    `DELETE FROM embedding_cache WHERE last_hit_at IS NULL AND created_at < datetime('now', ?)`
  ).run(`-${daysOld} days`);
  const r2 = db.prepare(
    `DELETE FROM embedding_cache WHERE last_hit_at IS NOT NULL AND last_hit_at < datetime('now', ?)`
  ).run(`-${daysOld} days`);
  logger.info(`缓存清理: 未使用 ${r.changes} 条, 过期 ${r2.changes} 条`);
  return { unused: r.changes, expired: r2.changes };
}

function getApiKey() {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key || key.includes('your-')) {
    throw new Error('DASHSCOPE_API_KEY 未配置，请检查 backend/.env');
  }
  return key;
}

// ========== 单批嵌入（内部） ==========
async function embedBatchOnce(texts, textType) {
  const apiKey = getApiKey();
  const body = JSON.stringify({
    model: MODEL,
    input: { texts },
    parameters: { text_type: textType },
  });
  const res = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`DashScope HTTP ${res.status}: ${data.message || data.code || JSON.stringify(data).slice(0, 200)}`);
    err.httpStatus = res.status;
    err.code = data.code;
    throw err;
  }
  if (!data.output?.embeddings) {
    throw new Error('DashScope 响应缺少 output.embeddings');
  }
  return data.output.embeddings.map(e => e.embedding);
}

// ========== 带重试的单批嵌入 ==========
async function embedBatchWithRetry(texts, textType) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await embedBatchOnce(texts, textType);
    } catch (err) {
      lastErr = err;
      const isThrottled = err.httpStatus === 429 || err.code === 'Throttling';
      if (!isThrottled && err.httpStatus && err.httpStatus < 500 && err.httpStatus !== 429) {
        // 非限流类错误（400/401），不重试
        throw err;
      }
      if (attempt === MAX_RETRIES) {
        logger.warn(`Batch failed after ${MAX_RETRIES} retries: ${err.message}`);
        throw err;
      }
      const delayMs = Math.pow(2, attempt - 1) * 1000;  // 1s, 2s, 4s
      logger.warn(`Retry ${attempt}/${MAX_RETRIES} after ${delayMs}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ========== 并发控制辅助 ==========
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      try {
        results[idx] = { ok: true, value: await tasks[idx] };
      } catch (err) {
        results[idx] = { ok: false, err };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ========== 公开 API ==========

/**
 * 单条文本嵌入
 * @param {string} text - 文本内容（≤2048 tokens）
 * @param {'document'|'query'} textType - 索引用 document, 查询用 query
 * @returns {Promise<number[]>} 1536 维向量
 */
export async function embedText(text, textType = 'document') {
  if (!text || !text.trim()) {
    throw new Error('嵌入文本不能为空');
  }
  // 5.8: 先查缓存
  if (CACHE_ENABLED) {
    const cacheKey = getCacheKey(text, textType);
    const cached = getCachedEmbedding(cacheKey);
    if (cached) {
      logger.debug(`缓存命中: ${cacheKey.slice(0, 16)}...`);
      return cached;
    }
  }
  // 未命中：调用 API
  const embeddings = await embedBatchWithRetry([text], textType);
  const result = embeddings[0];
  // 存入缓存
  setCachedEmbedding(text, textType, result);
  return result;
}

/**
 * 批量嵌入（核心 API）
 * @param {string[]} texts - 文本数组（无上限，内部自动分批）
 * @param {'document'|'query'} textType
 * @returns {Promise<number[][]>} 与 texts 顺序对齐的向量数组
 */
export async function embedBatch(texts, textType = 'document') {
  if (!texts || texts.length === 0) return [];

  // 过滤空文本（保留索引位置，返回 null）
  const indexed = texts.map((t, i) => ({ text: t, idx: i }));
  const valid = indexed.filter(x => x.text && x.text.trim().length > 0);
  if (valid.length === 0) return texts.map(() => null);

  // 5.8: 批量查缓存
  const validWithKey = valid.map(v => ({ ...v, cacheKey: getCacheKey(v.text, textType), textHash: sha256(v.text) }));
  const cacheHits = batchGetCachedEmbeddings(validWithKey);
  if (cacheHits.size > 0) logger.info(`缓存命中 ${cacheHits.size}/${valid.length}`);

  // 未命中的文本需要调用 API
  const missed = validWithKey.filter(v => !cacheHits.has(v.idx));
  const finalResults = new Array(texts.length).fill(null);

  // 放入缓存命中的结果
  for (const [idx, emb] of cacheHits) {
    finalResults[idx] = emb;
  }

  if (missed.length > 0) {
    // 分批（每 BATCH_SIZE 条）
    const batches = [];
    for (let i = 0; i < missed.length; i += BATCH_SIZE) {
      batches.push(missed.slice(i, i + BATCH_SIZE));
    }
    logger.debug(`Embedding ${missed.length} missed texts in ${batches.length} batch(es), concurrency=${MAX_CONCURRENT}`);

    // 并发执行（每批一次 embedBatchWithRetry）
    const batchTasks = batches.map(b => embedBatchWithRetry(b.map(x => x.text), textType));
    const batchResults = await runWithConcurrency(batchTasks, MAX_CONCURRENT);

    // 合并结果 + 批量存入缓存
    const cacheItems = [];
    const cacheEmbeddings = [];
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const result = batchResults[bi];
      if (!result.ok) {
        // 批失败 → 降级为逐条嵌入
        logger.warn(`Batch ${bi + 1} failed (${result.err.message}), falling back to single embed`);
        for (const item of batch) {
          try {
            const emb = await embedText(item.text, textType);
            finalResults[item.idx] = emb;
          } catch (e) {
            logger.error(`Single embed failed for idx=${item.idx}: ${e.message}`);
            finalResults[item.idx] = null;
          }
        }
      } else {
        const embs = result.value;
        for (let j = 0; j < batch.length; j++) {
          finalResults[batch[j].idx] = embs[j];
          cacheItems.push(batch[j]);
          cacheEmbeddings.push(embs[j]);
        }
      }
    }
    // 批量存入缓存
    if (cacheItems.length > 0) {
      batchSetCachedEmbeddings(cacheItems, cacheEmbeddings, textType);
      logger.info(`缓存存入 ${cacheItems.length} 条`);
    }
  }
  return finalResults;
}

// ========== 健康检查 ==========
export async function checkEmbeddingService() {
  try {
    const emb = await embedText('健康检查测试', 'query');
    return {
      ok: true,
      dimension: emb.length,
      model: MODEL,
      message: `DashScope 嵌入服务可用（维度 ${emb.length}）`,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const config = { MODEL, BATCH_SIZE, MAX_CONCURRENT, TIMEOUT_MS, MAX_RETRIES, EMBEDDING_DIM, CACHE_ENABLED };
export default { embedText, embedBatch, checkEmbeddingService, getCacheStats, clearCache, pruneCache, config };
