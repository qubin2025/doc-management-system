import React, { useState, useEffect } from 'react';
import { Bot, Play, Square, RefreshCw, CheckCircle2, XCircle, Clock, Copy, Download, FileText, FileDown, Edit3, Save, RotateCcw, ChevronDown } from 'lucide-react';
import { engineeringAgent, type AgentTask, type AgentStep, type AgentContext } from '../data/agentFramework';
import { multiAgentOrchestrator, AGENT_PROFILES } from '../data/multiAgentOrchestrator';
import type { AgentProfile } from '../types';
import { toast } from './Toast';
import ModuleHeader from './ModuleHeader';

interface AgentConsoleProps { projectName: string; onBack: () => void; }

/** 分组快捷指令 — V1：分类+复杂度+回填输入 */
interface PromptChip {
  label: string; query: string; group: string; complexity: '🟢' | '🟡' | '🔴';
  tools?: string; estimatedTime?: string;
}

const PROMPT_CHIPS: PromptChip[] = [
  { label: '项目健康检查', query: '对项目进行全面的健康检查，包括KPI计算、工作项扫描、表单检测，并生成综合报告', group: '📊 项目进度管控', complexity: '🔴', tools: 'compute_kpi·scan_workitems·scan_forms', estimatedTime: '~30秒' },
  { label: '过期工作项扫描', query: '扫描项目所有工作项，找出已过期或即将过期的项，列出责任人', group: '📊 项目进度管控', complexity: '🟡', tools: 'scan_workitems', estimatedTime: '~10秒' },
  { label: 'KPI指标计算', query: '计算项目当前的CPI/SPI/完整度/质量分四大KPI指标', group: '📊 项目进度管控', complexity: '🟢', tools: 'compute_kpi', estimatedTime: '~5秒' },
  { label: '工作项分析', query: '分析项目的施工准备工作项完成情况，给出进度优化建议', group: '📊 项目进度管控', complexity: '🟡', tools: 'scan_workitems·ai_chat', estimatedTime: '~15秒' },

  { label: '缺失表单检测', query: '扫描项目的所有附表，列出空白的表单清单和建议填写顺序', group: '📋 资料表单管理', complexity: '🟡', tools: 'scan_forms', estimatedTime: '~10秒' },

  { label: '知识库检索', query: '在项目知识库中检索施工标准规范条款，了解最新要求', group: '📚 文档知识检索', complexity: '🟢', tools: 'knowledge_search', estimatedTime: '~8秒' },
  { label: 'RAG文档检索', query: '使用RAG增强检索，查找项目中与质量管理相关的文档和方案', group: '📚 文档知识检索', complexity: '🟡', tools: 'rag_search·knowledge_search', estimatedTime: '~15秒' },

  { label: '系统健康检查', query: '检查系统所有AI模型和知识服务的可用性状态', group: '⚙️ 系统运维诊断', complexity: '🟢', tools: 'health_check', estimatedTime: '~5秒' },
];

const COMPLEXITY_LABEL: Record<string, string> = { '🟢': '简单·单工具', '🟡': '中等·多步骤', '🔴': '复杂·自主规划' };

// Agent Profile 颜色映射
const PROFILE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'safety-inspector':  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  'quality-engineer':  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'contract-analyst': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  'cost-analyst':     { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  'general-engineer': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
};

