/**
 * 迭代5 · 5.3 chunker.js
 *
 * 职责：文本智能分块（从前端 src/data/chunker.ts 转换为 Node.js 模块）
 *
 * 三种策略：
 *   - fixed:    固定窗口（默认 size=500, overlap=50）
 *   - semantic: 语义分块（按段落/标题，minSize=200）
 *   - table:    表格分块（保留完整表格）
 *
 * 接口：
 *   - chunk(text, opts?) → Chunk[]
 *   - Chunk = { text, index, startChar, endChar, meta? }
 */

// ========== 类型/常量 ==========
const DEFAULTS = {
  strategy: 'fixed',
  size: 500,        // 单块最大字符数
  overlap: 50,      // 重叠字符数（fixed 策略）
  minSize: 200,     // 最小块大小（semantic 策略）
  maxTokens: 2048,  // DashScope 单条文本上限（tokens ≈ 字符/1.5）
};

// ========== 辅助 ==========
function estimateTokens(text) {
  // 粗略估算：中文 1 字 ≈ 1 token，英文 1 词 ≈ 1.3 tokens
  // 简单按 字符数 / 1.5 估算
  return Math.ceil(text.length / 1.5);
}

// ========== 固定窗口分块 ==========
function chunkFixed(text, opts) {
  const size = opts.size || DEFAULTS.size;
  const overlap = Math.min(opts.overlap || DEFAULTS.overlap, Math.floor(size / 2));
  const maxTokens = opts.maxTokens || DEFAULTS.maxTokens;
  // 实际 size 受 maxTokens 限制（字符/1.5 ≤ tokens）
  const effectiveSize = Math.min(size, Math.floor(maxTokens * 1.5));

  const chunks = [];
  let start = 0;
  let idx = 0;
  while (start < text.length) {
    const end = Math.min(start + effectiveSize, text.length);
    const piece = text.slice(start, end);
    if (piece.trim().length > 0) {
      chunks.push({ text: piece.trim(), index: idx, startChar: start, endChar: end });
      idx++;
    }
    if (end >= text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
    // 防止死循环（overlap=0 时）
    if (overlap === 0 && start === end) break;
  }
  return chunks;
}

// ========== 语义分块（按段落/标题） ==========
function chunkSemantic(text, opts) {
  const minSize = opts.minSize || DEFAULTS.minSize;
  const maxTokens = opts.maxTokens || DEFAULTS.maxTokens;
  const maxSize = Math.floor(maxTokens * 1.5);

  // 按空行分段
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  let bufStart = 0;
  let idx = 0;

  function flush(endChar) {
    if (buf.trim().length > 0) {
      // 超长段落再切
      if (buf.length > maxSize) {
        const sub = chunkFixed(buf, { ...opts, size: maxSize, overlap: 0 });
        for (const s of sub) {
          chunks.push({ text: s.text, index: idx, startChar: bufStart + s.startChar, endChar: bufStart + s.endChar });
          idx++;
        }
      } else {
        chunks.push({ text: buf.trim(), index: idx, startChar: bufStart, endChar: endChar });
        idx++;
      }
    }
    buf = '';
  }

  let cursor = 0;
  for (const para of paragraphs) {
    const paraStart = text.indexOf(para, cursor);
    const paraEnd = paraStart + para.length;
    cursor = paraEnd;
    if (buf.length + para.length + 2 > maxSize && buf.length >= minSize) {
      flush(paraStart);
      bufStart = paraStart;
    } else if (buf.length === 0) {
      bufStart = paraStart;
    }
    buf = buf ? `${buf}\n\n${para}` : para;
  }
  flush(text.length);
  return chunks;
}

// ========== 表格分块 ==========
function chunkTable(text, opts) {
  // 检测表格（Markdown 表格 / CSV 段）
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let buf = [];
  let inTable = false;
  let tableStart = 0;
  let idx = 0;
  let charCursor = 0;

  function flushTo(endLine) {
    if (buf.length === 0) return;
    const piece = buf.join('\n');
    if (piece.trim().length > 0) {
      chunks.push({ text: piece.trim(), index: idx, startChar: tableStart, endChar: charCursor, meta: { type: inTable ? 'table' : 'text' } });
      idx++;
    }
    buf = [];
  }

  for (const line of lines) {
    const isTableRow = /^\s*\|.*\|\s*$/.test(line) || /^\s*,.*,.*$/.test(line) || line.trim().startsWith('|');
    if (isTableRow && !inTable) {
      // 进入表格
      flushTo(charCursor);
      inTable = true;
      tableStart = charCursor;
    } else if (!isTableRow && inTable) {
      // 退出表格
      flushTo(charCursor);
      inTable = false;
      tableStart = charCursor;
    }
    buf.push(line);
    charCursor += line.length + 1;  // +1 for newline
  }
  flushTo(charCursor);
  return chunks;
}

// ========== 主入口 ==========
/**
 * 文本分块
 * @param {string} text - 原文
 * @param {object} opts - { strategy:'fixed'|'semantic'|'table', size, overlap, minSize, maxTokens }
 * @returns {Array<{text, index, startChar, endChar, meta?}>}
 */
export function chunk(text, opts = {}) {
  if (!text || !text.trim()) return [];
  const strategy = opts.strategy || DEFAULTS.strategy;
  switch (strategy) {
    case 'fixed':
      return chunkFixed(text, opts);
    case 'semantic':
      return chunkSemantic(text, opts);
    case 'table':
      return chunkTable(text, opts);
    default:
      return chunkFixed(text, opts);
  }
}

/**
 * 计算分块数（估算）
 */
export function estimateChunkCount(textLength, opts = {}) {
  const size = (opts.size || DEFAULTS.size);
  const overlap = Math.min(opts.overlap || DEFAULTS.overlap, Math.floor(size / 2));
  const step = size - overlap;
  if (step <= 0) return 1;
  return Math.max(1, Math.ceil(textLength / step));
}

export { estimateTokens };
export default { chunk, estimateChunkCount, estimateTokens };
