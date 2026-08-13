import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, Target } from 'lucide-react';
import { DesktopProgress } from '../data/api';

interface Props {
  onBack: () => void;
}

const DesktopProgressView: React.FC<Props> = ({ onBack }) => {
  const [progressList, setProgressList] = useState<DesktopProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [projectNames, setProjectNames] = useState<string[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Fetch progress for all projects by not passing projectName filter initially
      // We'll try a few common approaches
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000/api') + '/mobile/progress/list', {
        headers: (() => {
          const token = localStorage.getItem('doc-system-token') || '';
          const h: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) h['Authorization'] = `Bearer ${token}`;
          return h;
        })(),
      });
      if (res.ok) {
        const data = await res.json();
        setProgressList(data || []);
        const names = [...new Set((data || []).map((p: DesktopProgress) => p.projectName || '').filter(Boolean))].sort();
        setProjectNames(names as string[]);
      } else {
        setProgressList([]);
      }
    } catch {
      setProgressList([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter by project
  const filtered = projectFilter
    ? progressList.filter(p => (p.projectName || '') === projectFilter)
    : progressList;

  const filteredUnmatched = filtered.filter(p => p.matchStatus === 'unmatched').length;
  const filteredMatched = filtered.filter(p => p.matchStatus === 'matched').length;
  const filteredAvg = filtered.length > 0
    ? Math.round(filtered.reduce((s, p) => s + p.percentage, 0) / filtered.length)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="shrink-0 bg-slate-300/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/zhjk-logo.png" alt="中航建科" className="h-9 w-auto" />
            <h1 className="text-lg font-bold text-[var(--text-primary,#1e293b)]">进度管理</h1>
          </div>
          <button onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-primary,#1e293b)]">{filtered.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">进度快报</div>
          </div>
          <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-green-500">
              {filtered.length > 0 ? Math.round((filteredMatched / filtered.length) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">匹配率</div>
          </div>
          <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{filteredAvg}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">平均进度</div>
          </div>
          <div className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-indigo-500">{filteredMatched}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">已关联计划</div>
          </div>
        </div>

        {/* Unmatched alert banner */}
        {filteredUnmatched > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-6 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              {filteredUnmatched} 条手机端进度未关联计划条目
            </span>
            <span className="text-xs text-amber-500 dark:text-amber-400 ml-2">
              请在目标管理中建立对应的计划项以便自动匹配
            </span>
          </div>
        )}

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-[var(--text-primary,#1e293b)] focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全部项目</option>
            {projectNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Progress list */}
        {loading ? (
          <div className="text-center py-24 text-slate-400 dark:text-slate-500 text-sm">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400 dark:text-slate-500 text-sm">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>暂无进度快报，请先在手机端提交进度</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="bg-white dark:bg-slate-800 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {p.projectName && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                          {p.projectName}
                        </span>
                      )}
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.matchStatus === 'matched'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      }`}>
                        {p.matchStatus === 'matched'
                          ? <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> 已匹配</span>
                          : '未匹配'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary,#1e293b)]">{p.title}</p>
                    {p.note && <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">{p.note}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xl font-bold text-blue-500">{p.percentage}%</span>
                  </div>
                </div>

                {/* Percentage bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${p.percentage >= 80 ? 'bg-green-500' : p.percentage >= 50 ? 'bg-blue-500' : p.percentage >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, p.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                  <span>上报人: {p.reportedBy}</span>
                  <span className="flex-1" />
                  <span>{p.createdAt?.slice(0, 16)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopProgressView;
