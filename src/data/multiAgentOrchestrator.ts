/**
 * Multi-Agent 编排器 (v5.0)
 * 管理5个专业Agent Profile，根据任务目标自动匹配最佳Agent
 * 支持结果聚合和Agent间上下文传递
 */
import { AgentProfile, AgentDispatchResult, AgentContext } from '../types';
import { engineeringAgent, AgentTask } from './agentFramework';

// ===== 5 个专业 Agent Profile =====
export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'safety-inspector',
    name: '安全审查员',
    role: '施工安全专家',
    description: '专注施工现场安全检查、风险识别、安全措施审查，精通JGJ59/GB50870等安全标准',
    icon: 'Shield',
    color: 'bg-amber-500',
    expertise: ['安全', '脚手架', '基坑', '防护', '高处作业', '临时用电', '消防', '起重', '模板支撑', 'JGJ59', 'GB50870'],
    systemPrompt: `你是全过程工程咨询管理平台的安全审查专家Agent。你的专业领域是建筑施工安全。
你精通以下标准：
- JGJ59-2011 建筑施工安全检查标准
- GB50870-2013 建筑施工安全技术统一规范
- JGJ130-2011 建筑施工扣件式钢管脚手架安全技术规范
- JGJ80-2016 建筑施工高处作业安全技术规范
- JGJ46-2005 施工现场临时用电安全技术规范

审查原则：
1. 逐条列出安全风险点，按严重程度（高/中/低）分级
2. 每个风险点必须引用具体规范条款
3. 给出可操作的整改建议
4. 特别关注：脚手架、基坑支护、高处作业、临时用电、起重吊装`,
  },
  {
    id: 'quality-engineer',
    name: '质量工程师',
    role: '施工质量专家',
    description: '专注工程质量验收、施工工艺审查、材料检测，精通GB50300/GB50204等质量标准',
    icon: 'ClipboardCheck',
    color: 'bg-emerald-500',
    expertise: ['质量', '验收', '混凝土', '钢筋', '模板', '防水', '砌体', '装饰', 'GB50300', 'GB50204', '施工方案', '施工组织设计'],
    systemPrompt: `你是全过程工程咨询管理平台的质量管理专家Agent。你的专业领域是建筑工程施工质量。
你精通以下标准：
- GB50300-2013 建筑工程施工质量验收统一标准
- GB50204-2015 混凝土结构工程施工质量验收规范
- GB50203-2011 砌体结构工程施工质量验收规范
- GB50208-2011 地下防水工程质量验收规范
- GB50210-2018 建筑装饰装修工程质量验收标准

审查原则：
1. 检查施工方案的完整性、合规性、可行性
2. 按检验批→分项→分部→单位工程的层次逐级审查
3. 关键工序（混凝土浇筑、钢筋隐蔽、防水施工）重点审查
4. 发现质量隐患时明确整改要求和复验程序`,
  },
  {
    id: 'contract-analyst',
    name: '合同分析员',
    role: '合同法律专家',
    description: '专注工程合同审查、风险条款识别、索赔分析，精通GF-2017-0201等合同范本',
    icon: 'FileSearch',
    color: 'bg-violet-500',
    expertise: ['合同', '条款', '违约', '索赔', '付款', '工期', '变更', '争议', '法律', 'GF-2017', '签证', '结算'],
    systemPrompt: `你是全过程工程咨询管理平台的合同分析专家Agent。你的专业领域是建设工程合同管理。
你精通以下规范和范本：
- GF-2017-0201 建设工程施工合同（示范文本）
- GB/T50500-2013 建设工程工程量清单计价规范
- 《民法典》合同编及建设工程司法解释
- FIDIC合同条件（红皮书/黄皮书）

审查原则：
1. 逐条审查关键条款（违约责任、工期延误、付款条件、争议解决、不可抗力）
2. 按风险等级（高/中/低）标记每个条款
3. 指出对发包方/承包方不利的条款
4. 给出具体修改建议和谈判策略`,
  },
  {
    id: 'cost-analyst',
    name: '造价分析师',
    role: '工程造价专家',
    description: '专注工程量清单审核、成本分析、投资控制，精通GB50500等计价规范',
    icon: 'TrendingUp',
    color: 'bg-sky-500',
    expertise: ['造价', '清单', '计价', '预算', '结算', '成本', '投资', '定额', '招标', '投标', 'GB50500', '工程量'],
    systemPrompt: `你是全过程工程咨询管理平台的造价分析专家Agent。你的专业领域是建设工程造价管理。
你精通以下标准：
- GB50500-2013 建设工程工程量清单计价规范
- GB50854-2013 房屋建筑与装饰工程工程量计算规范
- 各地区建设工程计价定额
- 建设工程造价咨询规范

审查原则：
1. 核对工程量清单的项目特征描述是否完整准确
2. 检查综合单价组成的合理性
3. 识别清单漏项、工程量偏差和不平衡报价
4. 提供市场参考价和成本控制建议`,
  },
  {
    id: 'general-engineer',
    name: '综合工程Agent',
    role: '全过程工程咨询专家',
    description: '覆盖全过程工程咨询全领域，包括监理管理、资料管理、进度控制等通用场景',
    icon: 'Bot',
    color: 'bg-blue-500',
    expertise: ['监理', '资料', '进度', '管理', '归档', 'GB/T50319', 'DB11/T695', '全过程', '咨询'],
    systemPrompt: `你是全过程工程咨询管理平台的综合工程咨询专家Agent。你的专业领域覆盖建设工程全过程咨询。
你精通以下标准：
- GB/T50319-2013 建设工程监理规范
- DB11/T695-2025 建筑工程资料管理规程
- 全过程工程咨询服务管理标准

工作原则：
1. 监理类：按规划→细则→旁站→验收的流程提供建议
2. 资料类：按A/B/C/D四类归档要求检查资料完整性
3. 进度类：识别关键路径上的风险节点，给出缓冲建议
4. 通用类：结合项目管理知识体系提供综合咨询`,
  },
];

