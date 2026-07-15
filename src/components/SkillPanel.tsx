import React, { useState, useEffect } from 'react';
import { ArrowLeft, Zap, ExternalLink, Edit3, Save, Shield, RotateCcw, Eye, Power, PowerOff, Plus, Trash2 } from 'lucide-react';
import { skillRegistry } from '../data/skillRegistry';
import { getAllSkillConfigs, loadCustomSkills, saveCustomSkills, type SkillConfig } from '../data/skillConfig';
import { toast } from './Toast';

interface SkillPanelProps { projectName: string; onBack: () => void; onNavigate?: (view: string, params?: Record<string, string>) => void; }

/** 8段式SKILL提示词标准框架 */
interface SkillPromptTemplate {
  role: string;           // 1. 角色定位
  scene: string;          // 2. 场景约束
  compliance: string;     // 3. 行业合规强制规则
  ragRules: string;       // 4. 向量知识库检索规则
  outputFormat: string;   // 5. 输出格式规范
  prohibitions: string;   // 6. 禁止规则
  tone: string;           // 7. 交互语气与服务定位
  custom: string;         // 8. 个性化扩展字段
}

/** 为每个技能生成默认8段式模板 */
function getDefaultTemplate(skillName: string, skillId: string): SkillPromptTemplate {
  const sceneMap: Record<string, string> = {
    'ai_chat': '全过程工程咨询通用AI助手，覆盖项目管理、技术咨询、规范检索等全流程业务',
    'construction-review': '施工组织设计/专项施工方案审查，逐章节进行合规性、完整性、安全性评估',
    'contract-review': '工程合同条款风险审查，识别法律风险、商务风险、履约风险',
    'bid-review': '招投标文件合规性检查，覆盖9大核心要素的完整性校验',
    'plan-generate': '工程方案智能生成，根据模板和参数输出标准化工程文档',
    'ai-fill-form': '工程附表智能填写，根据项目上下文自动填充表单字段',
    'ai-guide-notes': '工作办理指南生成，基于附件和流程信息输出标准化办事指引',
    'ai-breakdown-tasks': '工作项智能拆解，根据流程图或描述生成详细子任务清单',
  };

  return {
    role: '你是一名深耕全过程工程咨询的资深专家，精通工程立项、监理、造价、招投标、项目管控、资料归档、行业规范等全流程业务，熟悉国家及地方工程建设标准、咨询服务范式与项目管理流程。',
    scene: `本次服务场景为：${sceneMap[skillId] || skillName}。所有输出必须贴合该业务场景，不跨领域作答。`,
    compliance: `1. 所有内容必须符合现行工程建设国家标准、行业规范、全过程咨询服务准则；
2. 输出内容严谨、客观、专业，杜绝口语化、模糊化、主观臆断性结论；
3. 涉及工程数据、流程、条款必须有据可依，无依据内容严禁编造；
4. 针对咨询类输出，需区分「标准化规范内容」「项目个性化建议」「风险提示」三类信息。`,
    ragRules: `1. 优先匹配本地知识库向量数据，再结合通用行业知识作答；
2. 本地检索无匹配内容时，需明确告知用户「当前知识库无对应资料，以下为通用行业参考」，禁止静默编造；
3. 回答需绑定文档来源、规范条目、项目场景标签，贴合用户上传的工程资料内容。`,
    outputFormat: `1. 结构清晰，分段分层展示，重点结论前置；
2. 工程类内容分点、分条目、分模块输出，适配咨询业务阅读习惯；
3. 禁止大段无断点文字，关键数据、规范、风险点需要高亮突出。`,
    prohibitions: `1. 严禁输出违反工程规范、行业准则、项目管理逻辑的内容；
2. 严禁编造工程规范、政策文件、项目数据；
3. 不回答与工程咨询、项目管理无关的无关问题；
4. 涉密项目资料相关内容，严格遵循脱敏展示规则。`,
    tone: '以专业工程咨询师的口吻作答，严谨稳重、通俗易懂，兼顾专业性和实用性，可为项目落地提供可执行建议，不做空泛理论阐述。',
    custom: '根据当前AI技能专项能力补充专属规则。',
  };
}

