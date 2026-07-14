import React, { useState } from 'react';
import { ArrowLeft, Bot, Play, Square, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Sparkles, Copy, Download, FileText, FileDown } from 'lucide-react';
import { engineeringAgent, type AgentTask, type AgentStep, type AgentContext } from '../data/agentFramework';
import { toast } from './Toast';

interface AgentConsoleProps {
  projectName: string;
  onBack: () => void;
}

/** 预设提示词条 — 按工具能力分类 */
const PROMPT_CHIPS = [
  { label: '📊 项目健康检查', query: '对项目进行全面的健康检查，包括KPI计算、工作项扫描、表单检测，并生成综合报告', category: 'compute' },
  { label: '🔍 过期工作项扫描', query: '扫描项目所有工作项，找出已过期或即将过期的项，列出责任人', category: 'compute' },
  { label: '📋 缺失表单检测', query: '扫描项目的所有附表，列出空白的表单清单和建议填写顺序', category: 'compute' },
  { label: '📊 KPI指标计算', query: '计算项目当前的CPI/SPI/完整度/质量分四大KPI指标', category: 'compute' },
  { label: '🧠 知识库检索', query: '在项目知识库中检索施工标准规范条款，了解最新要求', category: 'knowledge' },
  { label: '📡 RAG文档检索', query: '使用RAG增强检索，查找项目中与质量管理相关的文档和方案', category: 'knowledge' },
  { label: '📝 工作项分析', query: '分析项目的施工准备工作项完成情况，给出进度优化建议', category: 'query' },
  { label: '🏥 系统健康检查', query: '检查系统所有AI模型和知识服务的可用性状态', category: 'system' },
];

const AgentConsole: React.FC<AgentConsoleProps> = ({ projectName, onBack }) => {
  const [goal, setGoal] = useState('');
  const [task, setTask] = useState<AgentTask | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; params: Record<string, unknown>; resolve: (v: boolean) => void } | null>(null);

  const getReportText = () => task?.result || '';

  // 复制报告
  const handleCopyReport = () => {
    const text = getReportText();
    if (!text) { toast('无报告内容', 'warning'); return; }
    navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板', 'success')).catch(() => toast('复制失败', 'error'));
  };

  // 构建Word文档（Word兼容HTML格式）
  const buildWordDoc = () => {
    const text = getReportText();
    const title = task?.goal || 'Agent执行报告';
    const lines = text.split('\n').filter(l => l.trim());
    let body = '';
    for (const line of lines) {
      if (line.startsWith('步骤') || line.match(/^\d+[\.\)]/)) {
        body += `<p style="margin:6px 0;font-size:12pt">${escapeWord(line)}</p>`;
      } else if (line.startsWith('---') || line.startsWith('===')) {
        body += '<hr style="border:1px solid #ccc">';
      } else {
        body += `<p style="margin:4px 0;font-size:12pt">${escapeWord(line)}</p>`;
      }
    }
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--></head>
<body style="font-family:'宋体',SimSun,serif;margin:40px 60px">
  <h1 style="text-align:center;font-size:18pt;color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px">${escapeWord(title)}</h1>
  <p style="text-align:center;color:#666;font-size:10pt">全过程工程咨询管理系统 · Agent执行报告 · ${new Date().toLocaleString('zh-CN')}</p>
  ${body}
  <hr style="margin-top:30px">
  <p style="text-align:center;color:#999;font-size:9pt">全过程工程咨询管理系统 · 自动生成</p>
</body></html>`;
  };

  const escapeWord = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // 下载HTML
  const handleDownloadHtml = () => {
    const text = getReportText();
    if (!text) return;
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>Agent报告</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:2;color:#1e293b}
pre{white-space:pre-wrap;background:#f8fafc;padding:20px;border-radius:8px;font-size:14px}</style></head><body>
<h1 style="color:#1e40af;border-bottom:2px solid #e2e8f0;padding-bottom:8px">${escapeWord(task?.goal||'执行报告')}</h1>
<p style="color:#64748b">${new Date().toLocaleString('zh-CN')}</p>
<pre>${escapeWord(text)}</pre></body></html>`;
    downloadBlob(new Blob(['\uFEFF'+html],{type:'text/html;charset=utf-8'}), `Agent报告_${new Date().toISOString().slice(0,10)}.html`);
  };

  // 下载Word
  const handleDownloadWord = () => {
    const doc = buildWordDoc();
    downloadBlob(new Blob(['\uFEFF'+doc],{type:'application/msword;charset=utf-8'}), `Agent报告_${new Date().toISOString().slice(0,10)}.doc`);
  };

  // 下载PDF (浏览器打印当前报告区域)
  const handleDownloadPdf = () => {
    window.print();
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleStart = async (promptQuery?: string) => {
    const q = promptQuery || goal;
    if (!q.trim() || running) return;
    if (!promptQuery) setGoal(q);
    else setGoal(promptQuery);
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
      const plan = await engineeringAgent.plan(q.trim(), ctx);
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
              className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
            {running ? (
              <button onClick={handleStop} className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition flex items-center gap-2">
                <Square size={14} /> 停止
              </button>
            ) : (
              <button onClick={() => handleStart()} disabled={!goal.trim()}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-2">
                <Play size={14} /> 执行
              </button>
            )}
          </div>
        </div>

        {/* 提示词条 — 点击直接执行 */}
        {!task && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 mb-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-400" /> 点击提示词条直接执行
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROMPT_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleStart(chip.query)}
                  disabled={running}
                  className="text-left px-3 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-secondary)] hover:border-purple-500/30 rounded-lg transition disabled:opacity-50 group"
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
                    chip.category === 'query' ? 'bg-green-400' :
                    chip.category === 'compute' ? 'bg-sky-400' :
                    chip.category === 'knowledge' ? 'bg-purple-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-purple-400 transition">
                    {chip.label}
                  </span>
                  <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{chip.query}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                          <span className="text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
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

            {/* 结果摘要 — Word兼容文字输出 */}
            {task.result && (
              <div className="border-t border-[var(--border-primary)]">
                <div className="flex items-center justify-between px-5 py-3 bg-green-500/5 border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={22} className="text-green-400" />
                    <span className="text-base font-bold text-[var(--text-primary)]">执行报告</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopyReport} className="px-4 py-2 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1.5 transition font-medium" title="复制文本">
                      <Copy size={20} /> 复制
                    </button>
                    <button onClick={handleDownloadWord} className="px-4 py-2 text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg flex items-center gap-1.5 transition font-medium" title="下载Word文档">
                      <FileText size={20} /> Word
                    </button>
                    <button onClick={handleDownloadPdf} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg flex items-center gap-1.5 transition font-medium" title="打印为PDF">
                      <FileDown size={20} /> PDF
                    </button>
                    <button onClick={handleDownloadHtml} className="px-4 py-2 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1.5 transition font-medium" title="下载HTML">
                      <Download size={20} /> HTML
                    </button>
                  </div>
                </div>
                <div className="p-5 bg-white">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed" style={{fontFamily:'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'}}>{task.result}</pre>
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
              <pre className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] p-2 rounded mt-2 mb-3 max-h-32 overflow-y-auto">
                {JSON.stringify(confirmAction.params, null, 2)}
              </pre>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { confirmAction.resolve(false); setConfirmAction(null); }}
                className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition">
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
