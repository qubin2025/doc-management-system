/**
 * 全局文档解析器 — v2.5.0 PaddleOCR 统一方案
 * 所有文件上传统一调用 PaddleOCR 解析服务 (localhost:8001)
 *
 * 覆盖: PDF(文字+扫描件) | DOC | DOCX | XLS | XLSX | PNG/JPG/BMP | TXT/CSV
 * 降级: PaddleOCR不可用时 → pdfjs + mammoth + xlsx + AI Vision
 *
 * v5.6: 增加 onProgress 回调,分阶段进度反馈
 * 阶段: 1.read(0-15%) → 2.encode(15-25%) → 3.transfer(25-45%) → 4.parse(45-90%) → 5.done(100%)
 */

import * as api from './api';

const PADDLE_API = 'http://localhost:8001/api/parse/document';
const PADDLE_HEALTH = 'http://localhost:8001/api/parse/health';

let _paddleAvailable: boolean | null = null;

/** 进度回调类型 */
export type ParseProgress = {
  stage: 'read' | 'encode' | 'transfer' | 'parse' | 'done' | 'error';
  percent: number;        // 0-100
  message: string;         // 阶段描述
  elapsedMs?: number;     // 已耗时
};
export type ProgressCallback = (p: ParseProgress) => void;

/** 检测PaddleOCR服务是否可用（带缓存+刷新机制） */
let _paddleLastCheck = 0;
const PADDLE_CACHE_TTL = 15000; // 15秒缓存
async function checkPaddleHealth(): Promise<boolean> {
  const now = Date.now();
  // 强制刷新:缓存过期 或 上次结果为 false(以便检测服务后来启动)
  if (_paddleAvailable !== null && now - _paddleLastCheck < PADDLE_CACHE_TTL) return _paddleAvailable;
  if (_paddleAvailable === false && now - _paddleLastCheck < 5000) return false; // false时5秒重试
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(PADDLE_HEALTH, { signal: ctrl.signal });
    clearTimeout(timer);
    _paddleAvailable = res.ok;
  } catch { _paddleAvailable = false; }
  _paddleLastCheck = now;
  return _paddleAvailable;
}

/** 基于文件类型估算是否走 OCR(扫描件/图片) */
function isLikelyOcrFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') ||
         n.endsWith('.bmp') || n.endsWith('.tiff') || n.endsWith('.tif') ||
         n.endsWith('.gif') || n.endsWith('.webp');
}

/**
 * 统一文档解析 — 优先PaddleOCR，降级本地解析
 * v5.6: 支持 onProgress 回调,分阶段进度反馈
 */
export async function parseDocument(file: File, onProgress?: ProgressCallback): Promise<string> {
  const t0 = Date.now();
  const tick = (stage: ParseProgress['stage'], percent: number, message: string) => {
    onProgress?.({ stage, percent, message, elapsedMs: Date.now() - t0 });
  };

  tick('read', 5, '准备读取文件…');
  try {
    const paddleOk = await checkPaddleHealth();
    if (paddleOk) {
      tick('transfer', 25, 'PaddleOCR 服务可用,准备上传…');
      const text = await parseViaPaddleOCR(file, onProgress, t0);
      if (text && text.length > 10) {
        tick('done', 100, `解析完成,提取 ${text.length} 字符`);
        return text;
      }
    }
    // 降级本地解析
    tick('parse', 50, '降级到本地解析…');
    const text = await parseFallback(file);
    tick('done', 100, `本地解析完成,提取 ${text.length} 字符`);
    return text;
  } catch (err: any) {
    tick('error', 100, `解析失败: ${err?.message || '未知错误'}`);
    throw err;
  }
}

