/**
 * 自动化工作流引擎
 * P2-1: Agent/Skill/MCP 串联执行
 */

import { engineeringAgent } from './agentFramework';
import { skillRegistry } from './skillRegistry';
import { mcpRegistry } from './mcpAgentBridge';
import type { WorkflowDefinition, WorkflowInstance, AgentContext } from '../types';

// ===== 预设工作流模板 =====
export const PRESET_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'wf-project-health',
    name: '项目健康检查',
    description: '扫描工作项+计算KPI+AI分析，生成健康报告',
    version: 1,
    steps: [
      { id: 'step1', name: '计算KPI指标', type: 'skill', skillId: 'ai_chat', params: { query: '计算项目KPI指标（CPI/SPI/完整度/质量分）' } },
      { id: 'step2', name: '扫描工作项', type: 'skill', skillId: 'ai_chat', params: { query: '扫描项目工作项，检测过期和未完成' } },
      { id: 'step3', name: 'AI综合报告', type: 'skill', skillId: 'ai_chat', params: { query: '根据KPI和工作项扫描结果，生成项目健康检查综合报告' } },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wf-document-review',
    name: '文档智能审查',
    description: '上传文档→RAG检索标准→AI审查→生成报告',
    version: 1,
    steps: [
      { id: 'step1', name: '知识库检索', type: 'skill', skillId: 'construction-review', params: { ragEnabled: true } },
      { id: 'step2', name: 'AI审查', type: 'skill', skillId: 'construction-review', params: { fileContent: '' } },
      { id: 'step3', name: '生成审查报告', type: 'skill', skillId: 'ai_chat', params: { query: '根据审查结果生成正式审查报告' } },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wf-plan-generation',
    name: '方案自动生成',
    description: '检索规范→生成大纲→逐章编写→完整性校验',
    version: 1,
    steps: [
      { id: 'step1', name: '检索标准规范', type: 'skill', skillId: 'ai_chat', params: { query: '检索相关标准规范和模板' } },
      { id: 'step2', name: '生成方案大纲', type: 'skill', skillId: 'plan-generate', params: { planType: '施工组织设计' } },
      { id: 'step3', name: '完整性校验', type: 'skill', skillId: 'ai_chat', params: { query: '检查方案完整性和合规性' } },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wf-form-autofill',
    name: '表单批量填写',
    description: '扫描缺失表单→AI智能填写→保存',
    version: 1,
    steps: [
      { id: 'step1', name: '扫描缺失表单', type: 'skill', skillId: 'ai_chat', params: { query: '扫描项目所有表单，找出空白的' } },
      { id: 'step2', name: 'AI批量填写', type: 'skill', skillId: 'ai-fill-form', params: { formCode: 'all' } },
      { id: 'step3', name: '确认结果', type: 'human-approval', params: { approvalPrompt: '请确认AI填写的表单内容' } },
    ],
    createdAt: new Date().toISOString(),
  },
];

/** 执行一个工作流 */
export async function executeWorkflow(
  definition: WorkflowDefinition,
  projectName: string
): Promise<WorkflowInstance> {
  const instance: WorkflowInstance = {
    id: `wf-${Date.now()}`,
    workflowId: definition.id,
    projectName,
    status: 'running',
    currentStepIndex: 0,
    context: {},
    startedAt: new Date().toISOString(),
  };

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    instance.currentStepIndex = i;

    try {
      switch (step.type) {
        case 'skill':
          if (step.skillId) {
            const result = await skillRegistry.execute(step.skillId, {
              projectName,
              params: step.params || {},
            }, { projectName, userId: 'admin' });
            (instance.context as any)[step.id] = result;
          }
          break;
        case 'agent-task':
          if (step.agentGoal) {
            const ctx: AgentContext = { projectName, userId: 'admin', conversationId: instance.id, history: [], memory: new Map() };
            const task = await engineeringAgent.plan(step.agentGoal, ctx);
            await engineeringAgent.execute(task, ctx);
            (instance.context as any)[step.id] = task.result;
          }
          break;
        case 'mcp-tool':
          if (step.toolName) {
            const result = await mcpRegistry.callTool(step.toolName, step.params || {});
            (instance.context as any)[step.id] = result;
          }
          break;
        case 'human-approval':
          // 在UI层处理，此处跳过
          (instance.context as any)[step.id] = { status: 'pending-approval', message: step.params?.approvalPrompt || '需要审批' };
          break;
        default:
          (instance.context as any)[step.id] = { status: 'skipped' };
      }
    } catch (e: any) {
      (instance.context as any)[step.id] = { status: 'failed', error: e.message };
    }
  }

  instance.status = 'completed';
  instance.completedAt = new Date().toISOString();
  return instance;
}

/** 获取所有预设工作流 */
export function getPresetWorkflows(): WorkflowDefinition[] {
  return PRESET_WORKFLOWS;
}

/** 加载自定义工作流 */
export function loadWorkflows(): WorkflowDefinition[] {
  try {
    const raw = localStorage.getItem('custom-workflows');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 保存自定义工作流 */
export function saveWorkflow(wf: WorkflowDefinition): void {
  const existing = loadWorkflows();
  const idx = existing.findIndex(w => w.id === wf.id);
  if (idx >= 0) existing[idx] = wf;
  else existing.push(wf);
  localStorage.setItem('custom-workflows', JSON.stringify(existing));
}
