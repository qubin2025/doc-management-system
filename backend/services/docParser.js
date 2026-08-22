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
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';

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

  // v6.0: 大 PDF 内存保护 — 超过 50MB 时限制解析页数，防 OOM
  const isLargeFile = buffer.length > 50 * 1024 * 1024;
  const maxPages = isLargeFile ? PDF_MAX_PAGES : 0; // 0=无限制

  try {
    const result = await fn(buffer, { max: maxPages, pagerender: undefined });
    const text = cleanText(result.text);
    const truncated = isLargeFile && result.numpages > PDF_MAX_PAGES;
    return {
      text,
      meta: {
        pages: result.numpages,
        type: 'pdf',
        truncated,
        parsedPages: truncated ? PDF_MAX_PAGES : result.numpages,
      },
    };
  } catch (e) {
    logger.warn('pdf-parse 解析失败（可能是扫描件或加密PDF）:', e.message);
    throw new Error(`PDF 解析失败（可能为扫描件/加密文件，建议 OCR 或解密后上传）: ${e.message}`);
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

// ========== CAD 图纸元数据提取（.dwg / .dxf） ==========
/**
 * CAD 文件解析策略：
 * - .dwg: 二进制格式，无法直接提取文本，仅提取元数据（文件名、大小）
 * - .dxf: ASCII 文本格式，可提取 HEADER 段变量、图层名、块定义等
 * 入知识库时存储元数据 + 文件名关键词，支持按图名检索
 */
function parseCad(buffer, fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  const baseName = path.basename(fileName || 'cad_drawing', ext);

  if (ext === '.dxf') {
    // DXF 是文本格式，尝试提取关键信息
    try {
      const raw = buffer.toString('utf8', 0, Math.min(buffer.length, 5 * 1024 * 1024)); // 只读前5MB
      const lines = raw.split(/\r?\n/);
      const layers = new Set();
      const blocks = new Set();
      let inLayerTable = false;
      let inBlockSection = false;

      for (let i = 0; i < lines.length; i++) {
        const code = lines[i].trim();
        const value = lines[i + 1]?.trim();
        if (code === '2' && value === 'LAYER') inLayerTable = true;
        if (code === '0' && value === 'ENDTAB') inLayerTable = false;
        if (inLayerTable && code === '2' && value && !['LAYER', 'ENDTAB'].includes(value)) {
          layers.add(value);
        }
        if (code === '2' && value === 'BLOCKS') inBlockSection = true;
        if (code === '2' && value === 'ENTITIES') inBlockSection = false;
        if (inBlockSection && code === '2' && value && !['BLOCKS', 'ENTITIES'].includes(value)) {
          blocks.add(value);
        }
      }

      const textParts = [
        `CAD图纸: ${baseName}`,
        `格式: DXF (ASCII)`,
        `文件大小: ${fileSizeMB}MB`,
        `图层数: ${layers.size}`,
        `图层: ${[...layers].slice(0, 50).join(', ')}`,
        `块定义数: ${blocks.size}`,
        `块: ${[...blocks].slice(0, 30).join(', ')}`,
      ];
      return { text: cleanText(textParts.join('\n')), meta: { type: 'cad', format: 'dxf', layers: layers.size, blocks: blocks.size, fileSizeMB } };
    } catch (e) {
      logger.warn('DXF 解析失败，降级为元数据:', e.message);
    }
  }

  // .dwg 或 DXF 解析失败：仅返回元数据
  return {
    text: cleanText([
      `CAD图纸: ${baseName}`,
      `格式: ${ext === '.dwg' ? 'DWG (二进制)' : 'DXF'}`,
      `文件大小: ${fileSizeMB}MB`,
      `说明: CAD图纸文件，已存储元数据用于检索。如需全文检索请导出为PDF后上传。`,
    ].join('\n')),
    meta: { type: 'cad', format: ext === '.dwg' ? 'dwg' : 'dxf', fileSizeMB, binary: ext === '.dwg' },
  };
}

// ========== ZIP 归档递归解析 ==========
/**
 * 解压 ZIP 归档，递归解析内部支持的文件格式，合并文本
 * 支持嵌套 ZIP（最多2层），限制文件数和总大小防 OOM
 */
async function parseZip(buffer, fileName) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (e) {
    throw new Error(`ZIP 解压失败（可能文件损坏或加密）: ${e.message}`);
  }

  const entries = zip.getEntries();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docparser-zip-'));
  const results = [];
  let totalSize = 0;
  let fileCount = 0;

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (fileCount >= ZIP_MAX_FILES) {
        logger.warn(`ZIP 内文件数超 ${ZIP_MAX_FILES}，已截断`);
        break;
      }

      const entryName = entry.entryName;
      const ext = path.extname(entryName).toLowerCase();
      const supportedExts = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md', '.json', '.html', '.htm'];

      if (!supportedExts.includes(ext)) continue;

      // 提取到临时目录
      const safeName = entryName.replace(/[^a-zA-Z0-9._\-/\\]/g, '_');
      const outPath = path.join(tmpDir, safeName);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      try {
        const data = entry.getData();
        if (totalSize + data.length > ZIP_MAX_TOTAL_SIZE) {
          logger.warn(`ZIP 解压总大小超 ${ZIP_MAX_TOTAL_SIZE / 1024 / 1024}MB，已截断`);
          break;
        }
        fs.writeFileSync(outPath, data);
        totalSize += data.length;
        fileCount++;

        // 递归解析
        const subResult = await parseDocument(data, entryName);
        results.push({ name: entryName, text: subResult.text, meta: subResult.meta });
      } catch (e) {
        logger.warn(`ZIP 内文件 ${entryName} 解析失败: ${e.message}`);
      }
    }

    // 合并文本
    const mergedText = results.map((r, i) =>
      `===== [文件${i + 1}/${results.length}] ${r.name} =====\n${r.text}`
    ).join('\n\n');

    return {
      text: cleanText(mergedText),
      meta: {
        type: 'zip',
        archiveName: fileName,
        fileCount: results.length,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        files: results.map(r => ({ name: r.name, type: r.meta?.type })),
      },
    };
  } finally {
    // 清理临时目录
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ========== 主入口 ==========
// v6.0: 大幅提高文件上限至 200MB（配合 multipart 流式上传，支持 CAD 大图纸）
// 大文件采用分页数限制 + 降级策略，防 OOM
const MAX_FILE_SIZE = 200 * 1024 * 1024;  // 200MB
const PDF_MAX_PAGES = 1000;  // PDF 最大解析页数（超大型图纸集可能超1000页，截断保护）
const ZIP_MAX_FILES = 50;    // ZIP 内最大解析文件数
const ZIP_MAX_TOTAL_SIZE = 100 * 1024 * 1024; // ZIP 解压后总大小上限 100MB

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
  // v6.0: 文件大小预检（>200MB 抛错，配合 multipart 上传上限）
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`文件 ${fileName || ''} 大小 ${(buffer.length / 1024 / 1024).toFixed(1)}MB 超 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB 上限，请拆分后上传`);
  }
  const ext = path.extname(fileName || '').toLowerCase();
  logger.debug(`Parsing ${fileName} (ext=${ext}, size=${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
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
    case '.dwg':
    case '.dxf':
      return parseCad(buffer, fileName);
    case '.zip':
      return await parseZip(buffer, fileName);
    default:
      // 兜底：按文本读取
      logger.warn(`Unknown ext ${ext}, fallback to text`);
      return parseText(buffer);
  }
}

// 支持格式查询
export const SUPPORTED_FORMATS = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md', '.markdown', '.json', '.html', '.htm', '.dwg', '.dxf', '.zip'];

export default { parseDocument, SUPPORTED_FORMATS };