/** PaddleOCR 服务解析 — 带进度反馈 */
async function parseViaPaddleOCR(file: File, onProgress?: ProgressCallback, t0?: number): Promise<string> {
  const tick = (stage: ParseProgress['stage'], percent: number, message: string) => {
    onProgress?.({ stage, percent, message, elapsedMs: t0 ? Date.now() - t0 : 0 });
  };

  // 阶段1: base64 编码(15%-25%)
  tick('encode', 18, 'Base64 编码中…');
  const base64 = await fileToBase64(file);
  tick('encode', 25, `Base64 编码完成 (${(base64.length / 1024).toFixed(0)}KB)`);

  // 阶段2: HTTP 传输(25%-45%)
  // 通过 ReadableStream 读取上传进度(fetch 不直接提供上传进度,用估算+定时器模拟)
  tick('transfer', 30, '上传到 PaddleOCR 服务…');
  const isOcr = isLikelyOcrFile(file);
  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  // 模拟上传进度(基于文件大小估算 1.5s/MB)
  const uploadEstimateMs = Math.min(3000, Math.max(400, file.size / 1024 / 1024 * 1500));
  const uploadStart = Date.now();
  const uploadTimer = setInterval(() => {
    const elapsed = Date.now() - uploadStart;
    const ratio = Math.min(0.95, elapsed / uploadEstimateMs);
    tick('transfer', 30 + Math.floor(ratio * 15), `上传中 ${Math.floor(ratio * 100)}%`);
  }, 200);

  const body = JSON.stringify({
    content: base64,
    filename: file.name,
    mime_type: file.type,
    max_chars: 50000,
  });

  let res: Response;
  try {
    res = await fetch(PADDLE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } finally {
    clearInterval(uploadTimer);
  }

  if (!res.ok) throw new Error(`解析服务错误: HTTP ${res.status}`);

  // 阶段3: 服务端解析(45%-90%)
  // 如果是 OCR 文件,等待时间更长(估算 8s/MB);文字层 PDF/docx 较快(估算 2s)
  tick('parse', 50, isOcr ? '服务端 OCR 识别中…' : (isPdf ? '服务端 PDF 解析中…' : '服务端文档解析中…'));
  const parseEstimateMs = isOcr ? Math.min(60000, file.size / 1024 / 1024 * 8000) : 2000;
  const parseStart = Date.now();
  let parseTimerCleared = false;
  const parseTimer = setInterval(() => {
    const elapsed = Date.now() - parseStart;
    const ratio = Math.min(0.9, elapsed / parseEstimateMs);
    tick('parse', 50 + Math.floor(ratio * 40), isOcr ? `OCR 识别中 ${Math.floor(ratio * 100)}%` : `解析中 ${Math.floor(ratio * 100)}%`);
  }, 300);

  let data: any;
  try {
    data = await res.json();
  } finally {
    if (!parseTimerCleared) clearInterval(parseTimer);
    parseTimerCleared = true;
  }

  if (!data.ok) throw new Error(data.error || '解析失败');
  tick('parse', 90, `服务端解析完成,方法: ${data.method || 'unknown'}`);
  return data.text || '';
}

// ========== 降级解析器 (PaddleOCR不可用时) ==========

/** PDF - pdfjs降级 */
async function parsePDFLocal(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts: string[] = [];
    let emptyPages = 0;
    for (let i = 1; i <= Math.min(pdf.numPages, 100); i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pt = content.items.map((item: any) => item.str).join(' ');
        if (pt.trim()) { texts.push(pt); emptyPages = 0; }
        else { emptyPages++; if (emptyPages >= 3) break; }
        if (texts.join('').length >= 40000) break;
      } catch { /* skip */ }
    }
    const result = texts.join('\n').trim();
    if (!result) throw new Error('此PDF可能为扫描件，PaddleOCR服务未启动。请确保Python解析服务运行中。');
    return result;
  } catch (e: any) { throw new Error(`PDF解析失败: ${e.message}`); }
}

/** Word - mammoth降级(.docx only) */
async function parseWordLocal(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.doc') && !file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('旧版.doc格式需要PaddleOCR服务支持。请用Word另存为.docx。');
  }
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = result.value.trim();
    if (!text) throw new Error('Word文档内容为空');
    return text;
  } catch (e: any) { throw new Error(`Word解析失败: ${e.message}`); }
}

/** Excel - xlsx降级 */
async function parseExcelLocal(file: File): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const results: string[] = [];
    for (const sname of workbook.SheetNames) {
      const sheet = workbook.Sheets[sname];
      results.push(`## ${sname}\n${XLSX.utils.sheet_to_csv(sheet)}`);
    }
    return results.join('\n\n').trim();
  } catch (e: any) { throw new Error(`Excel解析失败: ${e.message}`); }
}

/** 图片 - AI Vision降级 */
async function parseImageLocal(file: File): Promise<string> {
  try {
    const base64 = await fileToBase64(file);
    const messages = [{
      role: 'user',
      content: `请识别并输出这张图片中的所有文字内容（包括表格中的文字），只输出文字，不要任何解释。图片: [图片: data:${file.type};base64,${base64}]`,
    }];
    return await api.aiChat(messages, 'ocr', { model: 'glm-4v' });
  } catch (e: any) { throw new Error(`图片识别失败: ${e.message}`); }
}

/** 降级解析入口 */
async function parseFallback(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith('.pdf') || type === 'application/pdf') return parsePDFLocal(file);
  if (name.endsWith('.docx') || name.endsWith('.doc') || type.includes('word')) return parseWordLocal(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('excel') || type.includes('spreadsheet')) return parseExcelLocal(file);
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name)) return parseImageLocal(file);
  if (type === 'text/plain' || /\.(txt|md|csv|json|xml|html)$/i.test(name)) return file.text();

  throw new Error(`不支持的文件类型: ${file.type || name.split('.').pop()}`);
}

// ========== 工具函数 ==========
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 保持向后兼容
export { parsePDFLocal as parsePDF };
export { parseWordLocal as parseWord };
export { parseExcelLocal as parseExcel };
export { parseImageLocal as parseImage };