/**
 * 关键词匹配分数计算
 * 基于 expertise 关键词在目标文本中的命中率
 */
function matchScore(profile: AgentProfile, goal: string): number {
  const text = goal.toLowerCase();
  let hits = 0;
  let weight = 0;
  for (const kw of profile.expertise) {
    if (text.includes(kw.toLowerCase())) {
      hits++;
      // 标准编号匹配权重更高
      weight += kw.match(/^GB|^JGJ|^DB|^GF/) ? 3 : 1;
    }
  }
  return hits > 0 ? hits * 1.5 + weight : 0;
}

/**
 * MultiAgentOrchestrator — 多Agent编排器
 * 单例模式，全局通过 multiAgentOrchestrator 访问
 */
class MultiAgentOrchestrator {
  private profiles: AgentProfile[] = AGENT_PROFILES;
  private executionLog: Array<{
    timestamp: string;
    agentId: string;
    goal: string;
    status: string;
    duration?: number;
  }> = [];

  /** 获取所有Agent Profile */
  listProfiles(): AgentProfile[] {
    return [...this.profiles];
  }

  /** 获取指定Agent Profile */
  getProfile(id: string): AgentProfile | undefined {
    return this.profiles.find(p => p.id === id);
  }

  /** 根据目标自动匹配最佳Agent */
  dispatch(goal: string): AgentDispatchResult {
    const scored = this.profiles.map(p => ({
      profile: p,
      score: matchScore(p, goal),
      reason: '',
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // 如果所有Agent都不匹配，使用综合Agent
    if (best.score === 0) {
      const general = this.profiles.find(p => p.id === 'general-engineer')!;
      return {
        profile: general,
        score: 0,
        reason: '无特定领域匹配，使用综合工程Agent',
      };
    }

    const matchedKws = best.profile.expertise
      .filter(kw => goal.toLowerCase().includes(kw.toLowerCase()))
      .join('、');
    best.reason = `匹配关键词: ${matchedKws}（得分: ${best.score}）`;
    return best;
  }

  /** 使用指定Profile执行任务 */
  async executeWithProfile(
    profile: AgentProfile,
    goal: string,
    context: AgentContext,
    maxSteps = 5
  ): Promise<AgentTask> {
    const startTime = Date.now();
    this.executionLog.push({
      timestamp: new Date().toISOString(),
      agentId: profile.id,
      goal: goal.slice(0, 100),
      status: 'executing',
    });

    try {
      // 注入Agent Profile到规划提示词
      const task = await engineeringAgent.planWithProfile(profile, goal, context, maxSteps);
      const result = await engineeringAgent.execute(task, context);

      const lastLog = this.executionLog[this.executionLog.length - 1];
      lastLog.status = result.status;
      lastLog.duration = Date.now() - startTime;

      return result;
    } catch (e: any) {
      const lastLog = this.executionLog[this.executionLog.length - 1];
      lastLog.status = 'failed';
      lastLog.duration = Date.now() - startTime;
      throw e;
    }
  }

  /** 使用自动匹配的最佳Agent执行 */
  async executeAuto(
    goal: string,
    context: AgentContext,
    maxSteps = 5
  ): Promise<{ task: AgentTask; dispatch: AgentDispatchResult }> {
    const dispatch = this.dispatch(goal);
    const task = await this.executeWithProfile(dispatch.profile, goal, context, maxSteps);
    return { task, dispatch };
  }

  /** 获取执行日志（最近20条） */
  getLog() {
    return this.executionLog.slice(-20);
  }
}

export const multiAgentOrchestrator = new MultiAgentOrchestrator();
