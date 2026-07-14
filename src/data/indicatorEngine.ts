// 指标引擎 — 工程KPI计算（CPI/SPI/完整度/质量分/趋势）

export interface ProjectIndicators {
  projectName: string;
  cpi: number;            // 成本绩效指数 (已签合同金额/批复概算, ≤1为正常)
  spi: number;            // 进度绩效指数 (已完成工作项/总工作项)
  completeness: number;   // 资料完整度 (实际上传数/应上传数, 基于附录A)
  qualityScore: number;   // 综合质量分 (所有表单评分均值)
  alerts: IndicatorAlert[];
  computedAt: string;
}

export interface IndicatorAlert {
  type: 'cost' | 'schedule' | 'completeness' | 'quality';
  level: 'normal' | 'warning' | 'danger';
  message: string;
}

/** 计算项目综合指标 */
export function computeIndicators(projectName: string): ProjectIndicators {
  const alerts: IndicatorAlert[] = [];

  // 1. CPI — 成本绩效指数（真实数据：造价合计数 / 项目概算）
  let cpi = 1.0;
  try {
    // 获取项目概算
    const projects = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]')
      .concat(JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'));
    const proj = projects.find((p: any) => p.name === projectName);
    const investment = proj?.details?.investment
      ? parseFloat(proj.details.investment.replace(/[^0-9.]/g, '')) || 0
      : 0;

    // 获取真实造价数据合计
    const costItems = JSON.parse(localStorage.getItem('cost-data') || '[]');
    const contracted = costItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);

    if (investment > 0 && contracted > 0) {
      cpi = Math.round((contracted / investment) * 100) / 100;
    } else if (investment > 0) {
      cpi = 0; // 有概算但无造价数据
    }
    // 无数据时保持默认 1.0

    if (cpi > 1.05) alerts.push({ type: 'cost', level: 'danger', message: `成本超支: CPI=${cpi} (已签${contracted.toFixed(0)}万/概算${investment}万)` });
    else if (cpi > 0.95) alerts.push({ type: 'cost', level: 'warning', message: `成本接近概算上限: CPI=${cpi}` });
    else if (investment > 0 && contracted === 0) alerts.push({ type: 'cost', level: 'warning', message: `未录入造价数据，请在造价管理中录入` });
  } catch {}

  // 2. SPI — 进度绩效指数 (从4章指南模块汇总)
  let spi = 1.0;
  let totalItems = 0;
  let completedItems = 0;
  const prefix = projectName ? `guide-${projectName}-chapter-` : 'guide-chapter-';
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    try {
      const done = new Set(JSON.parse(localStorage.getItem(`${prefix}${ch}-done`) || '[]'));
      const modules = JSON.parse(localStorage.getItem(`${prefix}${ch}-modules`) || '[]');
      if (Array.isArray(modules)) {
        modules.forEach((sm: any) => {
          if (sm.workItems) {
            sm.workItems.forEach((wi: any) => {
              totalItems++;
              if (done.has(wi.id)) completedItems++;
            });
          }
        });
      }
    } catch {}
  }
  if (totalItems > 0) {
    spi = Math.round((completedItems / totalItems) * 100) / 100;
  }
  if (spi < 0.5) alerts.push({ type: 'schedule', level: 'danger', message: `进度严重滞后: SPI=${spi} (${completedItems}/${totalItems})` });
  else if (spi < 0.8) alerts.push({ type: 'schedule', level: 'warning', message: `进度偏慢: SPI=${spi} (${completedItems}/${totalItems})` });

  // 3. 资料完整度
  let completeness = 0;
  try {
    const stdKey = `doc-mgmt-upload-DB11/T695-2025`;
    const uploads = JSON.parse(localStorage.getItem(stdKey) || '{}');
    const projectUploads = uploads[projectName] || {};
    const uploadedCount = Object.values(projectUploads).filter((v: any) => Array.isArray(v) && v.length > 0).length;
    // 附录A文档总数约400项, 按20%抽样基准
    const baseline = 80;
    completeness = Math.min(100, Math.round((uploadedCount / baseline) * 100));
    if (completeness < 30) alerts.push({ type: 'completeness', level: 'danger', message: `资料完整度低: ${completeness}%` });
    else if (completeness < 60) alerts.push({ type: 'completeness', level: 'warning', message: `资料完整度不足: ${completeness}%` });
  } catch {}

  // 4. 综合质量分 (从审核结果存储中收集评分)
  let qualityScores: number[] = [];
  for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`review-result-${ch}-`)) {
        try {
          const result = JSON.parse(localStorage.getItem(key) || '{}');
          if (typeof result.score === 'number') qualityScores.push(result.score);
        } catch {}
      }
    }
  }
  const qualityScore = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : 0;
  if (qualityScore > 0 && qualityScore < 60) alerts.push({ type: 'quality', level: 'danger', message: `审核评分偏低: 均分${qualityScore}` });
  else if (qualityScore > 0 && qualityScore < 75) alerts.push({ type: 'quality', level: 'warning', message: `审核评分可改善: 均分${qualityScore}` });

  return {
    projectName,
    cpi,
    spi,
    completeness,
    qualityScore,
    alerts,
    computedAt: new Date().toISOString(),
  };
}

/** 获取所有项目的指标汇总 */
export function getAllProjectIndicators(): ProjectIndicators[] {
  const results: ProjectIndicators[] = [];
  try {
    const projects = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]')
      .concat(JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'));
    const seen = new Set<string>();
    for (const p of projects) {
      if (p.name && !seen.has(p.name)) {
        seen.add(p.name);
        results.push(computeIndicators(p.name));
      }
    }
  } catch {}
  return results;
}
