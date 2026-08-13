import type { GuideChapter } from '../types';

// ===== 项目特征问卷 =====
export interface ProjectProfile {
  projectType: 'building' | 'municipal' | 'industrial' | 'comprehensive';
  investmentLevel: 'small' | 'medium' | 'large' | 'extra-large';
  durationMonths: number;
  complexity: 'simple' | 'normal' | 'complex' | 'highly-complex';
  managementScope: string[];
  hasHeritageProtection: boolean;
  hasEnvironmentalAssessment: boolean;
  hasTrafficImpact: boolean;
  hasUndergroundConstruction: boolean;
  hasSpecialStructure: boolean;
  hasMunicipalPipeline: boolean;
  stakeholderCount: number;
  hasDesignManagement: boolean;
  hasBiddingAgency: boolean;
  hasCostConsulting: boolean;
  hasConstructionSupervision: boolean;
  hasConstructionUnit: boolean;
  hasProjectManagement: boolean;
  hasSupplier: boolean;
}

export type WorkItemStatus = 'required' | 'recommended' | 'optional' | 'excluded';

export interface TailoringResult {
  profile: ProjectProfile;
  recommendations: string[];
  workItemStatus: Record<string, WorkItemStatus>;
  summary: {
    total: number;
    required: number;
    recommended: number;
    optional: number;
    excluded: number;
  };
  generatedAt: string;
}

export interface TailoringConfig {
  profile: ProjectProfile;
  result: TailoringResult;
  manualAdjustments: Array<{ workItemId: string; status: WorkItemStatus }>;
  savedAt: string;
  applied: boolean;
}

// ===== PMBOK裁剪规则 =====
interface TailoringRule {
  id: string;
  condition: (p: ProjectProfile) => boolean;
  action: 'require' | 'recommend' | 'de-emphasize' | 'exclude';
  targetSubModuleIds: string[];
  targetWorkItemIds: string[];
  reason: string;
  pmbokRef: string;
}

