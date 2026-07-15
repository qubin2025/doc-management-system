import React, { useState, useEffect } from 'react';
import { ArrowLeft, Zap, ExternalLink, Edit3, Save, Shield } from 'lucide-react';
import { skillRegistry } from '../data/skillRegistry';
import { toast } from './Toast';

interface SkillPanelProps {
  projectName: string;
  onBack: () => void;
  onNavigate?: (view: string) => void;
}

/** 技能部署位置映射 */
const SKILL_LOCATION: Record<string, { page: string; view: string; desc: string }> = {
  'ai_chat':             { page: 'AI智能体', view: 'agent-console', desc: '输入目标让Agent自主规划执行多步任务' },
  'construction-review': { page: '施工方案审查', view: 'construction-review', desc: '上传施工组织设计，AI逐章审查并生成合规报告' },
  'contract-review':     { page: '合同审查', view: 'contract-review', desc: '上传合同文件，AI识别条款风险并给出修改建议' },
  'bid-review':          { page: '招投标文件审查', view: 'bid-review', desc: '上传招投标文件，AI检查9要素合规性' },
  'plan-generate':       { page: '方案生成', view: 'plan-generator', desc: '选择模板和章节，AI逐章生成工程方案' },
  'ai-fill-form':        { page: '工作指南 → 附表清单', view: 'guide-chapter', desc: '在工作指南的附表清单中，点击AI自动填写表单' },
  'ai-guide-notes':      { page: '工作指南 → 添加工作项', view: 'guide-chapter', desc: '添加/编辑工作项时，点击AI生成办理指南' },
  'ai-breakdown-tasks':  { page: '工作指南 → 添加工作项', view: 'guide-chapter', desc: '添加/编辑工作项时，点击AI拆解子任务' },
};

const SKILL_ICONS: Record<string, string> = {
  'construction-review': '🔍', 'contract-review': '📄', 'bid-review': '📋',
  'plan-generate': '✍️', 'ai-fill-form': '📝', 'ai-guide-notes': '📖',
  'ai-breakdown-tasks': '🔨', 'ai_chat': '💬',
};

const SkillPanel: React.FC<SkillPanelProps> = ({ projectName, onBack, onNavigate }) => {
  const skills = skillRegistry.list();
  const [filterCategory, setFilterCategory] = useState<string>('');

  // 管理员检测
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('doc-system-auth') || '{}');
      setIsAdmin(auth?.user?.role === 'admin');
    } catch {}
  }, []);

  // 提示词模板管理
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');

  const openPromptEditor = (skillId: string, skillName: string) => {
    setEditingSkillId(skillId);
    const key = `skill-prompt-${skillId}`;
    const saved = localStorage.getItem(key);
    setPromptText(saved || `请根据以下内容执行"${skillName}"任务：\n\n{context}\n\n要求：专业、详细、符合工程规范。`);
    setShowPromptEditor(true);
  };

  const savePrompt = () => {
    if (!editingSkillId) return;
    localStorage.setItem(`skill-prompt-${editingSkillId}`, promptText);
    toast('提示词已保存', 'success');
    setShowPromptEditor(false);
  };

  const categories = [
    { id: '', label: '全部' }, { id: 'review', label: '审查' },
    { id: 'generate', label: '生成' }, { id: 'fill', label: '填写' },
    { id: 'guide', label: '指南' }, { id: 'analysis', label: '分析' },
  ];

  const filtered = filterCategory ? skills.filter(s => s.category === filterCategory) : skills;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition"><ArrowLeft size={20} /></button>
          <Zap size={24} className="text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">技能面板</h1>
            <p className="text-sm text-[var(--text-muted)]">{projectName} — {skills.length} 个AI技能已部署</p>
          </div>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-2 mb-6">
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                filterCategory === c.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* 技能展示卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(s => {
            const loc = SKILL_LOCATION[s.id];
            return (
              <div key={s.id} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 hover:border-amber-500/30 transition">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-lg flex-shrink-0">
                    {SKILL_ICONS[s.id] || '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">{s.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 flex-shrink-0">{s.category}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{s.description}</p>
                  </div>
                </div>

                {/* 部署位置 */}
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-[var(--text-muted)]">📍 部署位置</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] font-medium">{loc?.page || '系统各处'}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{loc?.desc || s.description}</p>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {loc?.view && onNavigate && (
                    <button onClick={() => onNavigate(loc.view)}
                      className="flex-1 px-3 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-white rounded-lg flex items-center justify-center gap-1 transition">
                      <ExternalLink size={12} /> 前往使用
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => openPromptEditor(s.id, s.name)}
                      className="px-3 py-2 text-xs border border-[var(--border-secondary)] hover:border-amber-500/30 rounded-lg text-[var(--text-secondary)] flex items-center gap-1 transition"
                      title="修改提示词模板（管理员）">
                      <Edit3 size={11} /> 提示词
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 提示词编辑弹窗（管理员） */}
        {showPromptEditor && isAdmin && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowPromptEditor(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] shrink-0">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-amber-400" />
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">修改提示词模板</h3>
                </div>
                <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">仅管理员</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  修改 <strong className="text-amber-400">{skillRegistry.get(editingSkillId || '')?.name}</strong> 的提示词模板。
                  使用 <code className="bg-[var(--bg-secondary)] px-1 rounded">{'{context}'}</code> 作为上下文占位符。
                </p>
                <textarea value={promptText} onChange={e => setPromptText(e.target.value)}
                  rows={10} className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0 rounded-b-xl">
                <button onClick={() => setShowPromptEditor(false)} className="px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]">取消</button>
                <button onClick={savePrompt} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white rounded-lg flex items-center gap-1"><Save size={14} /> 保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillPanel;
