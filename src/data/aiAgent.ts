// AI Agent — 智能体框架：周期性扫描、异常检测、自动建议

import * as api from './api';
import { computeIndicators } from './indicatorEngine';

export interface ScanResult {
  type: 'work-items' | 'forms' | 'indicators';
  summary: string;
  suggestions: AgentSuggestion[];
  scannedAt: string;
}

export interface AgentSuggestion {
  level: 'info' | 'warning' | 'critical';
  target: string;        // 工作项ID或表单code
  targetName: string;    // 显示名称
  action: string;        // 建议动作
  reason: string;        // 依据
}

/** 扫描工作项 — 检测可自动完成的项 */
export function scanWorkItems(_projectName: string): ScanResult {
  const suggestions: AgentSuggestion[] = [];
  let total = 0, completed = 0;

  const prefix = _projectName ? `guide-${_projectName}-chapter-` : 'guide-chapter-';
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    try {
      const done = new Set(JSON.parse(localStorage.getItem(`${prefix}${ch}-done`) || '[]'));
      const checked = new Set(JSON.parse(localStorage.getItem(`${prefix}${ch}`) || '[]'));
      const modules = JSON.parse(localStorage.getItem(`${prefix}${ch}-modules`) || '[]');
      if (!Array.isArray(modules)) continue;

      for (const sm of modules) {
        if (!sm.workItems) continue;
        for (const wi of sm.workItems) {
          total++;
          if (done.has(wi.id)) { completed++; continue; }
          if (wi.plannedDate && new Date(wi.plannedDate) < new Date()) {
            suggestions.push({
              level: 'warning', target: wi.id, targetName: wi.name,
              action: '建议勾选完成', reason: `计划日期${wi.plannedDate}已过`,
            });
          }
          if (checked.has(wi.id) && !done.has(wi.id)) {
            suggestions.push({
              level: 'info', target: wi.id, targetName: wi.name,
              action: '已选中但未完成', reason: '工作项已列入计划但尚未标记完成',
            });
          }
        }
      }
    } catch {}
  }

  return {
    type: 'work-items',
    summary: `工作项完成率: ${completed}/${total} (${total > 0 ? Math.round(completed/total*100) : 0}%)`,
    suggestions: suggestions.slice(0, 20),
    scannedAt: new Date().toISOString(),
  };
}

/** 扫描附表 — 检测缺失的表单 */
export function scanForms(_projectName: string): ScanResult {
  const suggestions: AgentSuggestion[] = [];
  let filled = 0, total = 0;
  const prefix2 = _projectName ? `guide-${_projectName}-chapter-` : 'guide-chapter-';

  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    try {
      const modules = JSON.parse(localStorage.getItem(`${prefix2}${ch}-modules`) || '[]');
      if (!Array.isArray(modules)) continue;
      // 从guide-chapter localStorage读取form列表
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`form-content-${ch}-`)) {
          total++;
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.content && data.content.trim().length > 20) filled++;
            else {
              const code = key.replace(`form-content-${ch}-`, '');
              suggestions.push({
                level: 'warning', target: code, targetName: code,
                action: '建议填写此表单', reason: '表单内容为空或过短',
              });
            }
          } catch {}
        }
      }
    } catch {}
  }

  return {
    type: 'forms',
    summary: `表单完成率: ${filled}/${total} (${total > 0 ? Math.round(filled/total*100) : 0}%)`,
    suggestions: suggestions.slice(0, 15),
    scannedAt: new Date().toISOString(),
  };
}

/** 综合扫描 + AI分析建议 */
export async function fullScan(projectName: string): Promise<{
  workItems: ScanResult;
  forms: ScanResult;
  indicators: ReturnType<typeof computeIndicators>;
  aiAdvice: string;
}> {
  const workItems = scanWorkItems(projectName);
  const forms = scanForms(projectName);
  const indicators = computeIndicators(projectName);

  // AI综合分析
  let aiAdvice = '';
  try {
    const prompt = `请简要分析以下工程项目的健康状态并给出2-3条最关键的建议:
项目: ${projectName}
${workItems.summary}
${forms.summary}
CPI: ${indicators.cpi}, SPI: ${indicators.spi}, 完整度: ${indicators.completeness}%, 质量: ${indicators.qualityScore}
预警: ${indicators.alerts.map(a => a.message).join('; ') || '无'}
建议: ${workItems.suggestions.slice(0, 5).map(s => s.action + ': ' + s.targetName).join('; ')}`;
    aiAdvice = await api.aiChat([{ role: 'user', content: prompt }], '', { model: 'deepseek-v4-pro' });
  } catch {}

  return { workItems, forms, indicators, aiAdvice };
}
