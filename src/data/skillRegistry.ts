/**
 * Skill 技能注册表 — 领域能力封装
 * P1-2: 将审查/生成/填表封装为可组合Skill
 */

import type { SkillDefinition, SkillInput, SkillContext, SkillResult } from '../types';
import * as api from './api';
import { orchestrator } from './knowledgeOrchestrator';

// ===== 全局注册表 =====
class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
    console.log(`[Skill] Registered: ${skill.id} (${skill.category})`);
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  list(category?: string): Array<{ id: string; name: string; description: string; category: string; icon: string }> {
    return Array.from(this.skills.values())
      .filter(s => !category || s.category === category)
      .map(s => ({ id: s.id, name: s.name, description: s.description, category: s.category, icon: s.icon }));
  }

  async execute(id: string, input: SkillInput, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(id);
    if (!skill) return { success: false, duration: 0, report: `技能 "${id}" 未找到` };

    const startTime = performance.now();
    try {
      const result = await skill.executor(input, context);
      result.duration = Math.round(performance.now() - startTime);
      return result;
    } catch (e: any) {
      return { success: false, duration: Math.round(performance.now() - startTime), report: e.message };
    }
  }
}

export const skillRegistry = new SkillRegistry();

// ===== 注册7个技能 =====

// 1. AI表单填写
skillRegistry.register({
  id: 'ai-fill-form',
  name: 'AI表单填写',
  description: '根据项目上下文自动填写工程表单',
  category: 'fill',
  icon: 'FileText',
  tags: ['表单', 'AI', '自动填写'],
  executor: async (input, ctx) => {
    const formCode = String(input.params.formCode || '');
    const formName = String(input.params.formName || '');
    const fields = (input.params.fields as any[]) || [];
    const result = await api.aiFillForm(formCode, formName, fields, { name: ctx.projectName });
    return { success: true, data: result, report: 'AI表单填写完成', duration: 0 };
  },
  agentActionName: 'fill_form',
});

// 2. AI办理指南
skillRegistry.register({
  id: 'ai-guide-notes',
  name: 'AI办理指南',
  description: '根据附件和工作项信息生成办理指南',
  category: 'guide',
  icon: 'BookOpen',
  tags: ['指南', '办理', 'AI'],
  executor: async (input, ctx) => {
    const itemName = String(input.params.itemName || '');
    const attachmentInfo = String(input.params.attachmentInfo || '');
    const prompt = `为工作项"${itemName}"生成办理指南。${attachmentInfo ? `附件信息：${attachmentInfo}` : ''}`;
    const guide = await api.aiChat(
      [{ role: 'user', content: prompt }],
      '你是工程管理专家，请生成简洁实用的办理指南，包括办理流程、所需材料、注意事项。',
      { projectName: ctx.projectName }
    );
    return { success: true, data: guide, report: '办理指南已生成', duration: 0 };
  },
  agentActionName: 'ai_chat',
});

// 3. AI拆解子任务
skillRegistry.register({
  id: 'ai-breakdown-tasks',
  name: 'AI拆解子任务',
  description: '根据流程图或描述拆解工作项为详细子任务',
  category: 'guide',
  icon: 'GitBranch',
  tags: ['拆解', '子任务', 'WBS'],
  executor: async (input, ctx) => {
    const itemName = String(input.params.itemName || '');
    const description = String(input.params.description || '');
    const result = await api.aiChat(
      [{ role: 'user', content: `请将"${itemName}"拆解为具体的子任务步骤（JSON数组格式）。${description ? `要求：${description}` : ''}` }],
      '你是项目管理专家，请将工作项拆解为具体可执行的子任务，输出JSON数组格式：[{name, duration?, resource?}]',
      { projectName: ctx.projectName }
    );
    return { success: true, data: result, report: '子任务拆解完成', duration: 0 };
  },
  agentActionName: 'ai_chat',
});

