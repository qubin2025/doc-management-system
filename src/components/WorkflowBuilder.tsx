import React, { useState } from 'react';
import { ArrowLeft, Play, ChevronDown, ChevronUp, Zap, CheckCircle2, Plus, Trash2, Edit3, X, Save } from 'lucide-react';
import { PRESET_WORKFLOWS, executeWorkflow, loadWorkflows, saveWorkflow } from '../data/workflowEngine';
import { skillRegistry } from '../data/skillRegistry';
import type { WorkflowDefinition, WorkflowInstance, WorkflowStep } from '../types';

interface Props { projectName: string; onBack: () => void; }

const AVAILABLE_SKILLS = skillRegistry.list();
const STEP_TYPES = [
  { value: 'skill', label: 'Skill技能' },
  { value: 'agent-task', label: 'Agent任务' },
  { value: 'mcp-tool', label: 'MCP工具' },
  { value: 'human-approval', label: '人工审批' },
] as const;

const WorkflowBuilder: React.FC<Props> = ({ projectName, onBack }) => {
  const [customWorkflows, setCustomWorkflows] = useState<WorkflowDefinition[]>(loadWorkflows);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowInstance | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 创建/编辑工作流
  const [showEditor, setShowEditor] = useState(false);
  const [editWf, setEditWf] = useState<WorkflowDefinition | null>(null);
  const [wfForm, setWfForm] = useState({ name: '', description: '' });
  const [wfSteps, setWfSteps] = useState<Partial<WorkflowStep>[]>([]);

  const allWorkflows = [...customWorkflows, ...PRESET_WORKFLOWS];

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

  const stepTypeLabel = (t: string) => ({ 'skill': 'Skill', 'agent-task': 'Agent', 'mcp-tool': 'MCP工具', 'human-approval': '审批' })[t] || t;

  // 打开新建编辑器
  const openCreate = () => {
    setEditWf(null);
    setWfForm({ name: '', description: '' });
    setWfSteps([{ id: 's1', name: '', type: 'skill' }]);
    setShowEditor(true);
  };

  // 打开编辑
  const openEdit = (wf: WorkflowDefinition) => {
    setEditWf(wf);
    setWfForm({ name: wf.name, description: wf.description });
    setWfSteps(wf.steps.map(s => ({ ...s })));
    setShowEditor(true);
  };

  // 添加步骤
  const addStep = () => {
    setWfSteps(prev => [...prev, { id: `s${Date.now()}`, name: '', type: 'skill' }]);
  };

  // 删除步骤
  const removeStep = (idx: number) => {
    setWfSteps(prev => prev.filter((_, i) => i !== idx));
  };

  // 更新步骤
  const updateStep = (idx: number, field: string, value: string) => {
    setWfSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // 保存工作流
  const handleSave = () => {
    if (!wfForm.name.trim()) return;
    const steps: WorkflowStep[] = wfSteps.map((s, i) => ({
      id: s.id || `s${i + 1}`,
      name: s.name || `步骤${i + 1}`,
      type: s.type || 'skill',
      skillId: s.type === 'skill' ? s.skillId : undefined,
      agentGoal: s.type === 'agent-task' ? (s as any).agentGoal : undefined,
      toolName: s.type === 'mcp-tool' ? (s as any).toolName : undefined,
      params: s.type === 'skill' && s.skillId ? { query: `执行${s.name}` } : undefined,
    }));

    const wf: WorkflowDefinition = {
      id: editWf?.id || `wf-custom-${Date.now()}`,
      name: wfForm.name.trim(),
      description: wfForm.description.trim() || '自定义工作流',
      version: editWf ? (editWf.version + 1) : 1,
      steps,
      createdAt: new Date().toISOString(),
    };

    saveWorkflow(wf);
    setCustomWorkflows(loadWorkflows());
    setShowEditor(false);
  };

  // 删除自定义工作流
  const handleDelete = (id: string) => {
    if (!confirm('确定删除此工作流？')) return;
    const remaining = customWorkflows.filter(w => w.id !== id);
    localStorage.setItem('custom-workflows', JSON.stringify(remaining));
    setCustomWorkflows(remaining);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg"><ArrowLeft size={20} /></button>
            <Zap size={24} className="text-purple-400" />
            <div><h1 className="text-xl font-bold text-[var(--text-primary)]">工作流引擎</h1><p className="text-sm text-[var(--text-muted)]">{projectName} · {allWorkflows.length}个可用</p></div>
          </div>
          <button onClick={openCreate}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-sm flex items-center gap-1">
            <Plus size={14} /> 创建工作流
          </button>
        </div>

        {customWorkflows.length > 0 && (
          <div className="mb-2 text-xs text-[var(--text-muted)] flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">我的工作流</span>
          </div>
        )}

        <div className="space-y-3">
          {allWorkflows.map(wf => {
            const isExpanded = expanded === wf.id;
            const isRunning = running === wf.id;
            const hasResult = result?.workflowId === wf.id;
            const isCustom = wf.id.startsWith('wf-custom-');
            return (
              <div key={wf.id} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-[var(--text-primary)]">{wf.name}</h3>
                        {isCustom && <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">自定义 V{wf.version}</span>}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{wf.description} · {wf.steps.length}步骤</p>
                    </div>
                    <div className="flex gap-1.5">
                      {isCustom && (
                        <>
                          <button onClick={() => openEdit(wf)}
                            className="px-2.5 py-1.5 text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-primary)]" title="编辑">
                            <Edit3 size={11} />
                          </button>
                          <button onClick={() => handleDelete(wf.id)}
                            className="px-2.5 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400" title="删除">
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
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

                  {isExpanded && (
                    <div className="mt-4 space-y-2 border-t border-[var(--border-primary)] pt-4">
                      {wf.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-3 text-xs">
                          <span className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] font-bold">{i + 1}</span>
                          <span className="font-medium text-[var(--text-primary)] w-24 truncate">{step.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 flex-shrink-0">{stepTypeLabel(step.type)}</span>
                          {step.skillId && <span className="text-[var(--text-muted)] truncate">→ {step.skillId}</span>}
                          {step.agentGoal && <span className="text-[var(--text-muted)] truncate">→ {step.agentGoal.slice(0, 40)}</span>}
                          {step.toolName && <span className="text-[var(--text-muted)]">→ {step.toolName}</span>}
                        </div>
                      ))}
                    </div>
                  )}

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

        {/* 创建工作流编辑器 */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowEditor(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] shrink-0">
                <h3 className="font-bold text-[var(--text-primary)]">{editWf ? '编辑工作流' : '创建工作流'}</h3>
                <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <input value={wfForm.name} onChange={e => setWfForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="工作流名称 *" autoFocus
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <input value={wfForm.description} onChange={e => setWfForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="描述（可选）"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-[var(--text-primary)]">步骤列表 ({wfSteps.length})</label>
                    <button onClick={addStep} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Plus size={12} /> 添加步骤</button>
                  </div>
                  <div className="space-y-3">
                    {wfSteps.map((step, i) => (
                      <div key={step.id || i} className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] w-5">#{i + 1}</span>
                          <input value={step.name || ''} onChange={e => updateStep(i, 'name', e.target.value)}
                            placeholder="步骤名称" className="flex-1 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-2 py-1 text-xs" />
                          <select value={step.type || 'skill'} onChange={e => updateStep(i, 'type', e.target.value)}
                            className="bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-2 py-1 text-xs">
                            {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <button onClick={() => removeStep(i)} className="p-1 text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                        </div>
                        {/* Skill选择器 */}
                        {(step.type === 'skill' || !step.type) && (
                          <select value={(step as any).skillId || ''} onChange={e => updateStep(i, 'skillId', e.target.value)}
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-2 py-1 text-xs">
                            <option value="">选择Skill...</option>
                            {AVAILABLE_SKILLS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                          </select>
                        )}
                        {/* Agent任务 */}
                        {step.type === 'agent-task' && (
                          <input value={(step as any).agentGoal || ''} onChange={e => updateStep(i, 'agentGoal', e.target.value)}
                            placeholder="Agent目标描述（如：对项目进行全面健康检查）"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-2 py-1 text-xs" />
                        )}
                        {/* MCP工具 */}
                        {step.type === 'mcp-tool' && (
                          <input value={(step as any).toolName || ''} onChange={e => updateStep(i, 'toolName', e.target.value)}
                            placeholder="MCP工具名（如：ai_chat）"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-2 py-1 text-xs" />
                        )}
                      </div>
                    ))}
                  </div>
                  {wfSteps.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-6">点击"添加步骤"开始构建工作流</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0 rounded-b-xl">
                <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]">取消</button>
                <button onClick={handleSave} disabled={!wfForm.name.trim() || wfSteps.length === 0}
                  className="px-4 py-2 text-sm bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white rounded-lg flex items-center gap-1">
                  <Save size={14} /> 保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;
