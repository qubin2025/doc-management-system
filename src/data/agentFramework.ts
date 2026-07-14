/**
 * Agent 智能体框架 — ReAct推理循环 + 工具注册/调用 + 错误恢复
 * P1-1: 将AI能力从"手动触发"升级为"Agent自主规划执行"
 */

import * as api from './api';
import { computeIndicators } from './indicatorEngine';
import { scanWorkItems, scanForms } from './aiAgent';
import { orchestrator } from './knowledgeOrchestrator';
import { buildGraph } from './knowledgeGraph';
import { vectorStore } from './vectorStore';

// ===== 核心类型 =====
export interface AgentAction {
  name: string;
  description: string;
  category: 'query' | 'compute' | 'mutate' | 'knowledge' | 'system';
  handler: (params: Record<string, unknown>, context: AgentContext) => Promise<ActionResult>;
  requiresConfirmation?: boolean;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentContext {
  projectName: string;
  userId: string;
  conversationId: string;
  history: AgentStep[];
  memory: Map<string, unknown>;
}

export interface AgentStep {
  stepIndex: number;
  thought: string;
  actionName: string | null;
  actionParams: Record<string, unknown> | null;
  observation: string | null;
  completedAt: string | null;
  status: 'pending' | 'thinking' | 'executing' | 'completed' | 'failed';
}

export interface AgentTask {
  id: string;
  goal: string;
  steps: AgentStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';
  maxSteps: number;
  startedAt: string;
  completedAt?: string;
  result?: string;
}

export interface ErrorRecord {
  step: number;
  action: string;
  error: string;
  recovery: 'retry' | 'skip' | 'fallback' | 'abort';
}

// ===== ReAct 提示模版 =====
const PLANNING_SYSTEM_PROMPT = `你是全过程工程咨询管理系统的AI智能体。你的任务是根据用户目标，制定多步执行计划。

可用工具：
{tools}

请输出JSON格式的执行计划：
{
  "goal": "用户目标描述",
  "steps": [
    { "step": 1, "thought": "推理：为什么需要这一步", "action": "工具名", "params": {参数} }
  ]
}

规则：
1. 每步必须使用可用工具列表中的工具
2. 最多{maxSteps}步
3. 查询类工具(query/category:query)不需要确认，变更类工具(mutate)需要用户确认
4. 如果信息不足，先查询再变更
5. 输出必须是合法的JSON`;

// ===== Agent 核心类 =====
export class EngineeringAgent {
  private tools = new Map<string, AgentAction>();
  public onStepComplete?: (step: AgentStep) => void;
  public onError?: (error: ErrorRecord) => void;
  public onConfirm?: (action: string, params: Record<string, unknown>) => Promise<boolean>;

  constructor() {
    this.registerBuiltInTools();
  }

  registerTool(action: AgentAction): void {
    this.tools.set(action.name, action);
    console.log(`[Agent] Tool registered: ${action.name} (${action.category})`);
  }

  getTool(name: string): AgentAction | undefined {
    return this.tools.get(name);
  }