// 4. 施工方案审查
skillRegistry.register({
  id: 'construction-review',
  name: '施工方案审查',
  description: '对施工组织设计进行AI逐章审查',
  category: 'review',
  icon: 'ClipboardCheck',
  tags: ['审查', '施工', '方案'],
  executor: async (input, ctx) => {
    const fileContent = String(input.params.fileContent || '');
    const ragEnabled = !!input.params.ragEnabled;
    let context = fileContent.slice(0, 8000);

    if (ragEnabled) {
      try {
        const searchResult = await orchestrator.search({
          query: '施工组织设计审查标准规范条款', projectName: ctx.projectName, mode: 'auto', topK: 3,
        });
        if (searchResult.items.length > 0) {
          context = searchResult.items.map(i => i.content).join('\n---\n') + '\n\n' + context;
        }
      } catch { /* RAG不可用 */ }
    }

    const result = await api.aiChat(
      [{ role: 'user', content: `请对以下施工组织设计进行审查，输出JSON格式：{sections:[{name,status:pass|warn|fail,comment,standard}]}\n\n${context}` }],
      '你是建筑工程审查专家，请逐项审查施工组织设计，指出合规性和完整性问题。',
      { projectName: ctx.projectName }
    );
    return { success: true, data: result, report: '施工方案审查完成', duration: 0 };
  },
  agentActionName: 'ai_chat',
});

// 5. 合同审查
skillRegistry.register({
  id: 'contract-review',
  name: '合同审查',
  description: '识别合同条款风险并提出修改建议',
  category: 'review',
  icon: 'FileCheck',
  tags: ['审查', '合同', '风险'],
  executor: async (input, ctx) => {
    const fileContent = String(input.params.fileContent || '');
    const result = await api.aiChat(
      [{ role: 'user', content: `请对以下合同条款进行风险审查，输出JSON格式：{clauses:[{name,risk:high|medium|low,suggestion,reason}]}\n\n${fileContent.slice(0, 8000)}` }],
      '你是合同审查专家，请识别条款风险（高/中/低）并给出修改建议。',
      { projectName: ctx.projectName }
    );
    return { success: true, data: result, report: '合同审查完成', duration: 0 };
  },
  agentActionName: 'ai_chat',
});

// 6. 招投标审查
skillRegistry.register({
  id: 'bid-review',
  name: '招投标审查',
  description: '检查招投标文件合规性（9要素）',
  category: 'review',
  icon: 'FileSearch',
  tags: ['审查', '招投标', '合规'],
  executor: async (input, ctx) => {
    const fileContent = String(input.params.fileContent || '');
    const result = await api.aiChat(
      [{ role: 'user', content: `请检查招投标文件是否包含以下9要素，输出JSON：{elements:[{name,found:bool,comment}]}\n投标人资格、评标办法、工程量清单、技术标准、合同条款、投标保证金、履约担保、质量要求、工期要求\n\n文件内容：${fileContent.slice(0, 8000)}` }],
      '你是招投标专家，请检查文件合规性。',
      { projectName: ctx.projectName }
    );
    return { success: true, data: result, report: '招投标审查完成', duration: 0 };
  },
  agentActionName: 'ai_chat',
});

// 7. 方案生成
skillRegistry.register({
  id: 'plan-generate',
  name: 'AI方案生成',
  description: '根据模板和参数逐章生成工程方案',
  category: 'generate',
  icon: 'Sparkles',
  tags: ['生成', '方案', '模板'],
  executor: async (input, ctx) => {
    const planType = String(input.params.planType || '施工组织设计');
    const chapterName = String(input.params.chapterName || '');
    const wordCount = Number(input.params.wordCount || 800);
    const kbContext = String(input.params.kbContext || '');
    const stdContent = String(input.params.stdContent || '');

    const prompt = chapterName
      ? `请生成"${planType}"中"${chapterName}"章节的内容，约${wordCount}字。\n${kbContext}${stdContent}`
      : `请生成"${planType}"的完整方案大纲和各章节要点。\n${kbContext}`;

    const result = await api.aiChat(
      [{ role: 'user', content: prompt }],
      '你是工程方案编写专家，请生成专业、规范的工程方案内容。',
      { projectName: ctx.projectName }
    );
    return { success: true, data: result, report: '方案生成完成', duration: 0 };
  },
  agentActionName: 'ai_chat',
});

export default skillRegistry;