/** 合并所有段落为完整Prompt */
function assemblePrompt(t: SkillPromptTemplate): string {
  return `【角色定位】
${t.role}

【场景约束】
${t.scene}

【行业合规强制规则】
${t.compliance}

【向量知识库检索规则】
${t.ragRules}

【输出格式规范】
${t.outputFormat}

【禁止规则】
${t.prohibitions}

【交互语气与服务定位】
${t.tone}

【个性化扩展字段】
${t.custom}`;
}

const LABELS: Record<keyof SkillPromptTemplate, string> = {
  role: '1. 角色定位', scene: '2. 场景约束', compliance: '3. 行业合规强制规则',
  ragRules: '4. 向量知识库检索规则', outputFormat: '5. 输出格式规范',
  prohibitions: '6. 禁止规则', tone: '7. 交互语气与服务定位', custom: '8. 个性化扩展字段',
};

const SkillPanel: React.FC<SkillPanelProps> = ({ projectName, onBack, onNavigate }) => {
  const skillConfigs = getAllSkillConfigs();
  const [filterCategory, setFilterCategory] = useState<string>('');

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try { const auth = JSON.parse(localStorage.getItem('doc-system-auth') || '{}'); setIsAdmin(auth?.user?.role === 'admin'); } catch {}
  }, []);

  // 自定义技能管理
  const [customSkills, setCustomSkills] = useState<SkillConfig[]>(loadCustomSkills);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillForm, setNewSkillForm] = useState<Partial<SkillConfig>>({ category: 'analysis', icon: '⚡' });

  const addCustomSkill = () => {
    if (!newSkillForm.name || !newSkillForm.id) { toast('名称和ID必填', 'warning'); return; }
    const skill: SkillConfig = {
      id: newSkillForm.id,
      name: newSkillForm.name,
      description: newSkillForm.description || '',
      category: newSkillForm.category || 'analysis',
      location: { page: newSkillForm.location?.page || '自定义', view: newSkillForm.location?.view || '', desc: newSkillForm.location?.desc || '' },
      icon: newSkillForm.icon || '⚡',
    };
    const updated = [...customSkills, skill];
    setCustomSkills(updated);
    saveCustomSkills(updated);
    setShowAddSkill(false);
    setNewSkillForm({ category: 'analysis', icon: '⚡' });
    toast('技能已添加', 'success');
  };

  const removeCustomSkill = (id: string) => {
    const updated = customSkills.filter(s => s.id !== id);
    setCustomSkills(updated);
    saveCustomSkills(updated);
    toast('已移除', 'success');
  };

  // 技能启用状态
  const [enabledSkills, setEnabledSkills] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('skill-enabled') || '[]')); } catch { return new Set<string>(); }
  });

  const toggleSkill = (id: string) => {
    setEnabledSkills(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('skill-enabled', JSON.stringify([...next]));
      return next;
    });
  };

  // 结构化编辑器
  const [showEditor, setShowEditor] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [template, setTemplate] = useState<SkillPromptTemplate>(getDefaultTemplate('', ''));
  const [activeField, setActiveField] = useState<keyof SkillPromptTemplate>('role');
  const [previewMode, setPreviewMode] = useState(false);

  const openEditor = (skillId: string, skillName: string) => {
    setEditingSkillId(skillId);
    const key = `skill-template-${skillId}`;
    const saved = localStorage.getItem(key);
    setTemplate(saved ? JSON.parse(saved) : getDefaultTemplate(skillName, skillId));
    setActiveField('role');
    setPreviewMode(false);
    setShowEditor(true);
  };

  const resetToDefault = () => {
    if (!editingSkillId) return;
    const name = skillRegistry.get(editingSkillId)?.name || '';
    setTemplate(getDefaultTemplate(name, editingSkillId));
    toast('已恢复默认模板', 'success');
  };

  const saveTemplate = () => {
    if (!editingSkillId) return;
    const key = `skill-template-${editingSkillId}`;
    // 版本历史
    const historyKey = `skill-template-history-${editingSkillId}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.unshift({ time: new Date().toISOString(), by: 'admin', content: template });
    if (history.length > 20) history.pop();
    localStorage.setItem(historyKey, JSON.stringify(history));

    localStorage.setItem(key, JSON.stringify(template));
    toast('提示词已保存', 'success');
    setShowEditor(false);
  };

  const categories = [
    { id: '', label: '全部' }, { id: 'review', label: '审查' },
    { id: 'generate', label: '生成' }, { id: 'fill', label: '填写' },
    { id: 'guide', label: '指南' }, { id: 'analysis', label: '分析' },
  ];

  const filtered = filterCategory ? skillConfigs.filter(s => s.category === filterCategory) : skillConfigs;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition"><ArrowLeft size={20} /></button>
            <Zap size={24} className="text-amber-400" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                {isAdmin ? 'AI技能配置中台' : '技能面板'}
              </h1>
              <p className="text-sm text-[var(--text-muted)]">{projectName} — {skillConfigs.length} 个系统SKILL已部署</p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddSkill(true)}
              className="px-3 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white rounded-lg flex items-center gap-1">
              <Plus size={14} /> 添加技能
            </button>
          )}
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
            const isEnabled = enabledSkills.has(s.id) || enabledSkills.size === 0;
            const isCustom = customSkills.some(c => c.id === s.id);
            return (
              <div key={s.id} className={`bg-[var(--bg-card)] border rounded-xl p-5 transition ${isEnabled ? 'border-[var(--border-primary)] hover:border-amber-500/30' : 'border-[var(--border-primary)] opacity-60'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-lg flex-shrink-0">
                    {s.icon || '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">{s.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">{s.category}</span>
                      {isCustom && <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">自定义</span>}
                      {isAdmin && (
                        <button onClick={() => toggleSkill(s.id)} className="text-[10px]" title={isEnabled ? '禁用' : '启用'}>
                          {isEnabled ? <Power size={12} className="text-green-400" /> : <PowerOff size={12} className="text-red-400" />}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{s.description}</p>
                  </div>
                </div>

                {/* 部署位置 */}
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3 mb-3">
                  <span className="text-[10px] text-[var(--text-muted)]">📍 部署位置</span>
                  <p className="text-xs text-[var(--text-primary)] font-medium">{s.location?.page || '系统各处'}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{s.location?.desc || s.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {s.location?.view && onNavigate && (
                    <button onClick={() => {
                      const view = s.location.view;
                      const params: Record<string, string> = {};
                      if (view === 'guide-chapter') params.chapterId = 'ch1';
                      onNavigate(view, params);
                    }}
                      className="flex-1 px-3 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-white rounded-lg flex items-center justify-center gap-1 transition">
                      <ExternalLink size={12} /> 前往使用
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => openEditor(s.id, s.name)}
                        className="px-3 py-2 text-xs border border-[var(--border-secondary)] hover:border-amber-500/30 rounded-lg text-[var(--text-secondary)] flex items-center gap-1 transition">
                        <Edit3 size={11} /> 配置
                      </button>
                      {isCustom && (
                        <button onClick={() => removeCustomSkill(s.id)}
                          className="px-2 py-2 text-xs text-red-400 hover:text-red-500 transition" title="删除自定义技能">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 8段式结构化编辑弹窗（管理员） */}
        {showEditor && isAdmin && editingSkillId && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowEditor(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* 头部 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] shrink-0">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-amber-400" />
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">SKILL配置：{skillRegistry.get(editingSkillId)?.name}</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">8段式结构化提示词 · 仅管理员</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={resetToDefault} className="px-2.5 py-1.5 text-[10px] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded flex items-center gap-1 transition" title="恢复为系统默认模板"><RotateCcw size={11} /> 重置</button>
                  <button onClick={() => setPreviewMode(!previewMode)} className={`px-2.5 py-1.5 text-[10px] rounded flex items-center gap-1 transition ${previewMode ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}><Eye size={11} /> {previewMode ? '编辑' : '预览'}</button>
                  <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">管理员</span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex">
                {/* 左侧：段落标签 */}
                {!previewMode && (
                  <div className="w-40 border-r border-[var(--border-primary)] overflow-y-auto shrink-0 bg-[var(--bg-secondary)]">
                    {(Object.keys(LABELS) as (keyof SkillPromptTemplate)[]).map((field) => (
                      <button key={field} onClick={() => setActiveField(field)}
                        className={`w-full text-left px-3 py-2.5 text-xs border-b border-[var(--border-primary)] transition ${
                          activeField === field ? 'bg-amber-500/10 text-amber-400 font-medium border-l-2 border-l-amber-500' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                        }`}>
                        {LABELS[field]}
                      </button>
                    ))}
                  </div>
                )}

                {/* 右侧：编辑/预览区 */}
                <div className="flex-1 overflow-y-auto p-4">
                  {previewMode ? (
                    <pre className="text-xs text-[var(--text-primary)] whitespace-pre-wrap font-sans leading-relaxed">{assemblePrompt(template)}</pre>
                  ) : (
                    <div>
                      <label className="text-[11px] font-medium text-amber-400 mb-1.5 block">{LABELS[activeField]}</label>
                      <textarea value={template[activeField]} onChange={e => setTemplate(t => ({ ...t, [activeField]: e.target.value }))}
                        rows={activeField === 'role' || activeField === 'tone' ? 3 : activeField === 'compliance' || activeField === 'prohibitions' || activeField === 'ragRules' ? 6 : 4}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-xs resize-none leading-relaxed" />
                    </div>
                  )}
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex justify-between items-center px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0 rounded-b-xl">
                <span className="text-[10px] text-[var(--text-muted)]">{activeField && LABELS[activeField]} · 共8段 · 保存后即时生效</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]">取消</button>
                  <button onClick={saveTemplate} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white rounded-lg flex items-center gap-1"><Save size={14} /> 保存并生效</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 添加自定义技能弹窗（管理员） */}
        {showAddSkill && isAdmin && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowAddSkill(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                <h3 className="font-bold text-sm text-[var(--text-primary)]">添加自定义技能</h3>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">配置化</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <input value={newSkillForm.id || ''} onChange={e => setNewSkillForm(f => ({ ...f, id: e.target.value }))}
                    placeholder="Skill ID *" className="col-span-2 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm" />
                  <input value={newSkillForm.icon || ''} onChange={e => setNewSkillForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="图标" className="bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm text-center" />
                </div>
                <input value={newSkillForm.name || ''} onChange={e => setNewSkillForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="技能名称 *" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm" />
                <input value={newSkillForm.description || ''} onChange={e => setNewSkillForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="描述" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm" />
                <select value={newSkillForm.category || 'analysis'} onChange={e => setNewSkillForm(f => ({ ...f, category: e.target.value as any }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm">
                  <option value="review">审查</option><option value="generate">生成</option><option value="fill">填写</option><option value="guide">指南</option><option value="analysis">分析</option>
                </select>
                <input value={newSkillForm.location?.page || ''} onChange={e => setNewSkillForm(f => ({ ...f, location: { ...f.location, page: e.target.value, view: f.location?.view || '', desc: f.location?.desc || '' } }))}
                  placeholder="所在页面" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm" />
                <input value={newSkillForm.location?.view || ''} onChange={e => setNewSkillForm(f => ({ ...f, location: { ...f.location, view: e.target.value, page: f.location?.page || '', desc: f.location?.desc || '' } }))}
                  placeholder="View路由（可选）" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm" />
                <input value={newSkillForm.location?.desc || ''} onChange={e => setNewSkillForm(f => ({ ...f, location: { ...f.location, desc: e.target.value, page: f.location?.page || '', view: f.location?.view || '' } }))}
                  placeholder="使用说明" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] rounded-b-xl">
                <button onClick={() => setShowAddSkill(false)} className="px-4 py-2 text-sm border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]">取消</button>
                <button onClick={addCustomSkill} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white rounded-lg flex items-center gap-1"><Plus size={14} /> 添加</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillPanel;
