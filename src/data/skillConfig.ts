/**
 * 技能配置中心 — 统一管理所有系统技能的定义、部署位置、8段模板
 * 新增技能只需在此文件中添加配置，无需修改SkillPanel或skillRegistry
 */

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  category: 'review' | 'generate' | 'fill' | 'guide' | 'analysis';
  location: {
    page: string;      // 所在页面名称
    view: string;       // App.tsx 中的 view 路由
    desc: string;       // 使用说明
  };
  icon: string;         // emoji图标
}

/** 系统预设技能配置（代码层面） */
export const PRESET_SKILL_CONFIGS: SkillConfig[] = [
  {
    id: 'ai_chat', name: '通用AI对话', category: 'analysis',
    description: '调用AI模型进行分析、总结、问答等通用任务',
    location: { page: 'AI智能体', view: 'agent-console', desc: '输入目标让Agent自主规划执行多步任务' },
    icon: '💬',
  },
  {
    id: 'construction-review', name: '施工方案审查', category: 'review',
    description: '对施工组织设计进行AI逐章审查，输出合规性报告',
    location: { page: '施工方案审查', view: 'construction-review', desc: '上传施工组织设计，AI逐章审查并生成合规报告' },
    icon: '🔍',
  },
  {
    id: 'contract-review', name: '合同审查', category: 'review',
    description: '识别合同条款风险并提出修改建议',
    location: { page: '合同审查', view: 'contract-review', desc: '上传合同文件，AI识别条款风险并给出修改建议' },
    icon: '📄',
  },
  {
    id: 'bid-review', name: '招投标审查', category: 'review',
    description: '检查招投标文件合规性（9要素）',
    location: { page: '招投标文件审查', view: 'bid-review', desc: '上传招投标文件，AI检查9要素合规性' },
    icon: '📋',
  },
  {
    id: 'plan-generate', name: 'AI方案生成', category: 'generate',
    description: '根据模板和参数逐章生成工程方案',
    location: { page: '方案生成', view: 'plan-generator', desc: '选择模板和章节，AI逐章生成工程方案' },
    icon: '✍️',
  },
  {
    id: 'ai-fill-form', name: 'AI表单填写', category: 'fill',
    description: '根据项目上下文自动填写工程表单',
    location: { page: '工作指南 → 附表清单', view: 'guide-chapter', desc: '在附表清单中点击AI自动填写表单' },
    icon: '📝',
  },
  {
    id: 'ai-guide-notes', name: 'AI办理指南', category: 'guide',
    description: '根据附件和工作项信息生成办理指南',
    location: { page: '工作指南 → 添加工作项', view: 'guide-chapter', desc: '添加/编辑工作项时，点击AI生成办理指南' },
    icon: '📖',
  },
  {
    id: 'ai-breakdown-tasks', name: 'AI拆解子任务', category: 'guide',
    description: '根据流程图或描述拆解工作项为详细子任务',
    location: { page: '工作指南 → 添加工作项', view: 'guide-chapter', desc: '添加/编辑工作项时，点击AI拆解子任务' },
    icon: '🔨',
  },
];

/** 加载用户自定义技能（管理员可增删改） */
export function loadCustomSkills(): SkillConfig[] {
  try {
    const raw = localStorage.getItem('custom-skills-config');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 保存自定义技能 */
export function saveCustomSkills(skills: SkillConfig[]): void {
  localStorage.setItem('custom-skills-config', JSON.stringify(skills));
}

/** 获取全部可用技能配置（预设 + 自定义） */
export function getAllSkillConfigs(): SkillConfig[] {
  return [...PRESET_SKILL_CONFIGS, ...loadCustomSkills()];
}

/** 按ID获取技能配置 */
export function getSkillConfig(id: string): SkillConfig | undefined {
  return getAllSkillConfigs().find(s => s.id === id);
}
