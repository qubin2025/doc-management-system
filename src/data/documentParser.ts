// 文档解析器 — PDF/Word/Excel/图片 → 文本提取（全异步、错误安全）

import * as api from './api';

/** 解析 PDF → 文本（前20页，确保稳定） */
export async function parsePDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // 使用本地 worker，避免 CDN 跨域/网络问题
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts: string[] = [];
    const maxPages = Math.min(pdf.numPages, 20); // 限制前20页

    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        if (pageText.trim()) texts.push(pageText);
      } catch { /* 跳过无法解析的页面 */ }
    }
    return texts.join('\n').trim() || '(PDF文本提取为空)';
  } catch (e: any) {
    throw new Error(`PDF解析失败: ${e.message}`);
  }
}

/** 解析 Word (.docx) → 文本 */
export async function parseWord(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (e: any) {
    throw new Error(`Word解析失败: ${e.message}`);
  }
}

/** 解析 Excel (.xlsx/.xls) → Markdown表格文本 */
export async function parseExcel(file: File): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const results: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csvText = XLSX.utils.sheet_to_csv(sheet);
      results.push(`## ${sheetName}\n\`\`\`\n${csvText}\n\`\`\``);
    }
    return results.join('\n\n').trim();
  } catch (e: any) {
    throw new Error(`Excel解析失败: ${e.message}`);
  }
}

/** 图片 OCR — 调视觉模型识别文字 */
export async function parseImage(file: File): Promise<string> {
  try {
    const base64 = await fileToBase64(file);
    const messages = [{
      role: 'user',
      content: `请识别并输出这张图片中的所有文字内容（包括表格中的文字），只输出文字，不要任何解释。图片: [图片: data:${file.type};base64,${base64}]`,
    }];
    const result = await api.aiChat(messages, 'ocr', { model: 'glm-4v' });
    return result.trim();
  } catch (e: any) {
    throw new Error(`图片识别失败: ${e.message}`);
  }
}

/** 通用解析 — 根据文件类型自动选择解析器 */
export async function parseDocument(file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return parsePDF(file);
  }
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      type === 'application/msword' || name.endsWith('.docx') || name.endsWith('.doc')) {
    return parseWord(file);
  }
  if (type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      type === 'application/vnd.ms-excel' || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file);
  }
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name)) {
    return parseImage(file);
  }

  // 纯文本文件
  if (type === 'text/plain' || /\.(txt|md|csv|json|xml|html)$/i.test(name)) {
    return file.text();
  }

  throw new Error(`不支持的文件类型: ${file.type || name.split('.').pop()}`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
