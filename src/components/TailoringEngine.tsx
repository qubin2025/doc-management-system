import React, { useState, useEffect } from 'react';
import { ArrowLeft, ClipboardCheck, ChevronRight, ChevronLeft, Save, RotateCcw, Check, Eye, EyeOff } from 'lucide-react';
import {
  ProjectProfile, WorkItemStatus, TailoringResult, TailoringConfig,
  computeTailoringResult, loadTailoringConfig, saveTailoringConfig,
  PROFILE_TEMPLATES,
} from '../data/tailoringEngine';
import { guideChapters as allChapters } from '../data/guideModules';

interface TailoringEngineProps {
  projectName: string;
  onBack: () => void;
  onApply?: (result: TailoringResult) => void;
}

const PROJECT_TYPES = [
  { value: 'building', label: '建筑工程' },
  { value: 'municipal', label: '市政工程' },
  { value: 'industrial', label: '工业工程' },
  { value: 'comprehensive', label: '综合工程' },
];

const INVESTMENT_LEVELS = [
  { value: 'small', label: '小型 (<5000万)' },
  { value: 'medium', label: '中型 (5000万-2亿)' },
  { value: 'large', label: '大型 (2亿-10亿)' },
  { value: 'extra-large', label: '特大型 (>10亿)' },
];

const COMPLEXITY_LEVELS = [
  { value: 'simple', label: '简单' },
  { value: 'normal', label: '常规' },
  { value: 'complex', label: '复杂' },
  { value: 'highly-complex', label: '高复杂度' },
];

const MANAGEMENT_SCOPES = [
  { value: 'pre-construction', label: '前期管理' },
  { value: 'bidding', label: '招标采购' },
  { value: 'construction', label: '施工管理' },
  { value: 'completion', label: '竣工移交' },
  { value: 'cost-management', label: '造价管理' },
  { value: 'schedule-management', label: '进度管理' },
  { value: 'quality-management', label: '质量管理' },
  { value: 'safety-management', label: '安全管理' },
  { value: 'contract-management', label: '合同管理' },
  { value: 'document-management', label: '资料管理' },
];

