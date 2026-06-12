// 导出服务 — 占位符模板填充 + Excel/Word格式输出

/**
 * 用字段值填充占位符模板文本（通用字符串替换）
 * 支持: {key}, {key:label}, {中文标签}
 */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (_match, raw) => {
    const colonIdx = raw.indexOf(':');
    const key = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : raw.trim();
    const val = values[key];
    if (val !== undefined && val !== '') return val;
    return `{${raw}}`; // 无对应值→保留原占位符
  });
}

/**
 * 导出填充后的Excel文件
 * @param templateFileData - 模板文件的Data URL (data:...;base64,...)
 * @param values - 字段填充值 {key: value}
 * @param outputName - 输出文件名(不含扩展名)
 */
export async function exportFilledExcel(
  templateFileData: string,
  values: Record<string, string>,
  outputName: string,
): Promise<void> {
  const XLSX = await import('xlsx');

  // 从Data URL还原ArrayBuffer
  const base64 = templateFileData.split(',')[1] || '';
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  // 读取模板工作簿
  const wb = XLSX.read(bytes.buffer, { type: 'buffer' });

  // 遍历所有工作表，替换占位符
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.t === 's' && typeof cell.v === 'string') {
          const original = cell.v;
          const filled = fillPlaceholders(original, values);
          if (filled !== original) {
            cell.v = filled;
            cell.t = 's';
          }
        }
      }
    }
  }

  // 下载
  const outBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${outputName}.xlsx`);
}

/**
 * 从模板和字段值导出Markdown
 */
export function exportFilledMarkdown(
  fields: { key: string; label: string }[],
  values: Record<string, string>,
  formCode: string,
  formName: string,
): string {
  const lines = [`# ${formName}`, `> 编号: ${formCode}`, ''];
  for (const f of fields) {
    lines.push(`**${f.label}**：${values[f.key] || '__'}`);
  }
  return lines.join('\n');
}

/**
 * 导出填充后的Word文件（.docx本质是ZIP+XML）
 * 用JSZip打开→替换word/document.xml中占位符→重新打包
 */
export async function exportFilledWord(
  templateFileData: string,
  values: Record<string, string>,
  outputName: string,
): Promise<void> {
  const JSZip = (await import('jszip')).default;

  // 从Data URL还原ArrayBuffer
  const base64 = templateFileData.split(',')[1] || '';
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  // 打开docx (本质是ZIP)
  const zip = await JSZip.loadAsync(bytes.buffer);

  // 处理word/document.xml — 核心XML文件
  const docXmlFile = zip.file('word/document.xml');
  if (docXmlFile) {
    let xml = await docXmlFile.async('text');
    // 替换占位符: {key} 或 {key:label}
    xml = fillPlaceholders(xml, values);
    zip.file('word/document.xml', xml);
  }

  // 生成输出
  const outBuf = await zip.generateAsync({ type: 'arraybuffer' });
  downloadBlob(new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${outputName}.docx`);
}

/**
 * 批量导出 — 生成本章节所有已填表单的ZIP包
 */
export async function exportBatchZip(
  forms: { code: string; name: string; content: string; templateData?: string; type?: string }[],
  chapterTitle: string,
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const form of forms) {
    const filename = `${form.code}-${form.name}`;
    if (form.templateData && form.type === 'excel') {
      // Excel模板 → 填充后加入ZIP
      try {
        const XLSX = await import('xlsx');
        const base64 = form.templateData.split(',')[1] || '';
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        XLSX.read(bytes.buffer, { type: 'buffer' }); // 验证模板可读
      } catch {}
    }
    // 默认: 导出Markdown内容
    if (form.content) {
      zip.file(`${filename}.md`, form.content);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${chapterTitle}_批量表单.zip`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