const TAILORING_RULES: TailoringRule[] = [
  // ===== 项目类型基础规则 =====
  {
    id: 'R01',
    condition: (p) => p.projectType === 'building',
    action: 'recommend',
    targetSubModuleIds: [],
    targetWorkItemIds: ['1.1.1', '1.1.2', '1.1.3'],
    reason: '建筑工程需重点关注用地和规划许可',
    pmbokRef: 'PMBOK 4.1 制定项目章程',
  },
  {
    id: 'R02',
    condition: (p) => p.projectType === 'municipal',
    action: 'require',
    targetSubModuleIds: [],
    targetWorkItemIds: ['1.4.1', '1.4.2'],
    reason: '市政工程必须取得规划意见书',
    pmbokRef: 'PMBOK 4.1',
  },
  {
    id: 'R03',
    condition: (p) => p.projectType === 'municipal' || p.hasMunicipalPipeline,
    action: 'recommend',
    targetWorkItemIds: ['1.7.1'],
    targetSubModuleIds: [],
    reason: '市政管线工程涉及掘路许可',
    pmbokRef: 'PMBOK 11.0 风险管理',
  },

  // ===== 投资规模规则 =====
  {
    id: 'R04',
    condition: (p) => p.investmentLevel === 'large' || p.investmentLevel === 'extra-large',
    action: 'require',
    targetWorkItemIds: ['1.2.1', '1.2.2', '1.2.3'],
    targetSubModuleIds: [],
    reason: '大型项目必须严格遵守可研审批流程',
    pmbokRef: 'PMBOK 4.1',
  },
  {
    id: 'R05',
    condition: (p) => p.investmentLevel === 'small',
    action: 'de-emphasize',
    targetWorkItemIds: ['1.2.3'],
    targetSubModuleIds: [],
    reason: '小型项目可简化可研评审流程',
    pmbokRef: 'PMBOK 裁剪-规模',
  },

  // ===== 复杂度规则 =====
  {
    id: 'R06',
    condition: (p) => p.complexity === 'highly-complex' || p.complexity === 'complex',
    action: 'require',
    targetWorkItemIds: ['3.2.1', '3.2.2', '3.2.3'],
    targetSubModuleIds: [],
    reason: '复杂项目必须完善施工准备',
    pmbokRef: 'PMBOK 5.0',
  },
  {
    id: 'R07',
    condition: (p) => p.complexity === 'simple',
    action: 'de-emphasize',
    targetWorkItemIds: ['3.2.3'],
    targetSubModuleIds: [],
    reason: '简单项目可精简施工准备',
    pmbokRef: 'PMBOK 裁剪-复杂度',
  },

  // ===== 管理范围规则 =====
  {
    id: 'R08',
    condition: (p) => p.managementScope.includes('cost-management'),
    action: 'recommend',
    targetSubModuleIds: ['3.3'],
    targetWorkItemIds: [],
    reason: '启用了造价管理范围',
    pmbokRef: 'PMBOK 7.0 成本管理',
  },
  {
    id: 'R09',
    condition: (p) => p.managementScope.includes('quality-management'),
    action: 'recommend',
    targetSubModuleIds: ['3.5'],
    targetWorkItemIds: [],
    reason: '启用了质量管理范围',
    pmbokRef: 'PMBOK 8.0 质量管理',
  },
  {
    id: 'R10',
    condition: (p) => p.managementScope.includes('safety-management'),
    action: 'require',
    targetSubModuleIds: ['3.6'],
    targetWorkItemIds: [],
    reason: '安全管理是强制性要求',
    pmbokRef: 'PMBOK 11.0/13.0',
  },
  {
    id: 'R11',
    condition: (p) => !p.managementScope.includes('pre-construction'),
    action: 'de-emphasize',
    targetSubModuleIds: [],
    targetWorkItemIds: ['1.10.1', '1.10.2'],
    reason: '未选择前期管理范围，降低优先级',
    pmbokRef: 'PMBOK 裁剪-管理范围',
  },
  {
    id: 'R12',
    condition: (p) => !p.managementScope.includes('bidding'),
    action: 'de-emphasize',
    targetSubModuleIds: [],
    targetWorkItemIds: ['2.1.1', '2.1.2', '2.2.1'],
    reason: '未选择招标范围',
    pmbokRef: 'PMBOK 12.0 采购管理',
  },

  // ===== 特殊需求规则 =====
  {
    id: 'R13',
    condition: (p) => p.hasEnvironmentalAssessment,
    action: 'require',
    targetWorkItemIds: ['1.5.1', '1.5.2'],
    targetSubModuleIds: [],
    reason: '涉及环评必须完成环境审批',
    pmbokRef: 'PMBOK 11.0 EEF',
  },
  {
    id: 'R14',
    condition: (p) => !p.hasEnvironmentalAssessment,
    action: 'de-emphasize',
    targetWorkItemIds: ['1.5.1'],
    targetSubModuleIds: [],
    reason: '无环评需求的项目可降低优先级',
    pmbokRef: 'PMBOK 裁剪-EEF',
  },
  {
    id: 'R15',
    condition: (p) => p.hasUndergroundConstruction,
    action: 'require',
    targetWorkItemIds: ['3.4.1', '3.4.2'],
    targetSubModuleIds: [],
    reason: '地下施工需专项方案和安全监测',
    pmbokRef: 'PMBOK 11.0 风险管理',
  },
  {
    id: 'R16',
    condition: (p) => p.hasSpecialStructure,
    action: 'recommend',
    targetWorkItemIds: ['3.2.3'],
    targetSubModuleIds: [],
    reason: '特殊结构需专家论证',
    pmbokRef: 'PMBOK 8.0/11.0',
  },
  {
    id: 'R17',
    condition: (p) => p.hasHeritageProtection,
    action: 'require',
    targetWorkItemIds: ['1.8.1'],
    targetSubModuleIds: [],
    reason: '涉及文保需专项审批',
    pmbokRef: 'PMBOK 4.1 EEF',
  },
  {
    id: 'R18',
    condition: (p) => p.hasTrafficImpact,
    action: 'recommend',
    targetWorkItemIds: ['3.10.1'],
    targetSubModuleIds: [],
    reason: '交通影响需编制交通组织方案',
    pmbokRef: 'PMBOK 11.0',
  },

  // ===== 组织特征规则 =====
  {
    id: 'R19',
    condition: (p) => p.stakeholderCount > 5,
    action: 'recommend',
    targetWorkItemIds: ['3.9.1', '3.9.2'],
    targetSubModuleIds: [],
    reason: '多方参与项目应加强合同管理',
    pmbokRef: 'PMBOK 12.0/13.0',
  },
  {
    id: 'R20',
    condition: (p) => p.hasDesignManagement,
    action: 'recommend',
    targetWorkItemIds: ['1.9.1'],
    targetSubModuleIds: [],
    reason: '有设计管理需求',
    pmbokRef: 'PMBOK 8.0 质量管理',
  },
];

// 动作优先级映射：require > recommend > de-emphasize > (默认optional)
const ACTION_PRIORITY: Record<string, number> = {
  'require': 4, 'recommend': 3, 'de-emphasize': 2,
};

