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

// ========== 配置 ==========
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const MODEL = 'text-embedding-v1';
const BATCH_SIZE = 25;          // DashScope 每批上限
const MAX_CONCURRENT = 3;       // 最大并发数
const TIMEOUT_MS = 30000;       // 单批超时 30s
const MAX_RETRIES = 3;          // 重试次数
const EMBEDDING_DIM = 1536;      // text-embedding-v1 维度

// 日志器
const logger = {
  info:  (...a) => console.log('[embed]', new Date().toISOString(), ...a),
  warn:  (...a) => console.warn('[embed]', new Date().toISOString(), ...a),
  error: (...a) => console.error('[embed]', new Date().toISOString(), ...a),
  debug: (...a) => { if (process.env.KB_WORKER_DEBUG === '1') console.debug('[embed]', new Date().toISOString(), ...a); },
};

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
  const embeddings = await embedBatchWithRetry([text], textType);
  return embeddings[0];
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

  // 分批（每 BATCH_SIZE 条）
  const batches = [];
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    batches.push(valid.slice(i, i + BATCH_SIZE));
  }
  logger.debug(`Embedding ${valid.length} texts in ${batches.length} batch(es), concurrency=${MAX_CONCURRENT}`);

  // 并发执行（每批一次 embedBatchWithRetry）
  const batchTasks = batches.map(b => embedBatchWithRetry(b.map(x => x.text), textType));
  const batchResults = await runWithConcurrency(batchTasks, MAX_CONCURRENT);

  // 合并结果
  const finalResults = new Array(texts.length).fill(null);
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
      }
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

export const config = { MODEL, BATCH_SIZE, MAX_CONCURRENT, TIMEOUT_MS, MAX_RETRIES, EMBEDDING_DIM };
export default { embedText, embedBatch, checkEmbeddingService, config };
