/**
 * PMBOK 知识领域框架 — 静态知识数据
 * P1-4: 10大知识领域 + 8大绩效域 + 49过程定义
 */

export type KnowledgeAreaId = 'integration' | 'scope' | 'schedule' | 'cost' | 'quality' | 'resource' | 'communications' | 'risk' | 'procurement' | 'stakeholder';
export type ProcessGroup = 'initiating' | 'planning' | 'executing' | 'monitoring' | 'closing';
export type PerformanceDomainId = 'stakeholders' | 'team' | 'development' | 'planning' | 'project-work' | 'delivery' | 'measurement' | 'uncertainty';

export interface PMBOKProcess {
  id: string; name: string;
  processGroup: ProcessGroup;
  knowledgeArea: KnowledgeAreaId;
  description: string;
  linkedWorkItemIds: string[];
}

export interface PMBOKKnowledgeArea {
  id: KnowledgeAreaId;
  name: string; nameEn: string;
  description: string;
  processes: PMBOKProcess[];
  performanceDomainLinks: PerformanceDomainId[];
}

export interface PerformanceDomain {
  id: PerformanceDomainId;
  name: string; nameEn: string;
  description: string;
  principles: string[];
}

export const KNOWLEDGE_AREAS: PMBOKKnowledgeArea[] = [
  {
    id: 'integration', name: '项目整合管理', nameEn: 'Integration Management',
    description: '识别、定义、组合、统一和协调各项目管理过程',
    performanceDomainLinks: ['planning', 'project-work', 'measurement'],
    processes: [
      { id: '4.1', name: '制定项目章程', processGroup: 'initiating', knowledgeArea: 'integration', description: '编写正式批准项目并授权项目经理的文件', linkedWorkItemIds: ['1.1.1', '1.1.2'] },
      { id: '4.2', name: '制定项目管理计划', processGroup: 'planning', knowledgeArea: 'integration', description: '定义、准备和协调项目计划的各个组成部分', linkedWorkItemIds: ['1.2.1', '1.2.2'] },
      { id: '4.3', name: '指导与管理项目工作', processGroup: 'executing', knowledgeArea: 'integration', description: '领导并执行项目管理计划中定义的工作', linkedWorkItemIds: ['3.1.1', '3.1.2'] },
      { id: '4.4', name: '管理项目知识', processGroup: 'executing', knowledgeArea: 'integration', description: '使用现有知识并创造新知识', linkedWorkItemIds: ['3.11.1'] },
      { id: '4.5', name: '监控项目工作', processGroup: 'monitoring', knowledgeArea: 'integration', description: '跟踪、审查和报告项目整体进展', linkedWorkItemIds: ['3.4.1', '3.4.3'] },
      { id: '4.6', name: '实施整体变更控制', processGroup: 'monitoring', knowledgeArea: 'integration', description: '审查变更请求，批准变更并管理变更', linkedWorkItemIds: ['3.10.1', '3.10.2'] },
      { id: '4.7', name: '结束项目或阶段', processGroup: 'closing', knowledgeArea: 'integration', description: '完结所有项目活动，正式完成项目', linkedWorkItemIds: ['4.8.1', '4.8.2'] },
    ],
  },
  {
    id: 'scope', name: '项目范围管理', nameEn: 'Scope Management',
    description: '确保项目包含且仅包含成功完成项目所需的全部工作',
    performanceDomainLinks: ['planning', 'project-work', 'delivery'],
    processes: [
      { id: '5.1', name: '规划范围管理', processGroup: 'planning', knowledgeArea: 'scope', description: '创建范围管理计划', linkedWorkItemIds: ['1.2.3'] },
      { id: '5.2', name: '收集需求', processGroup: 'planning', knowledgeArea: 'scope', description: '确定、记录和管理干系人需求', linkedWorkItemIds: ['1.3.1'] },
      { id: '5.3', name: '定义范围', processGroup: 'planning', knowledgeArea: 'scope', description: '制定项目和产品的详细描述', linkedWorkItemIds: ['1.3.2'] },
      { id: '5.4', name: '创建WBS', processGroup: 'planning', knowledgeArea: 'scope', description: '将项目可交付成果分解为更小的工作组件', linkedWorkItemIds: ['3.2.1'] },
      { id: '5.5', name: '确认范围', processGroup: 'monitoring', knowledgeArea: 'scope', description: '正式验收已完成的项目可交付成果', linkedWorkItemIds: ['4.2.1'] },
      { id: '5.6', name: '控制范围', processGroup: 'monitoring', knowledgeArea: 'scope', description: '监督项目和产品范围状态，管理范围基准变更', linkedWorkItemIds: ['3.10.3'] },
    ],
  },
  {
    id: 'schedule', name: '项目进度管理', nameEn: 'Schedule Management',
    description: '确保项目按时完成所需的管理过程',
    performanceDomainLinks: ['planning', 'project-work', 'measurement'],
    processes: [
      { id: '6.1', name: '规划进度管理', processGroup: 'planning', knowledgeArea: 'schedule', description: '制定进度管理策略和计划', linkedWorkItemIds: ['1.2.1'] },
      { id: '6.2', name: '定义活动', processGroup: 'planning', knowledgeArea: 'schedule', description: '识别为产生项目可交付成果需采取的具体行动', linkedWorkItemIds: ['3.4.1'] },
      { id: '6.3', name: '排列活动顺序', processGroup: 'planning', knowledgeArea: 'schedule', description: '识别和记录项目活动之间的关系', linkedWorkItemIds: ['3.4.2'] },
      { id: '6.4', name: '估算活动持续时间', processGroup: 'planning', knowledgeArea: 'schedule', description: '估算完成各活动所需的工作量', linkedWorkItemIds: ['3.4.3'] },
      { id: '6.5', name: '制定进度计划', processGroup: 'planning', knowledgeArea: 'schedule', description: '创建项目进度模型并生成甘特图', linkedWorkItemIds: ['3.4.4'] },
      { id: '6.6', name: '控制进度', processGroup: 'monitoring', knowledgeArea: 'schedule', description: '监督项目状态以更新进度并管理基准变更', linkedWorkItemIds: ['3.4.5'] },
    ],
  },
  {
    id: 'cost', name: '项目成本管理', nameEn: 'Cost Management',
    description: '确保项目在批准的预算内完成',
    performanceDomainLinks: ['planning', 'measurement'],
    processes: [
      { id: '7.1', name: '规划成本管理', processGroup: 'planning', knowledgeArea: 'cost', description: '制定成本管理计划', linkedWorkItemIds: ['3.3.1'] },
      { id: '7.2', name: '估算成本', processGroup: 'planning', knowledgeArea: 'cost', description: '估算完成项目工作所需的资金', linkedWorkItemIds: ['3.3.2'] },
      { id: '7.3', name: '制定预算', processGroup: 'planning', knowledgeArea: 'cost', description: '汇总估算成本，建立经批准的成本基准', linkedWorkItemIds: ['3.3.3'] },
      { id: '7.4', name: '控制成本', processGroup: 'monitoring', knowledgeArea: 'cost', description: '监督项目状态以更新成本并管理基准变更', linkedWorkItemIds: ['3.3.5', '3.9.1'] },
    ],
  },
  {
    id: 'quality', name: '项目质量管理', nameEn: 'Quality Management',
    description: '确保项目满足其承担的需求',
    performanceDomainLinks: ['delivery', 'measurement'],
    processes: [
      { id: '8.1', name: '规划质量管理', processGroup: 'planning', knowledgeArea: 'quality', description: '识别质量要求和标准', linkedWorkItemIds: ['3.5.1'] },
      { id: '8.2', name: '管理质量', processGroup: 'executing', knowledgeArea: 'quality', description: '将质量政策转化为质量活动', linkedWorkItemIds: ['3.5.2', '3.5.3'] },
      { id: '8.3', name: '控制质量', processGroup: 'monitoring', knowledgeArea: 'quality', description: '监督和记录质量活动执行结果', linkedWorkItemIds: ['3.5.4', '3.5.5'] },
    ],
  },
  {
    id: 'resource', name: '项目资源管理', nameEn: 'Resource Management',
    description: '识别、获取和管理成功完成项目所需的资源',
    performanceDomainLinks: ['team'],
    processes: [
      { id: '9.1', name: '规划资源管理', processGroup: 'planning', knowledgeArea: 'resource', description: '定义如何估算、获取、管理团队和物理资源', linkedWorkItemIds: ['3.1.2'] },
      { id: '9.2', name: '估算活动资源', processGroup: 'planning', knowledgeArea: 'resource', description: '估算执行项目工作所需的团队和实物资源', linkedWorkItemIds: ['3.4.4'] },
      { id: '9.3', name: '获取资源', processGroup: 'executing', knowledgeArea: 'resource', description: '获取项目所需的团队成员和实物资源', linkedWorkItemIds: ['2.2.1'] },
      { id: '9.4', name: '建设团队', processGroup: 'executing', knowledgeArea: 'resource', description: '提高团队能力，促进团队互动', linkedWorkItemIds: [] },
      { id: '9.5', name: '管理团队', processGroup: 'executing', knowledgeArea: 'resource', description: '跟踪团队成员表现，提供反馈，解决冲突', linkedWorkItemIds: [] },
      { id: '9.6', name: '控制资源', processGroup: 'monitoring', knowledgeArea: 'resource', description: '确保资源按计划使用和释放', linkedWorkItemIds: [] },
    ],
  },
  {
    id: 'communications', name: '项目沟通管理', nameEn: 'Communications Management',
    description: '确保项目信息及时、恰当地生成、收集、分发、存储和最终处置',
    performanceDomainLinks: ['stakeholders', 'team'],
    processes: [
      { id: '10.1', name: '规划沟通管理', processGroup: 'planning', knowledgeArea: 'communications', description: '基于干系人需求，制定沟通方法和计划', linkedWorkItemIds: [] },
      { id: '10.2', name: '管理沟通', processGroup: 'executing', knowledgeArea: 'communications', description: '确保按沟通管理计划生成、收集和分发信息', linkedWorkItemIds: ['3.9.6'] },
      { id: '10.3', name: '监督沟通', processGroup: 'monitoring', knowledgeArea: 'communications', description: '确保满足项目干系人的信息需求', linkedWorkItemIds: [] },
    ],
  },
  {
    id: 'risk', name: '项目风险管理', nameEn: 'Risk Management',
    description: '识别、分析和应对项目风险',
    performanceDomainLinks: ['uncertainty', 'planning'],
    processes: [
      { id: '11.1', name: '规划风险管理', processGroup: 'planning', knowledgeArea: 'risk', description: '定义风险管理活动的方法', linkedWorkItemIds: ['1.6.1'] },
      { id: '11.2', name: '识别风险', processGroup: 'planning', knowledgeArea: 'risk', description: '识别可能影响项目的单个风险和整体风险源', linkedWorkItemIds: ['3.6.1'] },
      { id: '11.3', name: '实施定性风险分析', processGroup: 'planning', knowledgeArea: 'risk', description: '评估风险概率和影响，排列优先级', linkedWorkItemIds: ['3.6.2'] },
      { id: '11.4', name: '实施定量风险分析', processGroup: 'planning', knowledgeArea: 'risk', description: '对已识别的风险进行数值分析', linkedWorkItemIds: [] },
      { id: '11.5', name: '规划风险应对', processGroup: 'planning', knowledgeArea: 'risk', description: '制定风险应对策略和行动方案', linkedWorkItemIds: ['3.6.3'] },
      { id: '11.6', name: '实施风险应对', processGroup: 'executing', knowledgeArea: 'risk', description: '执行已商定的风险应对计划', linkedWorkItemIds: ['3.6.4'] },
      { id: '11.7', name: '监督风险', processGroup: 'monitoring', knowledgeArea: 'risk', description: '跟踪已识别风险，监测残余风险，识别新风险', linkedWorkItemIds: ['3.6.5'] },
    ],
  },
  {
    id: 'procurement', name: '项目采购管理', nameEn: 'Procurement Management',
    description: '采购或获取项目所需的产品、服务或成果',
    performanceDomainLinks: ['planning', 'project-work'],
    processes: [
      { id: '12.1', name: '规划采购管理', processGroup: 'planning', knowledgeArea: 'procurement', description: '记录项目采购决策，明确采购方式和识别潜在卖方', linkedWorkItemIds: ['2.1.1'] },
      { id: '12.2', name: '实施采购', processGroup: 'executing', knowledgeArea: 'procurement', description: '获取卖方应答，选择卖方并授予合同', linkedWorkItemIds: ['2.2.1', '2.2.2'] },
      { id: '12.3', name: '控制采购', processGroup: 'monitoring', knowledgeArea: 'procurement', description: '管理采购关系，监督合同绩效', linkedWorkItemIds: ['3.8.1', '3.8.2'] },
    ],
  },
  {
    id: 'stakeholder', name: '项目干系人管理', nameEn: 'Stakeholder Management',
    description: '识别并管理与项目有关的个人、群体或组织',
    performanceDomainLinks: ['stakeholders'],
    processes: [
      { id: '13.1', name: '识别干系人', processGroup: 'initiating', knowledgeArea: 'stakeholder', description: '定期识别项目干系人，分析其期望和影响', linkedWorkItemIds: ['1.3.1'] },
      { id: '13.2', name: '规划干系人参与', processGroup: 'planning', knowledgeArea: 'stakeholder', description: '制定让干系人有效参与项目决策和执行的策略', linkedWorkItemIds: [] },
      { id: '13.3', name: '管理干系人参与', processGroup: 'executing', knowledgeArea: 'stakeholder', description: '与干系人沟通协作，满足其需求和期望', linkedWorkItemIds: [] },
      { id: '13.4', name: '监督干系人参与', processGroup: 'monitoring', knowledgeArea: 'stakeholder', description: '监督干系人关系，调整参与策略', linkedWorkItemIds: [] },
    ],
  },
];