const AgentConsole: React.FC<AgentConsoleProps> = ({ projectName, onBack }) => {
  const [goal, setGoal] = useState('');
  const [task, setTask] = useState<AgentTask | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; params: Record<string, unknown>; resolve: (v: boolean) => void } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['📊 项目进度管控']));

  // Multi-Agent 状态
  const [selectedProfileId, setSelectedProfileId] = useState<string>('auto');
  const [activeProfile, setActiveProfile] = useState<AgentProfile | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // 管理员检测
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { try { const a = JSON.parse(localStorage.getItem('doc-system-auth')||'{}'); setIsAdmin(a?.user?.role==='admin'); } catch {} }, []);

  // Agent专属提示词编辑器
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState(() => localStorage.getItem('agent-system-prompt') || '');
  const defaultPrompt = '你是全过程工程咨询管理系统的AI智能体。请根据用户目标自主规划执行步骤，使用可用工具完成任务。每次执行前先分析目标，制定多步计划，逐步执行并观察结果。';

  const saveAgentPrompt = () => {
    localStorage.setItem('agent-system-prompt', agentPrompt);
    toast('Agent提示词已保存', 'success');
    setShowPromptEditor(false);
  };

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  };

  const handleStart = async (promptQuery?: string) => {
    const q = promptQuery || goal;
    if (!q.trim() || running) return;
    if (promptQuery) setGoal(promptQuery);
    else if (!goal.trim()) return;
    setRunning(true); setError('');

    const ctx: AgentContext = { projectName, userId: 'admin', conversationId: `conv-${Date.now()}`, history: [], memory: new Map() };
    engineeringAgent.onStepComplete = (step) => { setTask(prev => { if (!prev) return prev; const steps = [...prev.steps]; steps[step.stepIndex] = step; return { ...prev, steps, currentStep: step.stepIndex + 1 }; }); };
    engineeringAgent.onConfirm = async (action, params) => new Promise(resolve => { setConfirmAction({ action, params, resolve }); });

    try {
      // Multi-Agent 路由
      let profile: AgentProfile;
      if (selectedProfileId === 'auto') {
        const dispatch = multiAgentOrchestrator.dispatch(q.trim());
        profile = dispatch.profile;
      } else {
        profile = multiAgentOrchestrator.getProfile(selectedProfileId) || AGENT_PROFILES[4];
      }
      setActiveProfile(profile);

      const plan = await engineeringAgent.planWithProfile(profile, q.trim(), ctx);
      // 在目标前加上Agent标记
      plan.goal = `[${profile.name}] ${q.trim()}`;
      setTask(plan);
      const result = await engineeringAgent.execute(plan, ctx);
      setTask(result);
    } catch (e: any) { setError(e.message); }
    finally { setRunning(false); engineeringAgent.onStepComplete = undefined; engineeringAgent.onConfirm = undefined; }
  };

  const handleChipClick = (chip: PromptChip) => {
    setGoal(chip.query);
    toast(`已填入：${chip.label} (${COMPLEXITY_LABEL[chip.complexity]})`, 'info');
  };

  const statusIcon = (status: AgentStep['status']) => {
    switch (status) { case 'completed': return <CheckCircle2 size={16} className="text-green-400" />; case 'failed': return <XCircle size={16} className="text-red-400" />; case 'executing': return <RefreshCw size={16} className="text-sky-400 animate-spin" />; case 'thinking': return <Clock size={16} className="text-amber-400" />; default: return <Clock size={16} className="text-gray-600" />; }
  };

  // 下载功能
  const getReportText = () => task?.result || '';
  const handleCopyReport = () => { navigator.clipboard.writeText(getReportText()).then(() => toast('已复制', 'success')).catch(() => toast('复制失败', 'error')); };
  const handleDownloadWord = () => {
    const text = getReportText(); if (!text) return;
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8"></head><body style="font-family:SimSun;margin:40px"><h1>${task?.goal||'Agent报告'}</h1><pre>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></body></html>`;
    const b = new Blob(['\uFEFF'+html],{type:'application/msword'}); const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`Agent报告_${new Date().toISOString().slice(0,10)}.doc`; a.click();
  };
  const handleDownloadHtml = () => {
    const text = getReportText(); if (!text) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Agent报告</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:2}pre{white-space:pre-wrap;background:#f8fafc;padding:20px;border-radius:8px}</style></head><body><h1>${task?.goal||'执行报告'}</h1><p>${new Date().toLocaleString('zh-CN')}</p><pre>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></body></html>`;
    const b = new Blob(['\uFEFF'+html],{type:'text/html'}); const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`Agent报告_${new Date().toISOString().slice(0,10)}.html`; a.click();
  };
  const handleDownloadPdf = () => window.print();

  // 分组统计
  const groups = [...new Set(PROMPT_CHIPS.map(c => c.group))];

  // 当前选中Profile的颜色
  const currentProfile = selectedProfileId !== 'auto' ? AGENT_PROFILES.find(p => p.id === selectedProfileId) : null;
  const profileColor = activeProfile ? PROFILE_COLORS[activeProfile.id] || PROFILE_COLORS['general-engineer'] : null;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <ModuleHeader
        title="AI 智能体"
        subtitle={`${projectName} · 多Agent协作 · 自主拆解任务、自动分析项目数据`}
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        onBack={onBack}
        actions={
          <>
            {/* Agent Profile 选择器 */}
            <div className="relative">
              <button onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition ${
                  currentProfile
                    ? `${PROFILE_COLORS[currentProfile.id]?.border || 'border-purple-500/30'} ${PROFILE_COLORS[currentProfile.id]?.text || 'text-purple-400'} hover:bg-purple-500/10`
                    : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                }`}>
                <Bot size={12} />
                <span className="max-w-[100px] truncate">{currentProfile?.name || '自动匹配'}</span>
                <ChevronDown size={12} />
              </button>
              {showProfileDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-[var(--border-primary)]">
                    <span className="text-xs font-medium text-[var(--text-primary)]">选择 Agent 角色</span>
                  </div>
                  <button
                    onClick={() => { setSelectedProfileId('auto'); setShowProfileDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition flex items-center gap-2 ${selectedProfileId === 'auto' ? 'bg-purple-500/10 text-purple-400' : 'text-[var(--text-primary)]'}`}>
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    自动匹配（推荐）
                  </button>
                  {AGENT_PROFILES.map(p => {
                    const c = PROFILE_COLORS[p.id] || PROFILE_COLORS['general-engineer'];
                    return (
                      <button key={p.id}
                        onClick={() => { setSelectedProfileId(p.id); setShowProfileDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition flex items-center gap-2 ${selectedProfileId === p.id ? 'bg-purple-500/10' : ''}`}>
                        <span className={`w-2 h-2 rounded-full ${c.text.replace('text-', 'bg-')}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${selectedProfileId === p.id ? 'text-purple-400' : 'text-[var(--text-primary)]'}`}>{p.name}</div>
                          <div className="text-[var(--text-muted)] truncate">{p.role}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isAdmin && (
              <button onClick={() => setShowPromptEditor(true)}
                className="px-3 py-1.5 text-xs border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-lg flex items-center gap-1">
                <Edit3 size={12} /> Agent提示词
              </button>
            )}
          </>
        }
      />
      <div className="max-w-4xl mx-auto p-6">

        {/* 输入区 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 mb-4">
          <label className="text-sm text-[var(--text-muted)] mb-2 block">
            下达项目任务指令，AI智能体将自主拆解、执行并输出报告
            {currentProfile && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${PROFILE_COLORS[currentProfile.id]?.bg} ${PROFILE_COLORS[currentProfile.id]?.text}`}>
                当前: {currentProfile.name}
              </span>
            )}
            {selectedProfileId === 'auto' && !currentProfile && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400">自动匹配Agent</span>
            )}
          </label>
          <div className="flex gap-3">
            <input type="text" value={goal} onChange={e => setGoal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="例：对项目进行健康检查 / 审查施工方案 / 生成周报..."
              disabled={running}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50" />
            {running ? (
              <button onClick={() => { if (task) task.status = 'cancelled'; setTask(task ? { ...task } : null); setRunning(false); }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition flex items-center gap-2"><Square size={14} /> 停止</button>
            ) : (
              <button onClick={() => handleStart()} disabled={!goal.trim()}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-2"><Play size={14} /> 执行</button>
            )}
          </div>
          {running && (
            <p className="text-xs text-purple-400 mt-2 flex items-center gap-1">
              <RefreshCw size={12} className="animate-spin" />
              {activeProfile ? `${activeProfile.name} 正在自主规划并执行任务…` : 'Agent 正在自主规划并执行任务…'}
            </p>
          )}
        </div>

        {/* 快捷指令卡片区 — 分组 */}
        {!task && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">常用任务模板 <span className="text-[var(--text-muted)] text-xs ml-1">（点击填充指令，修改后执行）</span></h3>
              <span className="text-xs text-[var(--text-muted)]">{PROMPT_CHIPS.length} 条可用</span>
            </div>
            {groups.map(group => {
              const chips = PROMPT_CHIPS.filter(c => c.group === group);
              const isExpanded = expandedGroups.has(group);
              return (
                <div key={group} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
                  <button onClick={() => toggleGroup(group)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[var(--bg-hover)] transition text-left">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{group}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">{chips.length}条</span>
                      <span className="text-xs text-[var(--text-muted)]">{isExpanded ? '▲' : '▼'}</span>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-t border-[var(--border-primary)]">
                      {chips.map((chip, i) => (
                        <button key={i} onClick={() => handleChipClick(chip)} disabled={running}
                          className="text-left px-3 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-secondary)] hover:border-purple-500/30 rounded-lg transition disabled:opacity-50 group">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs" title={COMPLEXITY_LABEL[chip.complexity]}>{chip.complexity}</span>
                            <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-purple-400 transition">{chip.label}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            {chip.tools && <span className="bg-purple-500/5 px-1 rounded">{chip.tools}</span>}
                            {chip.estimatedTime && <span>{chip.estimatedTime}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 执行步骤 */}
        {task && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between bg-purple-500/5">
              <div className="flex items-center gap-2">
                {activeProfile && profileColor && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${profileColor.bg} ${profileColor.text} ${profileColor.border} border`}>
                    {activeProfile.name}
                  </span>
                )}
                <span className="text-sm font-medium text-[var(--text-primary)]">任务: {task.goal}</span>
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${task.status==='completed'?'bg-green-500/20 text-green-400':task.status==='failed'?'bg-red-500/20 text-red-400':task.status==='cancelled'?'bg-gray-500/20 text-[var(--text-secondary)]':'bg-sky-500/20 text-sky-400'}`}>
                  {task.status==='completed'?'完成':task.status==='failed'?'失败':task.status==='cancelled'?'已取消':'执行中'}
                </span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{task.steps.filter(s=>s.status==='completed').length}/{task.steps.length} 步</span>
            </div>
            <div className="divide-y divide-[var(--border-primary)]">
              {task.steps.map((step, i) => (
                <div key={i} className={`px-4 py-3 ${i===task.currentStep&&running?'bg-purple-500/5':''}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{statusIcon(step.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[var(--text-muted)]">步骤 {i+1}</span>
                        {step.actionName && <span className="text-xs bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">{step.actionName}</span>}
                        <span className={`text-xs font-medium ${step.status==='completed'?'text-green-400':step.status==='executing'?'text-sky-400':step.status==='failed'?'text-red-400':'text-[var(--text-muted)]'}`}>{step.status}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{step.thought}</p>
                      {step.observation && <div className="mt-2 p-2 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-muted)] max-h-24 overflow-y-auto">{step.observation}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 结果摘要 */}
            {task.result && (
              <div className="border-t border-[var(--border-primary)]">
                <div className="flex items-center justify-between px-5 py-3 bg-green-500/5 border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="text-sm font-bold text-[var(--text-primary)]">执行报告</span>
                    {activeProfile && (
                      <span className="text-xs text-[var(--text-muted)]">— {activeProfile.role}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopyReport} className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1 font-medium"><Copy size={14} /> 复制</button>
                    <button onClick={handleDownloadWord} className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg flex items-center gap-1 font-medium"><FileText size={14} /> Word</button>
                    <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg flex items-center gap-1 font-medium"><FileDown size={14} /> PDF</button>
                    <button onClick={handleDownloadHtml} className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1 font-medium"><Download size={14} /> HTML</button>
                  </div>
                </div>
                <pre className="p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap font-sans leading-relaxed bg-white max-h-[60vh] overflow-y-auto">{task.result}</pre>
              </div>
            )}
          </div>
        )}

        {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2"><XCircle size={16} className="text-red-400" /><span className="text-sm text-red-400">{error}</span></div>}
      </div>

      {/* 确认弹窗 */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 max-w-sm w-full mx-4">
            <Bot size={24} className="text-purple-400 mb-3" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">确认操作</h3>
            <p className="text-sm text-[var(--text-muted)]">Agent 想要执行: <span className="text-purple-400">{confirmAction.action}</span></p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { confirmAction.resolve(false); setConfirmAction(null); }} className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-primary)]">取消</button>
              <button onClick={() => { confirmAction.resolve(true); setConfirmAction(null); }} className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-sm">确认执行</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent提示词编辑器 */}
      {showPromptEditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowPromptEditor(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Agent系统提示词（管理员）</h3>
              <button onClick={() => { setAgentPrompt(defaultPrompt); toast('已恢复默认', 'success'); }} className="text-xs text-purple-400 hover:text-purple-500 flex items-center gap-1"><RotateCcw size={11} /> 恢复默认</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs text-[var(--text-muted)] mb-3">此提示词作为Agent规划时的系统指令，影响所有任务的执行策略。建议保留默认核心逻辑，仅调整输出风格和优先级。</p>
              <textarea value={agentPrompt || defaultPrompt} onChange={e => setAgentPrompt(e.target.value)}
                rows={10} className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0 rounded-b-xl">
              <button onClick={() => setShowPromptEditor(false)} className="px-4 py-2 text-sm border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]">取消</button>
              <button onClick={saveAgentPrompt} className="px-4 py-2 text-sm bg-purple-500 hover:bg-purple-400 text-white rounded-lg flex items-center gap-1"><Save size={14} /> 保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentConsole;