  listTools(): { name: string; description: string; category: string }[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name, description: t.description, category: t.category,
    }));
  }

  /** 目标→执行计划 */
  async plan(goal: string, context: AgentContext, maxSteps = 5): Promise<AgentTask> {
    const toolList = this.listTools().map(t => `- ${t.name} (${t.category}): ${t.description}`).join('\n');
    const prompt = PLANNING_SYSTEM_PROMPT.replace('{tools}', toolList).replace('{maxSteps}', String(maxSteps));

    try {
      const reply = await api.aiChat(
        [{ role: 'user', content: `用户目标: ${goal}\n项目: ${context.projectName}\n请输出执行计划JSON。` }],
        prompt, { projectName: context.projectName }
      );

      // 解析JSON
      const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, reply];
      const plan = JSON.parse(jsonMatch[1].trim());

      const steps: AgentStep[] = (plan.steps || []).map((s: any, i: number) => ({
        stepIndex: i,
        thought: s.thought || `执行第${i + 1}步`,
        actionName: s.action || s.actionName || null,
        actionParams: s.params || s.actionParams || {},
        observation: null,
        completedAt: null,
        status: 'pending' as const,
      }));

      return {
        id: `task-${Date.now()}`,
        goal,
        steps,
        currentStep: 0,
        status: 'executing',
        maxSteps,
        startedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      // 规划失败，创建单步fallback任务
      return {
        id: `task-${Date.now()}`,
        goal,
        steps: [{
          stepIndex: 0,
          thought: `直接用AI分析: ${goal}`,
          actionName: 'ai_chat',
          actionParams: { query: goal },
          observation: null,
          completedAt: null,
          status: 'pending',
        }],
        currentStep: 0,
        status: 'executing',
        maxSteps,
        startedAt: new Date().toISOString(),
      };
    }
  }

  /** 执行一个步骤 */
  async executeStep(step: AgentStep, context: AgentContext): Promise<AgentStep> {
    step.status = 'executing';
    step.completedAt = null;

    if (!step.actionName) {
      step.observation = '无操作（推理步骤）';
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      return step;
    }

    const tool = this.tools.get(step.actionName);
    if (!tool) {
      step.observation = `工具 "${step.actionName}" 不存在`;
      step.status = 'failed';
      return step;
    }

    // 确认检查
    if (tool.requiresConfirmation && this.onConfirm) {
      const confirmed = await this.onConfirm(step.actionName, step.actionParams || {});
      if (!confirmed) {
        step.observation = '用户取消了操作';
        step.status = 'completed';
        step.completedAt = new Date().toISOString();
        return step;
      }
    }

    try {
      const result = await tool.handler(step.actionParams || {}, context);
      step.observation = result.success
        ? JSON.stringify(result.data || '执行成功').slice(0, 500)
        : `执行失败: ${result.error}`;
      step.status = result.success ? 'completed' : 'failed';
    } catch (e: any) {
      step.observation = `异常: ${e.message}`;
      step.status = 'failed';
    }

    step.completedAt = new Date().toISOString();
    return step;
  }

  /** 错误恢复 */
  async recover(error: ErrorRecord, step: AgentStep, context: AgentContext): Promise<AgentStep | null> {
    switch (error.recovery) {
      case 'retry':
        return await this.executeStep(step, context);
      case 'skip':
        step.status = 'completed';
        step.observation = `跳过（原始错误: ${error.error}）`;
        step.completedAt = new Date().toISOString();
        return step;
      case 'fallback':
        step.actionName = 'ai_chat';
        step.actionParams = { query: step.thought };
        return await this.executeStep(step, context);
      case 'abort':
      default:
        step.status = 'failed';
        step.observation = `中止: ${error.error}`;
        return step;
    }
  }

  /** 执行完整任务 */
  async execute(task: AgentTask, context: AgentContext): Promise<AgentTask> {
    if (task.status !== 'executing') return task;

    for (let i = task.currentStep; i < task.steps.length; i++) {
      const step = task.steps[i];
      task.currentStep = i;

      // 执行步骤
      const executed = await this.executeStep(step, context);
      task.steps[i] = executed;

      if (this.onStepComplete) this.onStepComplete(executed);

      // 错误处理
      if (executed.status === 'failed') {
        const errRecord: ErrorRecord = {
          step: i,
          action: executed.actionName || 'unknown',
          error: executed.observation || '未知错误',
          recovery: i < task.maxSteps - 1 ? 'fallback' : 'skip',
        };
        if (this.onError) this.onError(errRecord);

        const recovered = await this.recover(errRecord, executed, context);
        if (recovered) task.steps[i] = recovered;
        if (errRecord.recovery === 'abort') {
          task.status = 'failed';
          task.result = `第${i + 1}步失败: ${errRecord.error}`;
          return task;
        }
      }
    }

    // 汇总结果
    const summary = task.steps
      .map(s => `步骤${s.stepIndex + 1}: ${s.status === 'completed' ? '✓' : '✗'} ${s.thought} → ${(s.observation || '').slice(0, 80)}`)
      .join('\n');

    try {
      const finalReply = await api.aiChat(
        [{ role: 'user', content: `任务执行完毕，请根据以下步骤结果，生成一份格式化的HTML综合报告。\n\n执行步骤:\n${summary}\n\n用户原始目标: ${task.goal}\n\nHTML报告要求:\n1. 使用完整的HTML结构，包含<style>内联样式\n2. 风格参考专业项目管理报告：深色背景(#f8fafc卡片)、蓝色标题(#1e40af)\n3. 包含: 报告标题、执行摘要、步骤详情表格、关键发现、建议行动\n4. 每个步骤用✓/✗标记成功/失败\n5. 如果有KPI数据，用彩色进度条展示\n6. 字体使用系统默认中文无衬线字体\n7. 整体风格简洁专业` }],
        '你是项目管理AI报告生成器。请返回完整的HTML文档，使用内联样式。只输出HTML代码，不要```html标记。',
        { projectName: context.projectName }
      );
      // 提取HTML内容（去除可能的markdown包裹）
      const html = finalReply.replace(/```html\n?/g, '').replace(/\n?```/g, '').trim();
      task.result = html || summary;
    } catch {
      task.result = `<div style="font-family:sans-serif;padding:20px"><h2 style="color:#dc2626">报告生成失败</h2><pre>${summary}</pre></div>`;
    }

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    return task;
  }

  // ===== 内置工具注册 =====
  private registerBuiltInTools(): void {
    // 查询类
    this.registerTool({
      name: 'ai_chat', description: '通用AI对话/分析', category: 'query',
      handler: async (params, ctx) => {
        const reply = await api.aiChat(
          [{ role: 'user', content: String(params.query || '') }],
          undefined,
          { projectName: ctx.projectName, model: params.model as string | undefined }
        );
        return { success: true, data: reply };
      },
    });

    this.registerTool({
      name: 'compute_kpi', description: '计算项目KPI指标(CPI/SPI/完整度/质量分)', category: 'compute',
      handler: async (_params, ctx) => {
        const indicators = computeIndicators(ctx.projectName);
        return { success: true, data: indicators };
      },
    });

    this.registerTool({
      name: 'scan_workitems', description: '扫描项目工作项，检测过期/未完成', category: 'compute',
      handler: async (_params, ctx) => {
        const result = scanWorkItems(ctx.projectName);
        return { success: true, data: result };
      },
    });

    this.registerTool({
      name: 'scan_forms', description: '扫描项目表单，检测缺失表单', category: 'compute',
      handler: async (_params, ctx) => {
        const result = scanForms(ctx.projectName);
        return { success: true, data: result };
      },
    });

    this.registerTool({
      name: 'knowledge_search', description: '在项目知识库中搜索', category: 'knowledge',
      handler: async (params) => {
        const result = await orchestrator.search({
          query: String(params.query || ''),
          projectName: params.projectName as string,
          mode: (params.mode as 'auto' | 'hybrid' | 'semantic' | 'fulltext') || 'auto',
          topK: (params.topK as number) || 5,
        });
        return { success: true, data: result };
      },
    });

    this.registerTool({
      name: 'knowledge_graph', description: '获取项目知识图谱', category: 'knowledge',
      handler: async () => {
        const graph = buildGraph();
        return { success: true, data: { nodes: graph?.nodes.length || 0, edges: graph?.edges.length || 0 } };
      },
    });

    this.registerTool({
      name: 'rag_search', description: 'RAG检索增强问答', category: 'knowledge',
      handler: async (params, ctx) => {
        const { ragQuery } = await import('./ragService');
        const result = await ragQuery(String(params.query || ''), ctx.projectName, {
          topK: (params.topK as number) || 3,
        });
        return { success: true, data: result.answer };
      },
    });

    // 变更类（需确认）
    this.registerTool({
      name: 'index_document', description: '将文本索引到知识库', category: 'mutate',
      requiresConfirmation: true,
      handler: async (params, ctx) => {
        const embedding = await api.embedText(String(params.text || ''), 'document');
        if (embedding && embedding.length > 0) {
          vectorStore.addDocument(String(params.text || ''), embedding, {
            projectName: ctx.projectName,
            fileName: String(params.fileName || 'agent-index'),
            uploadTime: new Date().toISOString(),
          });
        }
        return { success: true, data: { indexed: embedding ? 1 : 0 } };
      },
    });

    this.registerTool({
      name: 'fill_form', description: 'AI填写工程表单', category: 'mutate',
      requiresConfirmation: true,
      handler: async (params, ctx) => {
        const result = await api.aiFillForm(
          String(params.formCode || ''),
          String(params.formName || ''),
          (params.fields as any[]) || [],
          { name: ctx.projectName }
        );
        return { success: true, data: result };
      },
    });

    this.registerTool({
      name: 'health_check', description: '检查系统所有服务状态', category: 'system',
      handler: async () => {
        const health = await orchestrator.health();
        return { success: true, data: health };
      },
    });
  }
}

// 全局单例
export const engineeringAgent = new EngineeringAgent();
