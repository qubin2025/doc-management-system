/**
 * 资金指标计算引擎 — 从 localStorage 提取项目财务数据
 *
 * 数据来源：
 *   - 审批概算：proj.details.investment（doc-mgmt-projects-*）
 *   - 合同金额：cost-data 的 costItems.total 合计
 *   - 产值：合同金额 × SPI（进度绩效指数）
 *   - 预计结算：暂用合同金额近似（未来从 FormContent 提取 settlementAmount）
 */

export interface ProjectFinance {
  projectName: string;
  approvedBudget: number;     // 审批概算（万元）
  contractAmount: number;     // 合同金额/已签造价（万元）
  outputValue: number;        // 产值（按进度估算，万元）
  expectedSettlement: number; // 预计结算（万元）
  cpi: number;                // 成本绩效指数 = 合同/概算
  budgetUsage: number;        // 概算使用率 = 合同/概算 × 100%
  deviation: number;          // 偏差 = 合同 - 概算（正=超支，负=节约）
}

/** 从 localStorage 获取项目概算 */
function getProjectInvestment(projectName: string): number {
  try {
    const projects = [
      ...JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]'),
      ...JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'),
    ];
    const proj = projects.find((p: any) => p.name === projectName);
    return proj?.details?.investment
      ? parseFloat(proj.details.investment.replace(/[^0-9.]/g, '')) || 0
      : 0;
  } catch {
    return 0;
  }
}

/** 从 cost-data 获取已签造价合计 */
function getContractedAmount(projectName?: string): number {
  try {
    const costItems = JSON.parse(localStorage.getItem('cost-data') || '[]');
    if (!projectName) {
      return costItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    }
    // 按项目名筛选（如有 projectName 字段）
    return costItems
      .filter((item: any) => !item.projectName || item.projectName === projectName)
      .reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
  } catch {
    return 0;
  }
}

/** 从 indicatorEngine 获取 SPI（进度绩效指数） */
function getProjectSPI(projectName: string): number {
  try {
    let totalItems = 0;
    let completedItems = 0;
    const prefix = `guide-${projectName}-chapter-`;
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
    return totalItems > 0 ? completedItems / totalItems : 0;
  } catch {
    return 0;
  }
}

/** 获取全部项目名称列表 */
function getAllProjectNames(): string[] {
  try {
    const projects = [
      ...JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]'),
      ...JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'),
    ];
    return projects.map((p: any) => p.name).filter(Boolean);
  } catch {
    return [];
  }
}

/** 计算单个项目资金指标 */
export function getProjectFinance(projectName: string): ProjectFinance {
  const approvedBudget = getProjectInvestment(projectName);
  const contractAmount = getContractedAmount();
  const spi = getProjectSPI(projectName);
  const outputValue = Math.round(contractAmount * spi * 100) / 100;
  const expectedSettlement = contractAmount; // 暂用合同金额近似

  const cpi = approvedBudget > 0
    ? Math.round((contractAmount / approvedBudget) * 100) / 100
    : 0;
  const budgetUsage = approvedBudget > 0
    ? Math.round((contractAmount / approvedBudget) * 10000) / 100
    : 0;
  const deviation = Math.round((contractAmount - approvedBudget) * 100) / 100;

  return {
    projectName,
    approvedBudget,
    contractAmount,
    outputValue,
    expectedSettlement,
    cpi,
    budgetUsage,
    deviation,
  };
}

/** 获取全部项目资金指标（用于全局看板对比） */
export function getAllProjectsFinance(): ProjectFinance[] {
  return getAllProjectNames().map(name => getProjectFinance(name));
}

/** 计算全部项目的资金汇总 */
export function getFinanceSummary(): {
  totalBudget: number;
  totalContract: number;
  totalOutput: number;
  totalSettlement: number;
} {
  const all = getAllProjectsFinance();
  return all.reduce((acc, f) => ({
    totalBudget: acc.totalBudget + f.approvedBudget,
    totalContract: acc.totalContract + f.contractAmount,
    totalOutput: acc.totalOutput + f.outputValue,
    totalSettlement: acc.totalSettlement + f.expectedSettlement,
  }), { totalBudget: 0, totalContract: 0, totalOutput: 0, totalSettlement: 0 });
}
