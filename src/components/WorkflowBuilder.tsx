import React, { useState } from 'react';
import { ArrowLeft, Play, ChevronDown, ChevronUp, Zap, CheckCircle2 } from 'lucide-react';
import { PRESET_WORKFLOWS, executeWorkflow } from '../data/workflowEngine';
import type { WorkflowDefinition, WorkflowInstance } from '../types';

interface Props { projectName: string; onBack: () => void; }

const WorkflowBuilder: React.FC<Props> = ({ projectName, onBack }) => {
  const [workflows] = useState<WorkflowDefinition[]>(PRESET_WORKFLOWS);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowInstance | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleRun = async (wf: WorkflowDefinition) => {
    setRunning(wf.id);
    setResult(null);
    try {
      const instance = await executeWorkflow(wf, projectName);
      setResult(instance);
    } catch (e: any) {
      setResult({ id: '', workflowId: wf.id, projectName, status: 'failed', currentStepIndex: 0, context: { error: e.message }, startedAt: new Date().toISOString() } as WorkflowInstance);
    } finally { setRunning(null); }
  };

  const stepTypeLabel = (t: string) => ({ 'skill': 'Skill', 'agent-task': 'Agent', 'mcp-tool': 'MCP工具', 'human-approval': '审批', 'condition': '条件' })[t] || t;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg"><ArrowLeft size={20} /></button>
          <Zap size={24} className="text-purple-400" />
          <div><h1 className="text-xl font-bold text-[var(--text-primary)]">工作流引擎</h1><p className="text-sm text-[var(--text-muted)]">{projectName}</p></div>
        </div>

        <div className="space-y-4">
          {workflows.map(wf => {
            const isExpanded = expanded === wf.id;
            const isRunning = running === wf.id;
            const hasResult = result?.workflowId === wf.id;
            return (
              <div key={wf.id} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--text-primary)]">{wf.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{wf.description} · {wf.steps.length}步骤</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setExpanded(isExpanded ? null : wf.id)}
                        className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-primary)] flex items-center gap-1">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? '收起' : '展开'}
                      </button>
                      <button onClick={() => handleRun(wf)} disabled={!!running}
                        className="px-4 py-1.5 text-xs bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white rounded-lg flex items-center gap-1">
                        {isRunning ? <span className="animate-spin">⟳</span> : <Play size={12} />}
                        {isRunning ? '执行中...' : '执行'}
                      </button>
                    </div>
                  </div>

                  {/* 步骤展开 */}
                  {isExpanded && (
                    <div className="mt-4 space-y-2 border-t border-[var(--border-primary)] pt-4">
                      {wf.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-3 text-xs">
                          <span className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] font-bold">{i + 1}</span>
                          <span className="font-medium text-[var(--text-primary)] w-20">{step.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{stepTypeLabel(step.type)}</span>
                          {step.skillId && <span className="text-[var(--text-muted)]">→ {step.skillId}</span>}
                          {step.agentGoal && <span className="text-[var(--text-muted)]">→ {step.agentGoal.slice(0, 40)}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 执行结果 */}
                  {hasResult && result && (
                    <div className={`mt-4 p-3 rounded-lg text-xs ${result.status === 'completed' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className={result.status === 'completed' ? 'text-green-400' : 'text-red-400'} />
                        <span className="font-medium text-[var(--text-primary)]">{result.status === 'completed' ? '执行完成' : '执行失败'}</span>
                      </div>
                      {Object.entries(result.context || {}).map(([key, val]: [string, any]) => (
                        <div key={key} className="text-[var(--text-muted)] mt-1">
                          <span className="text-purple-400">{key}:</span> {typeof val === 'object' ? JSON.stringify(val).slice(0, 100) : String(val).slice(0, 100)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
