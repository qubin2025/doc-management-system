import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Shield } from 'lucide-react';

interface AuditLogViewerProps { projectName?: string; onBack: () => void; }

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ projectName, onBack }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState({ action: '', user: '' });

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (projectName) params.set('project', projectName);
      if (filter.action) params.set('action', filter.action);
      if (filter.user) params.set('user', filter.user);
      const res = await fetch(`/api/audit?${params}`, {
        headers: { 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token || ''}` },
      });
      if (res.ok) setLogs(await res.json());
    } catch { /* offline */ }
  };

  useEffect(() => { loadLogs(); }, [projectName, filter]);

  const actionLabel = (a: string) => ({ create: '创建', update: '更新', delete: '删除', view: '查看', export: '导出', import: '导入' })[a] || a;
  const targetLabel = (t: string) => ({ project: '项目', objective: '目标', baseline: '基线', document: '文档', 'work-item': '工作项', form: '表单', configuration: '配置' })[t] || t;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition"><ArrowLeft size={20} /></button>
            <Shield size={24} className="text-red-400" />
            <div><h1 className="text-xl font-bold text-[var(--text-primary)]">审计日志</h1><p className="text-sm text-[var(--text-muted)]">{projectName || '全局'}</p></div>
          </div>
          <div className="flex gap-2">
            <select value={filter.action} onChange={e => setFilter(f => ({ ...f, action: e.target.value }))}
              className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)]">
              <option value="">全部操作</option>
              <option value="create">创建</option><option value="update">更新</option><option value="delete">删除</option>
              <option value="view">查看</option><option value="export">导出</option><option value="import">导入</option>
            </select>
            <input type="text" value={filter.user} onChange={e => setFilter(f => ({ ...f, user: e.target.value }))}
              placeholder="按用户筛选..." className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-1.5 text-xs" />
            <button onClick={loadLogs} className="px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-xs text-[var(--text-primary)] flex items-center gap-1">
              <Search size={12} /> 刷新
            </button>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)]">
              <Shield size={48} className="mx-auto mb-4 opacity-30" />
              <p>暂无审计日志</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[var(--bg-secondary)] text-left"><th className="px-4 py-2.5 text-xs text-[var(--text-muted)]">时间</th><th className="px-4 py-2.5 text-xs text-[var(--text-muted)]">用户</th><th className="px-4 py-2.5 text-xs text-[var(--text-muted)]">操作</th><th className="px-4 py-2.5 text-xs text-[var(--text-muted)]">目标</th><th className="px-4 py-2.5 text-xs text-[var(--text-muted)]">详情</th></tr></thead>
                <tbody>
                  {logs.slice(0, 100).map((log, i) => (
                    <tr key={log.id || i} className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-2 text-xs text-[var(--text-muted)]">{new Date(log.created_at).toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-2 text-xs text-[var(--text-primary)]">{log.user_id}</td>
                      <td className="px-4 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        log.action === 'delete' ? 'bg-red-500/10 text-red-400' :
                        log.action === 'create' ? 'bg-green-500/10 text-green-400' :
                        log.action === 'update' ? 'bg-sky-500/10 text-sky-400' : 'bg-gray-500/10 text-gray-400'
                      }`}>{actionLabel(log.action)}</span></td>
                      <td className="px-4 py-2 text-xs text-[var(--text-muted)]">{targetLabel(log.target_type)}</td>
                      <td className="px-4 py-2 text-xs text-[var(--text-muted)] max-w-xs truncate">{log.detail || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