function actionToStatus(action: string): WorkItemStatus {
  switch (action) {
    case 'require': return 'required';
    case 'recommend': return 'recommended';
    case 'de-emphasize': return 'optional';
    case 'exclude': return 'excluded';
    default: return 'optional';
  }
}

/**
 * 评估裁剪规则，计算每个工作项的状态
 */
export function computeTailoringResult(
  profile: ProjectProfile,
  allChapters: GuideChapter[]
): TailoringResult {
  const applicableRules = TAILORING_RULES.filter(r => r.condition(profile));
  const recommendations = applicableRules.map(r => `${r.id}: ${r.reason} (${r.pmbokRef})`);

  // 收集所有工作项并初始化状态
  const workItemStatus: Record<string, WorkItemStatus> = {};
  const allItems: { id: string; smId: string }[] = [];

  for (const chapter of allChapters) {
    for (const sm of chapter.subModules) {
      for (const wi of sm.workItems) {
        workItemStatus[wi.id] = 'optional';
        allItems.push({ id: wi.id, smId: sm.id });
      }
    }
  }

  // 应用规则
  for (const rule of applicableRules) {
    // 子模块级规则
    for (const smId of rule.targetSubModuleIds) {
      const items = allItems.filter(i => {
        for (const ch of allChapters) {
          for (const sm of ch.subModules) {
            if (sm.id === smId) return sm.workItems.some(w => w.id === i.id);
          }
        }
        return false;
      });
      for (const item of items) {
        const currentPriority = ACTION_PRIORITY[rule.action] || 0;
        const existingPriority = ACTION_PRIORITY[
          workItemStatus[item.id] === 'required' ? 'require' :
          workItemStatus[item.id] === 'recommended' ? 'recommend' :
          workItemStatus[item.id] === 'optional' ? 'de-emphasize' : ''
        ] || 0;
        if (currentPriority > existingPriority) {
          workItemStatus[item.id] = actionToStatus(rule.action);
        }
      }
    }

    // 工作项级规则
    for (const wiId of rule.targetWorkItemIds) {
      const currentPriority = ACTION_PRIORITY[rule.action] || 0;
      const existing = workItemStatus[wiId];
      const existingPriority = existing
        ? (ACTION_PRIORITY[
            existing === 'required' ? 'require' :
            existing === 'recommended' ? 'recommend' :
            existing === 'optional' ? 'de-emphasize' : ''
          ] || 0)
        : -1;
      if (existingPriority === undefined || currentPriority > existingPriority) {
        workItemStatus[wiId] = actionToStatus(rule.action);
      }
    }
  }

  // 计算统计
  const total = allItems.length;
  const required = allItems.filter(i => workItemStatus[i.id] === 'required').length;
  const recommended = allItems.filter(i => workItemStatus[i.id] === 'recommended').length;
  const optional = allItems.filter(i => workItemStatus[i.id] === 'optional').length;
  const excluded = allItems.filter(i => workItemStatus[i.id] === 'excluded').length;

  return {
    profile,
    recommendations,
    workItemStatus,
    summary: { total, required, recommended, optional, excluded },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 加载裁剪配置
 */
export function loadTailoringConfig(projectName: string): TailoringConfig | null {
  try {
    const key = `tailoring-config-${projectName}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * 保存裁剪配置
 */
export function saveTailoringConfig(projectName: string, config: TailoringConfig): void {
  const key = `tailoring-config-${projectName}`;
  localStorage.setItem(key, JSON.stringify(config));
}

/**
 * 预设问卷模板
 */
export const PROFILE_TEMPLATES: Record<string, Partial<ProjectProfile>> = {
  '住宅建筑-中型': {
    projectType: 'building',
    investmentLevel: 'medium',
    durationMonths: 24,
    complexity: 'normal',
    managementScope: ['pre-construction', 'bidding', 'construction', 'completion',
      'cost-management', 'schedule-management', 'quality-management', 'safety-management'],
  },
  '市政道路-小型': {
    projectType: 'municipal',
    investmentLevel: 'small',
    durationMonths: 12,
    complexity: 'simple',
    managementScope: ['pre-construction', 'bidding', 'construction', 'completion', 'safety-management'],
    hasTrafficImpact: true,
  },
  '工业厂房-大型': {
    projectType: 'industrial',
    investmentLevel: 'large',
    durationMonths: 36,
    complexity: 'complex',
    managementScope: ['pre-construction', 'bidding', 'construction', 'completion',
      'cost-management', 'schedule-management', 'quality-management', 'safety-management',
      'contract-management', 'document-management'],
  },
};
