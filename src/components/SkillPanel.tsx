import React, { useState } from 'react';
import { ArrowLeft, Zap, Play, Clock, CheckCircle2, XCircle, FileText, BookOpen, GitBranch, ClipboardCheck, FileCheck, FileSearch, Sparkles } from 'lucide-react';
import { skillRegistry } from '../data/skillRegistry';
import type { SkillResult, SkillContext } from '../types';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  FileText: <FileText size={18} />,
  BookOpen: <BookOpen size={18} />,
  GitBranch: <GitBranch size={18} />,
  ClipboardCheck: <ClipboardCheck size={18} />,
  FileCheck: <FileCheck size={18} />,
  FileSearch: <FileSearch size={18} />,
  Sparkles: <Sparkles size={18} />,
};

interface SkillPanelProps {
  projectName: string;
  onBack: () => void;
}

const SkillPanel: React.FC<SkillPanelProps> = ({ projectName, onBack }) => {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SkillResult | null>(null);
  const [running, setRunning] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const skills = skillRegistry.list(filterCategory || undefined);
  const skill = activeSkill ? skillRegistry.get(activeSkill) : null;

  const handleExecute = async () => {
    if (!activeSkill || !skill) return;
    setRunning(true);
    setResult(null);

    const ctx: SkillContext = { projectName, userId: 'admin' };
    const res = await skillRegistry.execute(activeSkill, {
      projectName,
      params: Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v])
      ),
    }, ctx);

    setResult(res);
    setRunning(false);
  };

  const categories = [
    { id: '', label: '全部' },
    { id: 'review', label: '审查' },
    { id: 'generate', label: '生成' },
    { id: 'fill', label: '填写' },
    { id: 'guide', label: '指南' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition">
            <ArrowLeft size={20} />
          </button>
          <Zap size={24} className="text-amber-400" />
          <div>
            <h1 className="text-xl font-bold">技能面板</h1>
            <p className="text-sm text-[var(--text-muted)]">{projectName} — {skills.length} 个可用技能</p>
          </div>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-2 mb-6">
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                filterCategory === c.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* 技能列表 */}
        {!activeSkill && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skills.map(s => (
              <button key={s.id} onClick={() => setActiveSkill(s.id)}
                className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 text-left hover:border-amber-500/30 transition group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    {SKILL_ICONS[s.icon] || <Zap size={18} className="text-amber-400" />}
                  </div>
                  <div>
                    <h3 className="font-medium group-hover:text-amber-400 transition">{s.name}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{s.description}</p>
                    <span className="inline-block mt-2 px-1.5 py-0.5 text-[10px] bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)]">{s.category}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 技能执行 */}
        {activeSkill && skill && (
          <div>
            <button onClick={() => { setActiveSkill(null); setResult(null); }}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-secondary)] mb-4 flex items-center gap-1">
              <ArrowLeft size={14} /> 返回技能列表
            </button>

            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  {SKILL_ICONS[skill.icon] || <Zap size={18} className="text-amber-400" />}
                </div>
                <div>
                  <h2 className="font-bold">{skill.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">{skill.description}</p>
                </div>
              </div>

              {/* 参数输入 */}
              <div className="space-y-3">
                {skill.id === 'ai-fill-form' && (
                  <>
                    <input type="text" placeholder="表单编号" onChange={e => setParams(p => ({ ...p, formCode: e.target.value }))}
                      className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input type="text" placeholder="表单名称" onChange={e => setParams(p => ({ ...p, formName: e.target.value }))}
                      className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                  </>
                )}
                {skill.category === 'review' && (
                  <input type="text" placeholder="文件内容（粘贴文本）" onChange={e => setParams(p => ({ ...p, fileContent: e.target.value }))}
                    className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                )}
                {skill.category === 'guide' && (
                  <input type="text" placeholder="工作项名称/描述" onChange={e => setParams(p => ({ ...p, itemName: e.target.value }))}
                    className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                )}
                {skill.id === 'plan-generate' && (
                  <>
                    <input type="text" placeholder="方案类型" defaultValue="施工组织设计"
                      onChange={e => setParams(p => ({ ...p, planType: e.target.value }))}
                      className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input type="text" placeholder="章节名称（留空生成大纲）" onChange={e => setParams(p => ({ ...p, chapterName: e.target.value }))}
                      className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                  </>
                )}
              </div>

              <button onClick={handleExecute} disabled={running}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg text-sm transition flex items-center gap-2">
                {running ? <><Clock size={14} className="animate-spin" /> 执行中...</> : <><Play size={14} /> 执行</>}
              </button>
            </div>

            {/* 结果 */}
            {result && (
              <div className={`bg-gray-900 border rounded-xl p-5 ${result.success ? 'border-green-500/30' : 'border-red-500/30'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {result.success ? <CheckCircle2 size={18} className="text-green-400" /> : <XCircle size={18} className="text-red-400" />}
                  <span className="font-medium">{result.success ? '执行成功' : '执行失败'}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">{(result.duration / 1000).toFixed(1)}s</span>
                </div>
                {result.report && <p className="text-sm text-[var(--text-secondary)] mb-2">{result.report}</p>}
                {result.data != null && (
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-xs text-[var(--text-secondary)] max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {String(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillPanel;
