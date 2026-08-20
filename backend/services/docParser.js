/**
 * 迭代5 · 5.3 docParser.js
 *
 * 职责：Node 版文档解析，支持 PDF/DOCX/XLSX/TXT/CSV/JSON/HTML
 * 替代前端 documentParser.ts（依赖浏览器 API: pdfjs-dist Web Worker）
 *
 * 接口：
 *   - parseDocument(buffer, fileName) → Promise<{text, pages?, meta}>
 *   - parsePdf(buffer)     → Promise<ParseResult>
 *   - parseDocx(buffer)   → Promise<ParseResult>
 *   - parseXlsx(buffer)    → Promise<ParseResult>
 *   - parseText(buffer)    → ParseResult
 *   - parseCsv(buffer)     → ParseResult
 *   - parseJson(buffer)    → ParseResult
 *   - parseHtml(buffer)    → ParseResult
 */
import path from 'path';

const logger = {
  info:  (...a) => console.log('[docParser]', new Date().toISOString(), ...a),
  warn:  (...a) => console.warn('[docParser]', new Date().toISOString(), ...a),
  error: (...a) => console.error('[docParser]', new Date().toISOString(), ...a),
  debug: (...a) => { if (process.env.KB_WORKER_DEBUG === '1') console.debug('[docParser]', new Date().toISOString(), ...a); },
};

// ========== 公共辅助 ==========
function cleanText(text) {
  if (!text) return '';
  // 去除控制字符（保留换行）
  return String(text)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[ \t]+/g, ' ')         // 连续空格→1
    .replace(/\n{3,}/g, '\n\n')       // 多空行→2
    .trim();
}

// ========== PDF 解析 ==========
let pdfParse = null;
async function loadPdfParse() {
  if (pdfParse !== null) return pdfParse;
  try {
    const mod = await import('pdf-parse');
    pdfParse = mod.default || mod;
  } catch (e) {
    logger.warn('pdf-parse 加载失败:', e.message);
    pdfParse = false;
  }
  return pdfParse;
}

async function parsePdf(buffer) {
  const fn = await loadPdfParse();
  if (!fn) throw new Error('pdf-parse 未安装，无法解析 PDF');
  try {
    const result = await fn(buffer, { max: 0 });  // 0=无页数限制
    const text = cleanText(result.text);
    return { text, meta: { pages: result.numpages, type: 'pdf' } };
  } catch (e) {
    logger.warn('pdf-parse 解析失败（可能是扫描件）:', e.message);
    // 降级：提示用户用 OCR
    throw new Error(`PDF 解析失败（可能为扫描件，建议用 OCR）: ${e.message}`);
  }
}

// ========== DOCX 解析 ==========
let mammoth = null;
async function loadMammoth() {
  if (mammoth !== null) return mammoth;
  try {
    mammoth = await import('mammoth');
  } catch (e) {
    logger.warn('mammoth 加载失败:', e.message);
    mammoth = false;
  }
  return mammoth;
}

async function parseDocx(buffer) {
  const mod = await loadMammoth();
  if (!mod) throw new Error('mammoth 未安装，无法解析 DOCX');
  const result = await mod.extractRawText({ buffer });
  return { text: cleanText(result.value), meta: { type: 'docx' } };
}

// ========== XLSX/XLS 解析 ==========
let XLSX = null;
async function loadXLSX() {
  if (XLSX !== null) return XLSX;
  try {
    XLSX = await import('xlsx');
  } catch (e) {
    logger.warn('xlsx 加载失败:', e.message);
    XLSX = false;
  }
  return XLSX;
}

async function parseXlsx(buffer) {
  const mod = await loadXLSX();
  if (!mod) throw new Error('xlsx 未安装，无法解析 XLSX');
  const wb = mod.read(buffer, { type: 'buffer' });
  const pages = [];
  const allText = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const csv = mod.utils.sheet_to_csv(sheet);
    pages.push({ sheet: sheetName, text: cleanText(csv) });
    allText.push(`# ${sheetName}\n${csv}`);
  }
  return { text: cleanText(allText.join('\n\n')), pages, meta: { type: 'xlsx', sheets: wb.SheetNames.length } };
}

// ========== 纯文本/Markdown ==========
function parseText(buffer) {
  return { text: cleanText(buffer.toString('utf8')), meta: { type: 'text' } };
}

// ========== CSV ==========
function parseCsv(buffer) {
  const raw = buffer.toString('utf8');
  const lines = raw.split(/\r?\n/);
  const rows = lines.map(l => l.split(','));
  // 转为易检索的文本：表头+每行
  const header = rows[0] || [];
  const text = rows.map((r, i) => (i === 0 ? r.join(' | ') : r.map((c, j) => `${header[j] || j}: ${c}`).join('; ')).join('\n')).join('\n');
  return { text: cleanText(text), meta: { type: 'csv', rows: rows.length } };
}

// ========== JSON ==========
function parseJson(buffer) {
  const raw = buffer.toString('utf8');
  try {
    const obj = JSON.parse(raw);
    return { text: cleanText(JSON.stringify(obj, null, 2)), meta: { type: 'json' } };
  } catch (e) {
    return parseText(buffer);
  }
}

// ========== HTML ==========
function parseHtml(buffer) {
  const raw = buffer.toString('utf8');
  // 去 script/style
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  // 提取标题/段落/列表文本
  const blockTags = /<(p|div|section|article|li|h[1-6]|td|th|caption|dt|dd|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = [];
  let m;
  while ((m = blockTags.exec(cleaned)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text) blocks.push(text);
  }
  // 兜底：全文本
  const allText = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { text: cleanText(blocks.join('\n\n') || allText), meta: { type: 'html' } };
}

// ========== 主入口 ==========
// 5.4 内存保护：解析阶段文件大小预检（防 OOM）
const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB

/**
 * 解析文档为纯文本
 * @param {Buffer} buffer - 文件 Buffer
 * @param {string} fileName - 文件名（含扩展名）
 * @returns {Promise<{text: string, pages?: string[], meta: object}>}
 */
export async function parseDocument(buffer, fileName) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('parseDocument 入参 buffer 必须是 Buffer');
  }
  // 5.4: 文件大小预检（>10MB 抛错，防解析阶段 OOM）
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`文件 ${fileName || ''} 大小 ${(buffer.length / 1024 / 1024).toFixed(1)}MB 超 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB 上限，可能 OOM（建议拆分后上传）`);
  }
  const ext = path.extname(fileName || '').toLowerCase();
  logger.debug(`Parsing ${fileName} (ext=${ext}, size=${buffer.length} bytes)`);
  switch (ext) {
    case '.pdf':
      return await parsePdf(buffer);
    case '.docx':
      return await parseDocx(buffer);
    case '.xlsx':
    case '.xls':
      return await parseXlsx(buffer);
    case '.csv':
      return parseCsv(buffer);
    case '.txt':
    case '.md':
    case '.markdown':
      return parseText(buffer);
    case '.json':
      return parseJson(buffer);
    case '.html':
    case '.htm':
      return parseHtml(buffer);
    default:
      // 兜底：按文本读取
      logger.warn(`Unknown ext ${ext}, fallback to text`);
      return parseText(buffer);
  }
}

// 支持格式查询
export const SUPPORTED_FORMATS = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md', '.markdown', '.json', '.html', '.htm'];

export default { parseDocument, SUPPORTED_FORMATS };
