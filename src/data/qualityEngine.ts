// 数据质量引擎 — 完整性检查、格式校验、去重、评分

import { FormField } from '../types';

export interface QualityReport {
  completeness: { total: number; filled: number; required: number; requiredFilled: number; score: number };
  formatIssues: { field: string; value: string; issue: string }[];
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D';
  suggestions: string[];
}

/** 校验完整性和格式 */
export function checkFormQuality(
  fields: FormField[],
  values: Record<string, string>,
): QualityReport {
  const report: QualityReport = {
    completeness: { total: fields.length, filled: 0, required: 0, requiredFilled: 0, score: 0 },
    formatIssues: [],
    score: 0,
    grade: 'D',
    suggestions: [],
  };

  if (fields.length === 0) {
    report.score = 100;
    report.grade = 'A';
    return report;
  }

  // 完整性
  for (const f of fields) {
    if (f.required) report.completeness.required++;
    const v = values[f.key];
    if (v && v.trim() && v.trim() !== '__' && v.trim() !== '0') {
      report.completeness.filled++;
      if (f.required) report.completeness.requiredFilled++;
    } else if (f.required) {
      report.suggestions.push(`必填字段"${f.label}"未填写`);
    }
  }

  // 格式校验
  for (const f of fields) {
    const v = values[f.key];
    if (!v || !v.trim() || v.trim() === '__') continue;

    if (f.type === 'number') {
      const numVal = parseFloat(v.replace(/[,，\s万元亿]/g, ''));
      if (isNaN(numVal)) {
        report.formatIssues.push({ field: f.label, value: v, issue: '应为数字格式' });
      }
    }

    if (f.type === 'date') {
      const dateRegex = /^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}$/;
      if (!dateRegex.test(v.trim())) {
        report.formatIssues.push({ field: f.label, value: v, issue: '应为日期格式(YYYY-MM-DD)' });
      }
    }

    if (f.type === 'select' && f.options && f.options.length > 0) {
      const matched = f.options.some(o => v.includes(o));
      if (!matched) {
        report.formatIssues.push({
          field: f.label,
          value: v,
          issue: `应在可选值范围内: ${f.options.join('/')}`,
        });
      }
    }
  }

  // 综合评分
  const completenessScore = report.completeness.total > 0
    ? (report.completeness.filled / report.completeness.total) * 60
    : 60;
  const requiredScore = report.completeness.required > 0
    ? (report.completeness.requiredFilled / report.completeness.required) * 20
    : 20;
  const formatPenalty = Math.min(report.formatIssues.length * 5, 20);
  report.score = Math.round(Math.max(0, completenessScore + requiredScore - formatPenalty));

  if (report.score >= 90) report.grade = 'A';
  else if (report.score >= 70) report.grade = 'B';
  else if (report.score >= 50) report.grade = 'C';
  else report.grade = 'D';

  if (report.formatIssues.length > 0) {
    report.suggestions.push(`发现${report.formatIssues.length}处格式问题`);
  }

  return report;
}

/** 文本相似度（字符2-gram Jaccard，中英文均适用） */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const toGrams = (s: string): Set<string> => {
    const grams = new Set<string>();
    const t = s.slice(0, 1000).replace(/\s+/g, '');
    for (let i = 0; i < t.length - 1; i++) {
      grams.add(t.slice(i, i + 2));
    }
    return grams;
  };
  const setA = toGrams(a);
  const setB = toGrams(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/** 检查表单内容是否与已有记录重复 */
export function checkDuplicate(
  content: string,
  existingContents: string[],
  threshold = 0.9,
): boolean {
  for (const ec of existingContents) {
    if (textSimilarity(content, ec) >= threshold) return true;
  }
  return false;
}

/** 校验单字段值 */
export function validateField(field: FormField, value: string): string | null {
  if (!value || !value.trim() || value.trim() === '__') {
    if (field.required) return `${field.label}为必填项`;
    return null;
  }

  if (field.type === 'number') {
    const cleaned = value.replace(/[,，\s万元亿]/g, '');
    if (isNaN(parseFloat(cleaned)) && cleaned.length > 0) {
      return `${field.label}格式错误，请输入数字`;
    }
  }

  if (field.type === 'date') {
    if (!/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}$/.test(value.trim())) {
      return `${field.label}格式错误，请使用YYYY-MM-DD格式`;
    }
  }

  return null; // 通过
}