export const PERFORMANCE_DOMAINS: PerformanceDomain[] = [
  { id: 'stakeholders', name: '干系人', nameEn: 'Stakeholders', description: '与干系人建立富有成效的工作关系', principles: ['识别', '理解', '分析', '优先排序', '参与', '监督'] },
  { id: 'team', name: '团队', nameEn: 'Team', description: '打造高绩效的项目团队', principles: ['共享责任', '高绩效文化', '领导力技能', '定制化'] },
  { id: 'development', name: '开发方法和生命周期', nameEn: 'Development Approach & Life Cycle', description: '选择适合项目的开发方法和项目生命周期', principles: ['可交付成果节奏', '开发方法', '阶段'] },
  { id: 'planning', name: '规划', nameEn: 'Planning', description: '有组织地制定和执行项目计划', principles: ['逐步细化', '整合', '范围/进度/成本/质量'] },
  { id: 'project-work', name: '项目工作', nameEn: 'Project Work', description: '有效执行项目工作，实现预期成果', principles: ['管理资源', '优化流程', '持续改进'] },
  { id: 'delivery', name: '交付', nameEn: 'Delivery', description: '按计划交付项目成果，实现预期价值', principles: ['需求管理', '范围确认', '质量保证', '验收移交'] },
  { id: 'measurement', name: '度量', nameEn: 'Measurement', description: '通过数据和指标评估项目绩效', principles: ['有效度量', '指标驱动', '决策支持'] },
  { id: 'uncertainty', name: '不确定性', nameEn: 'Uncertainty', description: '识别和管理项目中的不确定性因素', principles: ['风险', '模糊性', '复杂性', '波动性'] },
];

/** 计算项目PMBOK覆盖率 */
export function computePMBOKCoverage(
  completedWorkItemIds: string[]
): { areaId: KnowledgeAreaId; covered: number; total: number; score: number }[] {
  return KNOWLEDGE_AREAS.map(area => {
    const processesWithItems = area.processes.filter(p => p.linkedWorkItemIds.length > 0);
    const covered = processesWithItems.filter(p =>
      p.linkedWorkItemIds.some(wid => completedWorkItemIds.includes(wid))
    ).length;
    return {
      areaId: area.id,
      covered,
      total: processesWithItems.length || 1,
      score: processesWithItems.length > 0 ? Math.round((covered / processesWithItems.length) * 100) : 0,
    };
  });
}
