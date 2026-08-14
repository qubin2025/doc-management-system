// IssueManager — 桌面端现场问题管理全项目视图
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchProjectIssues, updateIssueStatusDesktop, DesktopIssue } from '../data/api';

interface Props {
  onBack: () => void;
  projectName?: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  normal: '一般', urgent: '紧急', critical: '严重',
};
const SEVERITY_COLOR: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  urgent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  reported: '已上报', processing: '处理中', resolved: '已解决', closed: '已关闭',
};
const STATUS_COLOR: Record<string, string> = {
  reported: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const IssueManager: React.FC<Props> = ({ onBack, projectName: propProjectName }) => {
  const [issues, setIssues] = useState<DesktopIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectNames, setProjectNames] = useState<string[]>([]);

  const loadAll = () => {
    setLoading(true);
    const target = propProjectName || projectFilter || '';
    fetchProjectIssues(target)
      .then(data => {
        setIssues(data || []);
        const names = [...new Set((data || []).map(i => i.projectName).filter(Boolean))].sort();
        setProjectNames(names);
      })
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (propProjectName) setProjectFilter(propProjectName);
    loadAll();
  }, [propProjectName]);

  const filtered = issues.filter(i => {
    if (projectFilter && i.projectName !== projectFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    return true;
  });

  const totalCount = filtered.length;
  const urgentCount = filtered.filter(i => i.severity === 'urgent' || i.severity === 'critical').length;
  const resolvedCount = filtered.filter(i => i.status === 'resolved' || i.status === 'closed').length;

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    await updateIssueStatusDesktop(id, newStatus);
    loadAll();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="shrink-0 bg-slate-300/70 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/zhjk-logo.png" alt="中航建科" className="h-9 w-auto" />
            <h1 className="text-lg font-bold text-[var(--text-primary,#1e293b)]">现场问题管理</h1>
          </div>
          <button onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计栏 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-primary,#1e293b)]">{totalCount}</div>
            <div className="text-xs text-slate-500 mt-1">全部问题</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{urgentCount}</div>
            <div className="text-xs text-slate-500 mt-1">紧急/严重</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-500">{resolvedCount}</div>
            <div className="text-xs text-slate-500 mt-1">已解决/已关闭</div>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {propProjectName ? (
            <div className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-sm">
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">项目：</span>
              <span className="text-[var(--text-primary,#1e293b)]">{propProjectName}</span>
            </div>
          ) : (
            <select value={projectFilter} onChange={e => { setProjectFilter(e.target.value); loadAll(); }}
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-[var(--text-primary,#1e293b)] focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">全部项目</option>
              {projectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5">
            {[
              { value: 'all', label: '全部状态' },
              { value: 'reported', label: '已上报' },
              { value: 'processing', label: '处理中' },
              { value: 'resolved', label: '已解决' },
              { value: 'closed', label: '已关闭' },
            ].map(s => (
              <button key={s.value} onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${statusFilter === s.value ? 'bg-white dark:bg-slate-800 text-[var(--text-primary,#1e293b)] shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 问题列表 */}
        {loading ? (
          <div className="text-center py-24 text-slate-400 text-sm">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm">暂无现场问题记录</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(iss => (
              <div key={iss.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                        {iss.projectName || '未知项目'}
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLOR[iss.severity] || 'bg-gray-100 text-gray-600'}`}>
                        {SEVERITY_LABEL[iss.severity] || iss.severity}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary,#1e293b)]">{iss.title}</p>
                    {iss.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{iss.description}</p>}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[iss.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[iss.status] || iss.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mb-2">
                  {iss.assignee && <span>{'负责人: '}{iss.assignee}</span>}
                  {iss.reportedBy && <span>{'上报人: '}{iss.reportedBy}</span>}
                  <span className="flex-1" />
                  <span>{iss.createdAt?.slice(0, 16)}</span>
                </div>
                {/* 操作按钮 */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  {iss.status === 'reported' && (
                    <button onClick={() => handleStatusUpdate(iss.id, 'processing')}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-100 transition-colors">
                      开始处理
                    </button>
                  )}
                  {iss.status === 'processing' && (
                    <button onClick={() => handleStatusUpdate(iss.id, 'resolved')}
                      className="px-3 py-1 text-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors">
                      标记解决
                    </button>
                  )}
                  {(iss.status === 'resolved' || iss.status === 'processing') && (
                    <button onClick={() => handleStatusUpdate(iss.id, 'closed')}
                      className="px-3 py-1 text-xs bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-colors">
                      关闭
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IssueManager;
