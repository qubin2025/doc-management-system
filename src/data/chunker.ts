/**
 * 文本智能分块引擎 — 用于 RAG 向量检索
 * 支持按段落、句子、固定Token三种策略
 */

export interface TextChunk {
  text: string;
  index: number;
  start: number;
  end: number;
  metadata?: Record<string, string>;
}

/** 按段落分块（推荐用于结构化文档） */
export function chunkByParagraph(text: string, maxChunkSize = 2000, overlap = 200): TextChunk[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: TextChunk[] = [];
  let current = '';
  let idx = 0;
  let pos = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p) continue;

    if ((current + p).length > maxChunkSize && current) {
      const overlapText = overlap > 0 ? current.slice(-overlap) : '';
      chunks.push({ text: current.trim(), index: idx++, start: pos - current.length, end: pos });
      current = overlapText + '\n' + p;
    } else {
      current += (current ? '\n' : '') + p;
    }
    pos += p.length + 2;
  }
  if (current.trim()) chunks.push({ text: current.trim(), index: idx, start: pos - current.length, end: pos });
  return chunks;
}

/** 按句子分块（推荐用于非结构化文本） */
export function chunkBySentence(text: string, maxChunkSize = 1500, overlap = 100): TextChunk[] {
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?]?/g) || [text];
  const chunks: TextChunk[] = [];
  let current = '';
  let idx = 0;
  let pos = 0;

  for (const s of sentences) {
    if ((current + s).length > maxChunkSize && current) {
      const overlapText = overlap > 0 ? current.slice(-overlap) : '';
      chunks.push({ text: current.trim(), index: idx++, start: pos - current.length, end: pos });
      current = overlapText + s;
    } else {
      current += s;
    }
    pos += s.length;
  }
  if (current.trim()) chunks.push({ text: current.trim(), index: idx, start: pos - current.length, end: pos });
  return chunks;
}

/** 按固定Token分块（推荐用于API有Token限制） */
export function chunkByToken(text: string, maxTokens = 500): TextChunk[] {
  // 粗略估算: 中文每字符≈1 token, 英文每4字符≈1 token
  const estimateTokens = (s: string) => {
    const cn = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = s.length - cn;
    return cn + Math.ceil(en / 4);
  };

  const words = text.split(/(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff])|\s+/);
  const chunks: TextChunk[] = [];
  let current = '';
  let idx = 0;
  let pos = 0;

  for (const w of words) {
    if (estimateTokens(current + w) > maxTokens && current) {
      chunks.push({ text: current.trim(), index: idx++, start: pos - current.length, end: pos });
      current = w;
    } else {
      current += (current && !/[\u4e00-\u9fff]/.test(w[0] || '') ? ' ' : '') + w;
    }
    pos += w.length;
  }
  if (current.trim()) chunks.push({ text: current.trim(), index: idx, start: pos - current.length, end: pos });
  return chunks;
}

/** 自动检测文档类型并选择最佳分块策略 */
export function autoChunk(text: string, maxChunkSize = 2000): TextChunk[] {
  const hasParagraphs = text.split(/\n\s*\n/).length > 3;
  return hasParagraphs ? chunkByParagraph(text, maxChunkSize) : chunkBySentence(text, maxChunkSize);
}
