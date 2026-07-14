import React, { useState } from 'react';
import { ArrowLeft, Bot, Play, Square, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { engineeringAgent, type AgentTask, type AgentStep, type AgentContext } from '../data/agentFramework';

interface AgentConsoleProps {
  projectName: string;
  onBack: () => void;
}

const AgentConsole: React.FC<AgentConsoleProps> = ({ projectName, onBack }) => {
  const [goal, setGoal] = useState('');
  const [task, setTask] = useState<AgentTask | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; params: Record<string, unknown>; resolve: (v: boolean) => void } | null>(null);

  const handleStart = async () => {
    if (!goal.trim() || running) return;
    setRunning(true);
    setError('');

    const ctx: AgentContext = {
      projectName,
      userId: 'admin',
      conversationId: `conv-${Date.now()}`,
      history: [],
      memory: new Map(),
    };

    engineeringAgent.onStepComplete = (step) => {
      setTask(prev => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        steps[step.stepIndex] = step;
        return { ...prev, steps, currentStep: step.stepIndex + 1 };
      });
    };

    engineeringAgent.onConfirm = async (action, params) => {
      return new Promise(resolve => {
        setConfirmAction({ action, params, resolve });
      });
    };

    try {
      const plan = await engineeringAgent.plan(goal.trim(), ctx);
      setTask(plan);
      const result = await engineeringAgent.execute(plan, ctx);
      setTask(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
      engineeringAgent.onStepComplete = undefined;
      engineeringAgent.onConfirm = undefined;
    }
  };

  const handleStop = () => {
    if (task) {
      task.status = 'cancelled';
      setTask({ ...task });
    }
    setRunning(false);
  };

  const statusIcon = (status: AgentStep['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} className="text-green-400" />;
      case 'failed': return <XCircle size={16} className="text-red-400" />;
      case 'executing': return <RefreshCw size={16} className="text-sky-400 animate-spin" />;
      case 'thinking': return <Clock size={16} className="text-amber-400" />;
      default: return <Clock size={16} className="text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition">
            <ArrowLeft size={20} />
          </button>
          <Bot size={24} className="text-purple-400" />
          <div>
            <h1 className="text-xl font-bold">AI 智能体</h1>
            <p className="text-sm text-[var(--text-muted)]">{projectName} — Agent自主规划执行</p>
          </div>
        </div>

        {/* 输入区 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 mb-6">
          <label className="text-sm text-[var(--text-secondary)] mb-2 block">你想让AI做什么？</label>
          <div className="flex gap-3">
            <input
              type="text" value={goal} onChange={e => setGoal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="例：对项目进行健康检查 / 审查施工方案 / 生成周报..."
              disabled={running}
              className="flex-1 bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
            {running ? (
              <button onClick={handleStop} className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition flex items-center gap-2">
                <Square size={14} /> 停止
              </button>
            ) : (
              <button onClick={handleStart} disabled={!goal.trim()}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-2">
                <Play size={14} /> 执行
              </button>
            )}
          </div>
        </div>

        {/* 工具列表 */}
        {!task && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium mb-3">可用工具 ({engineeringAgent.listTools().length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {engineeringAgent.listTools().map(t => (
                <div key={t.name} className="px-3 py-2 bg-[var(--bg-secondary)] rounded-lg text-xs">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                    t.category === 'query' ? 'bg-green-400' :
                    t.category === 'compute' ? 'bg-sky-400' :
                    t.category === 'mutate' ? 'bg-amber-400' :
                    t.category === 'knowledge' ? 'bg-purple-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-[var(--text-secondary)]">{t.name}</span>
                  <div className="text-[var(--text-muted)] mt-0.5 truncate">{t.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 执行步骤 */}
        {task && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">任务: {task.goal}</span>
                <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded ${
                  task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  task.status === 'cancelled' ? 'bg-gray-500/20 text-[var(--text-secondary)]' :
                  'bg-sky-500/20 text-sky-400'
                }`}>
                  {task.status === 'completed' ? '完成' : task.status === 'failed' ? '失败' : task.status === 'cancelled' ? '已取消' : '执行中'}
                </span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{task.steps.filter(s => s.status === 'completed').length}/{task.steps.length} 步</span>
            </div>

            <div className="divide-y divide-[var(--border-primary)]">
              {task.steps.map((step, i) => (
                <div key={i} className={`px-4 py-3 ${i === task.currentStep && running ? 'bg-purple-500/5' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{statusIcon(step.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[var(--text-muted)]">步骤 {i + 1}</span>
                        {step.actionName && (
                          <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
                            {step.actionName}
                          </span>
                        )}
                        <span className={`text-[10px] font-medium ${
                          step.status === 'pending' ? 'text-[var(--text-muted)]' :
                          step.status === 'executing' ? 'text-sky-400' :
                          step.status === 'completed' ? 'text-green-400' :
                          'text-red-400'
                        }`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{step.thought}</p>
                      {step.observation && (
                        <div className="mt-2 p-2 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-secondary)] max-h-24 overflow-y-auto">
                          {step.observation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 结果摘要 */}
            {task.result && (
              <div className="px-4 py-3 border-t border-gray-800 bg-gray-800/30">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{task.result}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-[var(--border-secondary)] rounded-xl p-6 max-w-sm w-full mx-4">
            <Bot size={24} className="text-purple-400 mb-3" />
            <h3 className="text-lg font-bold mb-2">确认操作</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-1">
              Agent 想要执行: <span className="text-purple-400">{confirmAction.action}</span>
            </p>
            {Object.keys(confirmAction.params).length > 0 && (
              <pre className="text-xs text-[var(--text-muted)] bg-gray-800 p-2 rounded mt-2 mb-3 max-h-32 overflow-y-auto">
                {JSON.stringify(confirmAction.params, null, 2)}
              </pre>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { confirmAction.resolve(false); setConfirmAction(null); }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
                取消
              </button>
              <button onClick={() => { confirmAction.resolve(true); setConfirmAction(null); }}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-sm transition">
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentConsole;
