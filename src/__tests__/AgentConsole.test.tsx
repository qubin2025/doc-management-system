import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentConsole from '../components/AgentConsole';

// Mock agent framework
vi.mock('../data/agentFramework', () => ({
  engineeringAgent: {
    plan: vi.fn(),
    planWithProfile: vi.fn().mockResolvedValue({
      id: 'task-1', goal: 'test', steps: [], currentStep: 0,
      status: 'executing', maxSteps: 5, startedAt: new Date().toISOString(),
    }),
    execute: vi.fn().mockResolvedValue({
      id: 'task-1', goal: 'test', steps: [], currentStep: 0,
      status: 'completed', maxSteps: 5, startedAt: new Date().toISOString(),
      result: '测试报告内容',
    }),
    onStepComplete: undefined,
    onConfirm: undefined,
  },
  AgentTask: {} as any,
  AgentStep: {} as any,
  AgentContext: {} as any,
}));

vi.mock('../data/multiAgentOrchestrator', () => ({
  multiAgentOrchestrator: {
    dispatch: vi.fn().mockReturnValue({
      profile: { id: 'safety-inspector', name: '安全审查员', role: '施工安全专家', description: '', icon: 'Shield', color: 'bg-amber-500', expertise: [], systemPrompt: '' },
      score: 5,
      reason: '匹配关键词: 安全',
    }),
    getProfile: vi.fn(),
    listProfiles: vi.fn().mockReturnValue([
      { id: 'safety-inspector', name: '安全审查员', role: '施工安全专家', description: '', icon: 'Shield', color: 'bg-amber-500', expertise: [], systemPrompt: '' },
      { id: 'quality-engineer', name: '质量工程师', role: '施工质量专家', description: '', icon: 'ClipboardCheck', color: 'bg-emerald-500', expertise: [], systemPrompt: '' },
      { id: 'general-engineer', name: '综合工程Agent', role: '全过程工程咨询专家', description: '', icon: 'Bot', color: 'bg-blue-500', expertise: [], systemPrompt: '' },
    ]),
  },
  AGENT_PROFILES: [],
}));

describe('AgentConsole', () => {
  const defaultProps = { projectName: '测试项目', onBack: vi.fn() };

  it('renders header with title', () => {
    render(<AgentConsole {...defaultProps} />);
    expect(screen.getByText('AI 智能体')).toBeTruthy();
  });

  it('renders project name in subtitle', () => {
    render(<AgentConsole {...defaultProps} />);
    expect(screen.getByText(/测试项目/)).toBeTruthy();
  });

  it('renders input field', () => {
    render(<AgentConsole {...defaultProps} />);
    const input = screen.getByPlaceholderText(/健康检查/);
    expect(input).toBeTruthy();
  });

  it('renders execute button', () => {
    render(<AgentConsole {...defaultProps} />);
    expect(screen.getByText('执行')).toBeTruthy();
  });

  it('renders shortcut chips section', () => {
    render(<AgentConsole {...defaultProps} />);
    expect(screen.getByText('常用任务模板')).toBeTruthy();
  });

  it('renders shortcut groups', () => {
    render(<AgentConsole {...defaultProps} />);
    expect(screen.getByText(/项目进度管控/)).toBeTruthy();
    expect(screen.getByText(/资料表单管理/)).toBeTruthy();
  });

  it('calls onBack when back button clicked', () => {
    render(<AgentConsole {...defaultProps} />);
    // 顶栏含多个按钮，按文本定位返回按钮避免按钮顺序变化导致测试脆弱
    const backText = screen.getAllByText(/返回/);
    if (backText.length > 0) {
      (backText[0].closest('button') as HTMLButtonElement).click();
    } else {
      // 兜底：若找不到文本按钮，点击第一个按钮
      screen.getAllByRole('button')[0].click();
    }
    expect(defaultProps.onBack).toHaveBeenCalled();
  });
});
