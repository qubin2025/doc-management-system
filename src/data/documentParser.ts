/**
 * 全局文档解析器 — v2.5.0 PaddleOCR 统一方案
 * 所有文件上传统一调用 PaddleOCR 解析服务 (localhost:8001)
 *
 * 覆盖: PDF(文字+扫描件) | DOC | DOCX | XLS | XLSX | PNG/JPG/BMP | TXT/CSV
 * 降级: PaddleOCR不可用时 → pdfjs + mammoth + xlsx + AI Vision
 */

import * as api from './api';

const PADDLE_API = 'http://localhost:8001/api/parse/document';
const PADDLE_HEALTH = 'http://localhost:8001/api/parse/health';

let _paddleAvailable: boolean | null = null;

/** 检测PaddleOCR服务是否可用（缓存结果） */
async function checkPaddleHealth(): Promise<boolean> {
  if (_paddleAvailable !== null) return _paddleAvailable;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(PADDLE_HEALTH, { signal: ctrl.signal });
    clearTimeout(timer);
    _paddleAvailable = res.ok;
  } catch { _paddleAvailable = false; }
  return _paddleAvailable;
}

/** 统一文档解析 — 优先PaddleOCR，降级本地解析 */
export async function parseDocument(file: File): Promise<string> {
  const paddleOk = await checkPaddleHealth();
  if (paddleOk) {
    const text = await parseViaPaddleOCR(file);
    if (text && text.length > 10) return text;
  }
  // 降级本地解析
  return parseFallback(file);
}

/** PaddleOCR 服务解析 */
async function parseViaPaddleOCR(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  const res = await fetch(PADDLE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: base64,
      filename: file.name,
      mime_type: file.type,
      max_chars: 50000,
    }),
  });
  if (!res.ok) throw new Error(`解析服务错误: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '解析失败');
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