const TailoringEngine: React.FC<TailoringEngineProps> = ({ projectName, onBack, onApply }) => {
  const [step, setStep] = useState<'questionnaire' | 'result'>('questionnaire');
  const [result, setResult] = useState<TailoringResult | null>(null);
  const [manualAdjustments, setManualAdjustments] = useState<Map<string, WorkItemStatus>>(new Map());
  const [showExcluded, setShowExcluded] = useState(true);
  const [activeChapter, setActiveChapter] = useState('ch1');
  const [saved, setSaved] = useState(false);

  // 加载已保存配置
  useEffect(() => {
    const saved = loadTailoringConfig(projectName);
    if (saved) {
      setResult(saved.result);
      setManualAdjustments(new Map(saved.manualAdjustments.map(a => [a.workItemId, a.status])));
      setStep('result');
    }
  }, [projectName]);

  // 问卷状态
  const [profile, setProfile] = useState<ProjectProfile>({
    projectType: 'building',
    investmentLevel: 'medium',
    durationMonths: 24,
    complexity: 'normal',
    managementScope: ['pre-construction', 'bidding', 'construction', 'completion', 'safety-management'],
    hasHeritageProtection: false,
    hasEnvironmentalAssessment: false,
    hasTrafficImpact: false,
    hasUndergroundConstruction: false,
    hasSpecialStructure: false,
    hasMunicipalPipeline: false,
    stakeholderCount: 3,
    hasDesignManagement: false,
    hasBiddingAgency: false,
  });

  const updateProfile = (key: keyof ProjectProfile, value: unknown) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const toggleScope = (scope: string) => {
    setProfile(prev => ({
      ...prev,
      managementScope: prev.managementScope.includes(scope)
        ? prev.managementScope.filter(s => s !== scope)
        : [...prev.managementScope, scope],
    }));
  };

  const applyTemplate = (name: string) => {
    const tmpl = PROFILE_TEMPLATES[name];
    if (tmpl) {
      setProfile(prev => ({ ...prev, ...tmpl } as ProjectProfile));
    }
  };

  // 生成裁剪结果
  const generateResult = () => {
    const r = computeTailoringResult(profile, allChapters);
    setResult(r);
    setStep('result');
  };

  // 手动调整
  const adjustStatus = (workItemId: string, status: WorkItemStatus) => {
    setManualAdjustments(prev => {
      const next = new Map(prev);
      next.set(workItemId, status);
      return next;
    });
  };

  const getEffectiveStatus = (workItemId: string): WorkItemStatus => {
    return manualAdjustments.get(workItemId) || result?.workItemStatus[workItemId] || 'optional';
  };

  // 保存配置
  const handleSave = () => {
    if (!result) return;
    const config: TailoringConfig = {
      profile,
      result,
      manualAdjustments: Array.from(manualAdjustments.entries()).map(([workItemId, status]) => ({
        workItemId, status,
      })),
      savedAt: new Date().toISOString(),
      applied: true,
    };
    saveTailoringConfig(projectName, config);
    setSaved(true);
    if (onApply) onApply(result);
  };

  const statusLabel = (s: WorkItemStatus) => {
    switch (s) { case 'required': return '必须'; case 'recommended': return '推荐'; case 'optional': return '可选'; case 'excluded': return '排除'; }
  };
  const statusColor = (s: WorkItemStatus) => {
    switch (s) {
      case 'required': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'recommended': return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'optional': return 'bg-gray-500/10 text-[var(--text-secondary)] border-gray-500/30';
      case 'excluded': return 'bg-gray-700/20 text-gray-600 border-[var(--border-secondary)]/30';
    }
  };
  const statusBg = (s: WorkItemStatus) => {
    switch (s) {
      case 'required': return 'border-l-red-500';
      case 'recommended': return 'border-l-sky-500';
      case 'optional': return 'border-l-gray-600';
      case 'excluded': return 'border-l-transparent opacity-50';
    }
  };

  // === 问卷步骤 ===
  if (step === 'questionnaire') {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition">
              <ArrowLeft size={20} />
            </button>
            <ClipboardCheck size={24} className="text-purple-400" />
            <div>
              <h1 className="text-xl font-bold">模块裁剪引擎</h1>
              <p className="text-sm text-[var(--text-muted)]">{projectName} — 项目特征问卷</p>
            </div>
          </div>

          {/* 预设模板 */}
          <div className="mb-6">
            <p className="text-sm text-[var(--text-secondary)] mb-2">快速模板</p>
            <div className="flex gap-2">
              {Object.entries(PROFILE_TEMPLATES).map(([name]) => (
                <button key={name} onClick={() => applyTemplate(name)}
                  className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded-lg transition">
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* 项目类型 */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
              <h3 className="text-sm font-medium mb-3">项目类型</h3>
              <div className="grid grid-cols-4 gap-2">
                {PROJECT_TYPES.map(t => (
                  <button key={t.value} onClick={() => updateProfile('projectType', t.value)}
                    className={`px-3 py-2 rounded-lg text-xs border transition ${
                      profile.projectType === t.value
                        ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                        : 'bg-gray-800 border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-gray-600'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 投资规模 + 工期 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
                <h3 className="text-sm font-medium mb-3">投资规模</h3>
                <div className="space-y-2">
                  {INVESTMENT_LEVELS.map(l => (
                    <button key={l.value} onClick={() => updateProfile('investmentLevel', l.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition ${
                        profile.investmentLevel === l.value
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-gray-800 border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-gray-600'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
                <h3 className="text-sm font-medium mb-3">计划工期 (月)</h3>
                <input type="number" value={profile.durationMonths}
                  onChange={e => updateProfile('durationMonths', Number(e.target.value))}
                  className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <h3 className="text-sm font-medium mt-4 mb-3">项目复杂度</h3>
                <div className="space-y-2">
                  {COMPLEXITY_LEVELS.map(c => (
                    <button key={c.value} onClick={() => updateProfile('complexity', c.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition ${
                        profile.complexity === c.value
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-gray-800 border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-gray-600'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 管理范围 */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
              <h3 className="text-sm font-medium mb-3">管理范围 (多选)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {MANAGEMENT_SCOPES.map(s => {
                  const selected = profile.managementScope.includes(s.value);
                  return (
                    <button key={s.value} onClick={() => toggleScope(s.value)}
                      className={`px-3 py-2 rounded-lg text-xs border transition ${
                        selected
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-gray-800 border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-gray-600'}`}>
                      {selected && <Check size={10} className="inline mr-1" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 特殊需求 */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
              <h3 className="text-sm font-medium mb-3">特殊需求</h3>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['hasHeritageProtection', '文保需求'],
                  ['hasEnvironmentalAssessment', '环境影响评价'],
                  ['hasTrafficImpact', '交通影响评价'],
                  ['hasUndergroundConstruction', '地下施工'],
                  ['hasSpecialStructure', '特殊结构(超限/大跨度)'],
                  ['hasMunicipalPipeline', '市政管线协同'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition">
                    <input type="checkbox" checked={!!profile[key]}
                      onChange={e => updateProfile(key, e.target.checked)}
                      className="accent-purple-500" />
                    <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 组织特征 */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
              <h3 className="text-sm font-medium mb-3">组织特征</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">参与方数量</label>
                  <input type="number" value={profile.stakeholderCount}
                    onChange={e => updateProfile('stakeholderCount', Number(e.target.value))}
                    min={1} max={20}
                    className="w-full bg-gray-800 border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={profile.hasDesignManagement}
                      onChange={e => updateProfile('hasDesignManagement', e.target.checked)}
                      className="accent-purple-500" />
                    <span className="text-xs text-[var(--text-secondary)]">设计管理</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={profile.hasBiddingAgency}
                      onChange={e => updateProfile('hasBiddingAgency', e.target.checked)}
                      className="accent-purple-500" />
                    <span className="text-xs text-[var(--text-secondary)]">招标代理</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 生成按钮 */}
          <div className="mt-6 flex justify-end">
            <button onClick={generateResult}
              className="px-6 py-2.5 bg-purple-500 hover:bg-purple-400 text-white rounded-lg transition flex items-center gap-2">
              生成裁剪方案 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === 结果步骤 ===
  if (!result) return null;

  const chapters = allChapters;
  const currentChapter = chapters.find(ch => ch.id === activeChapter) || chapters[0];

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('questionnaire')} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition">
              <ChevronLeft size={20} />
            </button>
            <ClipboardCheck size={24} className="text-purple-400" />
            <div>
              <h1 className="text-xl font-bold">裁剪结果</h1>
              <p className="text-sm text-[var(--text-muted)]">{projectName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('questionnaire')}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-[var(--bg-hover)] rounded-lg transition flex items-center gap-1">
              <RotateCcw size={14} /> 重新评估
            </button>
            <button onClick={() => setShowExcluded(!showExcluded)}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-[var(--bg-hover)] rounded-lg transition flex items-center gap-1">
              {showExcluded ? <EyeOff size={14} /> : <Eye size={14} />}
              {showExcluded ? '隐藏排除项' : '显示全部'}
            </button>
            <button onClick={handleSave}
              className={`px-4 py-1.5 text-sm rounded-lg transition flex items-center gap-1 ${
                saved ? 'bg-green-600 text-white' : 'bg-purple-500 hover:bg-purple-400 text-white'
              }`}>
              <Save size={14} /> {saved ? '已保存' : '保存配置'}
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{result.summary.total}</div>
            <div className="text-xs text-[var(--text-muted)]">总工作项</div>
          </div>
          <div className="bg-gray-900 border border-red-500/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{result.summary.required}</div>
            <div className="text-xs text-[var(--text-muted)]">必须</div>
          </div>
          <div className="bg-gray-900 border border-sky-500/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-sky-400">{result.summary.recommended}</div>
            <div className="text-xs text-[var(--text-muted)]">推荐</div>
          </div>
          <div className="bg-gray-900 border border-[var(--border-secondary)] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-secondary)]">{result.summary.optional}</div>
            <div className="text-xs text-[var(--text-muted)]">可选</div>
          </div>
          <div className="bg-gray-900 border border-[var(--border-secondary)]/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{result.summary.excluded}</div>
            <div className="text-xs text-[var(--text-muted)]">排除</div>
          </div>
        </div>

        {/* 章节切换 */}
        <div className="flex gap-2 mb-4">
          {chapters.map(ch => (
            <button key={ch.id} onClick={() => setActiveChapter(ch.id)}
              className={`px-4 py-1.5 text-sm rounded-lg transition ${
                activeChapter === ch.id
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-gray-800 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}>
              第{ch.number}章 {ch.title}
            </button>
          ))}
        </div>

        {/* 工作项列表 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          {currentChapter.subModules.map(sm => (
            <div key={sm.id}>
              <div className="px-4 py-2 bg-[var(--bg-hover)] text-sm font-medium text-[var(--text-secondary)]">
                {sm.name}
              </div>
              {sm.workItems.map(wi => {
                const status = getEffectiveStatus(wi.id);
                if (!showExcluded && status === 'excluded') return null;
                const isAdjusted = manualAdjustments.has(wi.id);
                return (
                  <div key={wi.id} className={`flex items-center gap-3 px-4 py-2 border-l-2 ${statusBg(status)} hover:bg-gray-800/30 transition`}>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(status)}`}>
                      {statusLabel(status)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] w-12">{wi.id}</span>
                    <span className="text-sm flex-1">{wi.name}</span>

                    {/* 手动调整按钮 */}
                    <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition">
                      {(['required', 'recommended', 'optional', 'excluded'] as WorkItemStatus[]).map(s => {
                        const isCurrent = status === s;
                        return (
                          <button key={s} onClick={() => adjustStatus(wi.id, s)}
                            className={`px-1.5 py-0.5 text-[10px] rounded border transition ${
                              isCurrent ? statusColor(s) : 'bg-gray-800 border-[var(--border-secondary)] text-gray-600 hover:border-gray-600'
                            }`} title={`设为${statusLabel(s)}`}>
                            {s === 'required' ? '必' : s === 'recommended' ? '荐' : s === 'optional' ? '可' : '排'}
                          </button>
                        );
                      })}
                    </div>
                    {isAdjusted && <span className="text-[10px] text-amber-500">已调整</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TailoringEngine;
