// 数据加工管道 — 实体提取、标准化、自动分类、字段映射

/** 从文本中提取实体 */
export interface ExtractedEntities {
  projectNames: string[];
  projectCodes: string[];
  amounts: { value: number; unit: string; raw: string }[];
  dates: string[];
  personnel: string[];
  companies: string[];
  phoneNumbers: string[];
  documentCodes: string[];
}

export function extractEntities(text: string): ExtractedEntities {
  const result: ExtractedEntities = {
    projectNames: [],
    projectCodes: [],
    amounts: [],
    dates: [],
    personnel: [],
    companies: [],
    phoneNumbers: [],
    documentCodes: [],
  };

  if (!text) return result;

  // 工程编号: 如 "京建[2024]001号", "2024-001", "XHM-2024-001"
  const codePatterns = [
    /[\u4e00-\u9fa5]{2,6}[\u3010\uff3b\[（(][\u4e00-\u9fa5\d\-_.]+[\u3011\uff3d\])）]/g,
    /[A-Z]{2,6}[\-_.]\d{2,6}[\-_.]\d{2,6}/g,
    /〔?\d{4}〕?\d+号?/g,
  ];
  for (const p of codePatterns) {
    const matches = text.match(p) || [];
    result.projectCodes.push(...matches);
  }

  // 金额: "XXX万元", "XXX元", "XXX亿"
  const amountRegex = /(\d[\d,.]*)\s*(万|亿)?\s*元/g;
  let m;
  while ((m = amountRegex.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    const unit = m[2] || '元';
    result.amounts.push({ value: val, unit, raw: m[0] });
  }

  // 日期: YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日, YYYY.MM.DD
  const dateRegex = /(\d{4})[年\-\/.](0?[1-9]|1[0-2])[月\-\/.](0?[1-9]|[12]\d|3[01])[日]?/g;
  let dm;
  while ((dm = dateRegex.exec(text)) !== null) {
    const y = dm[1], mo = dm[2].padStart(2, '0'), d = dm[3].padStart(2, '0');
    result.dates.push(`${y}-${mo}-${d}`);
  }
  result.dates = [...new Set(result.dates)];

  // 公司/单位: "XXX有限公司", "XXX公司", "XXX集团"
  const companyRegex = /[\u4e00-\u9fa5]{2,20}(?:有限(?:责任)?公司|股份(?:有限)?公司|集团(?:有限)?公司|有限公司|总公司|分公司|设计院|研究院|勘察院|监理公司|咨询公司|建设公司|工程公司)/g;
  result.companies = [...new Set(text.match(companyRegex) || [])];

  // 人名: "张三", "李某某" (简单的2-4字中文人名，前后有特定关键词)
  const personHints = /(?:联系人|负责人|项目经理|总监|工程师|签字人|经办人|审批人|审核人|批准人|设计人|制图人|编制人)[：:]\s*([\u4e00-\u9fa5]{2,4})/g;
  let pm;
  while ((pm = personHints.exec(text)) !== null) {
    result.personnel.push(pm[1]);
  }
  result.personnel = [...new Set(result.personnel)];

  // 电话号码
  result.phoneNumbers = [...new Set(text.match(/1[3-9]\d{9}/g) || [])];

  // 文档编号: 表X.X-X 格式
  result.documentCodes = [...new Set(text.match(/表\s*\d+[\.\-\u3000]\s*\d+[\.\-\u3000]\s*\d*/g) || [])];

  // 项目名称: 引号内的较长中文文本
  const projMatches = text.match(/《([\u4e00-\u9fa5\d\-\s]{4,40})》/g);
  if (projMatches) {
    result.projectNames = projMatches.map(s => s.replace(/[《》]/g, ''));
  }

  return result;
}

/** 标准化金额（统一为元） */
export function normalizeAmount(value: number, unit: string): number {
  if (unit === '亿') return value * 1e8;
  if (unit === '万') return value * 1e4;
  return value;
}

/** 标准化日期为 YYYY-MM-DD */
export function normalizeDate(raw: string): string {
  const regex = /(\d{4})[年\-\/.](0?[1-9]|1[0-2])[月\-\/.](0?[1-9]|[12]\d|3[01])[日]?/;
  const m = raw.match(regex);
  if (!m) return raw;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** 基于附录A tableCode 自动分类文档 */
export function autoClassify(
  text: string,
  appendixData: { code: string; name: string; tableCode: string }[],
): { code: string; name: string; score: number }[] {
  const results: { code: string; name: string; score: number }[] = [];
  const lowerText = text.toLowerCase();

  for (const item of appendixData) {
    let score = 0;
    // 精确表号匹配
    if (item.tableCode && lowerText.includes(item.tableCode.toLowerCase())) {
      score += 80;
    }
    // 名称关键词匹配
    const keywords = item.name.replace(/[（()）表]/g, '').split(/[\/\-\s]/).filter(w => w.length >= 2);
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) score += 10;
    }
    if (score >= 30) {
      results.push({ code: item.tableCode, name: item.name, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** 从文本中提取字段值，映射到表单字段 */
export function extractFieldValues(
  text: string,
  fields: { key: string; label: string; type: string }[],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const field of fields) {
    // 对每个字段标签在文本中查找
    const labelStripped = field.label.replace(/[（()*＊]/g, '');
    const patterns = [
      new RegExp(`${labelStripped}[：:]\s*(.+?)(?:[\n\r]|$)`, 'i'),
      new RegExp(`${labelStripped}\s*[：:]\s*(.+?)(?:[\n\r]|$)`, 'i'),
      new RegExp(`${labelStripped.slice(0, 3)}[：:]\s*(.+?)(?:[\n\r]|$)`, 'i'),
    ];

    for (const p of patterns) {
      const match = text.match(p);
      if (match && match[1]?.trim()) {
        result[field.key] = match[1].trim().slice(0, 200);
        break;
      }
    }
  }

  return result;
}
