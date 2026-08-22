import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FlaskConical, Search, Trash2, ShieldAlert, ShieldCheck, ShieldX, Info, BarChart3, TrendingUp, Clock, Target, Lightbulb } from 'lucide-react';
import {
  extractExperiences,
  listExperiences,
  deleteExperience,
  ExperienceItem,
  AggregatedPattern,
} from '../data/api';
import { logColorConfig } from '../data/colorDebug';
import ModuleHeader from './ModuleHeader';

interface Props {
  projectName: string;
  onBack: () => void;
}

const severityConfig: Record<string, { icon: typeof ShieldCheck; color: string; bg: string; label: string }> = {
  healthy: { icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: '健康' },
  warning: { icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: '关注' },
  critical: { icon: ShieldX, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: '风险' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: '信息' },
};

const categoryLabels: Record<string, string> = {
  completion_rate: '完成率',
  risk: '风险模式',
  quality: '质量控制',
  duration: '完成周期',
  level_distribution: '层级分布',
  cost: '成本管控',
  schedule: '进度管理',
  compliance: '合规管理',
  resource: '资源管理',
};

const ExperiencePanel: React.FC<Props> = ({ projectName, onBack }) => {
  const [items, setItems] = useState<ExperienceItem[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedPattern[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [error, setError] = useState('');
  const [extractMsg, setExtractMsg] = useState('');
  const [total, setTotal] = useState(0);

  const loadExperiences = async (opts?: { category?: string; keyword?: string }) => {
    setLoading(true);
    setError('');
    try {
      const res = await listExperiences({
        category: opts?.category || (filterCategory !== 'all' ? filterCategory : undefined),
        keyword: opts?.keyword || searchKeyword || undefined,
        limit: 100,
      });
      setItems(res.items);
      setAggregated(res.aggregated || []);
      setCategories(res.categories || []);
      setTotal(res.total);
    } catch (e: unknown) {
      setError((e as Error).message || '查询失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExperiences();
  }, []);

  // 颜色调试日志：记录当前颜色配置与变更历史（仅开发模式）
  useEffect(() => { logColorConfig('ExperiencePanel'); }, []);

  const handleExtract = async () => {
    setExtracting(true);
    setExtractMsg('');
    setError('');
    try {
      const res = await extractExperiences();
      setExtractMsg(res.message);
      // Reload list
      await loadExperiences();
    } catch (e: unknown) {
      setError((e as Error).message || '提取失败');
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExperience(id);
      await loadExperiences();
    } catch (e: unknown) {
      setError((e as Error).message || '删除失败');
    }
  };

  const handleSearch = () => {
    loadExperiences({ keyword: searchKeyword, category: filterCategory !== 'all' ? filterCategory : undefined });
  };

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterCategory !== 'all') {
      result = result.filter(i => i.category === filterCategory);
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(
        i =>
          i.title.toLowerCase().includes(kw) ||
          i.description.toLowerCase().includes(kw) ||
          i.projectName.toLowerCase().includes(kw)
      );
    }
    return result;
  }, [items, filterCategory, searchKeyword]);

  // Stats
  const stats = useMemo(() => {
    const totalPatterns = items.length;
    const riskCount = items.filter(i => i.category === 'risk').length;
    const healthyCount = items.filter(i =>
      i.patterns?.some(p => p.severity === 'healthy')
    ).length;
    const warningCount = items.filter(i =>
      i.patterns?.some(p => p.severity === 'warning' || p.severity === 'critical')
    ).length;
    const projectSet = new Set(items.map(i => i.projectName));
    return { totalPatterns, riskCount, healthyCount, warningCount, projectCount: projectSet.size };
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <ModuleHeader
        title="项目经验库"
        subtitle={projectName}
        onBack={onBack}
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        actions={
          <>
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-xs"
            >
              {extracting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5" />
              )}
              {extracting ? '提取中...' : '提取经验'}
            </button>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Status messages */}
        {extractMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
            <FlaskConical className="w-4 h-4 inline mr-1.5" />
            {extractMsg}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Stats bar */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <BarChart3 className="w-3.5 h-3.5" /> 经验总数
              </div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.totalPatterns}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <Target className="w-3.5 h-3.5" /> 来源项目
              </div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.projectCount}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 健康指标
              </div>
              <div className="text-lg font-bold text-green-700 dark:text-green-300">{stats.healthyCount}</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" /> 需关注
              </div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{stats.warningCount}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" /> 风险项
              </div>
              <div className="text-lg font-bold text-red-700 dark:text-red-300">{stats.riskCount}</div>
            </div>
          </div>
        )}

        {/* Search & filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索经验关键词..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => {
              setFilterCategory(e.target.value);
              loadExperiences({ category: e.target.value !== 'all' ? e.target.value : undefined, keyword: searchKeyword || undefined });
            }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="all">全部分类</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            搜索
          </button>
        </div>

        {/* Loading state */}
        {loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="text-sm">正在加载项目经验...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FlaskConical className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-sm font-medium text-gray-500 mb-1">暂无项目经验记录</p>
            <p className="text-xs text-gray-400 mb-4">点击"提取经验"从已完成项目中自动分析经验模式</p>
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {extracting ? '提取中...' : '立即提取'}
            </button>
          </div>
        )}

        {/* Aggregated patterns (cross-project) */}
        {aggregated.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              跨项目聚合模式
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aggregated.map((agg, i) => {
                const sev = severityConfig[agg.severity || 'info'] || severityConfig.info;
                const Icon = sev.icon;
                return (
                  <div
                    key={agg.type || i}
                    className={`rounded-xl border p-4 ${sev.bg} dark:bg-opacity-10`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${sev.color}`} />
                      <span className={`text-xs font-bold ${sev.color}`}>
                        {agg.title}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                        {agg.projects?.length || agg.count || 0} 项目
                      </span>
                    </div>
                    {agg.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{agg.description}</p>
                    )}
                    {agg.agentHint && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 mt-2 flex items-start gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{agg.agentHint}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Experience items list */}
        {filteredItems.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              经验详情 ({filteredItems.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map(item => {
                const sev = item.patterns?.[0]?.severity
                  ? severityConfig[item.patterns[0].severity] || severityConfig.info
                  : severityConfig.info;
                const Icon = sev.icon;
                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow relative group`}
                  >
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Severity badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${sev.color}`} />
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${sev.bg} ${sev.color}`}>
                        {sev.label}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {categoryLabels[item.category] || item.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      {item.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Agent hint */}
                    {item.patterns?.[0]?.agentHint && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 mb-3">
                        <div className="flex items-start gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{item.patterns[0].agentHint}</span>
                        </div>
                      </div>
                    )}

                    {/* Metrics summary */}
                    {item.metrics && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                        {item.metrics.avgDurationDays > 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.metrics.avgDurationDays}天
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {item.metrics.completedCount}/{item.metrics.totalItems} 项
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {item.metrics.avgProgress}% 进度
                        </span>
                      </div>
                    )}

                    {/* Project name */}
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      来源: {item.projectName}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Summary footer */}
        <div className="mt-8 text-xs text-slate-400 dark:text-slate-500 text-center pb-8">
          共 {total} 条经验记录 · 覆盖 {aggregated.length} 种模式类型 · 来源于 {stats.projectCount} 个项目
        </div>
      </div>
    </div>
  );
};

export default ExperiencePanel;
