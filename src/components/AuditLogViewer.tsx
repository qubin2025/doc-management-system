import React, { useState, useEffect } from 'react';
import { Search, Shield } from 'lucide-react';
import ModuleHeader from './ModuleHeader';
import VirtualList from './VirtualList';

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
        <ModuleHeader title="审计日志" icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />} onBack={onBack} subtitle={projectName || '全局'} actions={
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
        } />

        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)]">
              <Shield size={48} className="mx-auto mb-4 opacity-30" />
              <p>暂无审计日志</p>
            </div>
          ) : (
            <>
              {/* 表头 */}
              <div className="flex bg-[var(--bg-secondary)] text-xs text-[var(--text-muted)] border-b border-[var(--border-primary)]">
                <div className="px-4 py-2.5 w-40 flex-shrink-0">时间</div>
                <div className="px-4 py-2.5 w-28 flex-shrink-0">用户</div>
                <div className="px-4 py-2.5 w-20 flex-shrink-0">操作</div>
                <div className="px-4 py-2.5 w-24 flex-shrink-0">目标</div>
                <div className="px-4 py-2.5 flex-1 min-w-0">详情</div>
              </div>
              {/* 虚拟列表 */}
              <VirtualList
                items={logs}
                itemHeight={40}
                height={560}
                keyExtractor={(item) => item.id || Math.random()}
                renderItem={(log) => (
                  <div className="flex items-center border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] text-xs">
                    <div className="px-4 py-2 w-40 flex-shrink-0 text-[var(--text-muted)] truncate">{new Date(log.created_at).toLocaleString('zh-CN')}</div>
                    <div className="px-4 py-2 w-28 flex-shrink-0 text-[var(--text-primary)] truncate">{log.user_id}</div>
                    <div className="px-4 py-2 w-20 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        log.action === 'delete' ? 'bg-red-500/10 text-red-400' :
                        log.action === 'create' ? 'bg-green-500/10 text-green-400' :
                        log.action === 'update' ? 'bg-sky-500/10 text-sky-400' : 'bg-gray-500/10 text-gray-400'
                      }`}>{actionLabel(log.action)}</span>
                    </div>
                    <div className="px-4 py-2 w-24 flex-shrink-0 text-[var(--text-muted)] truncate">{targetLabel(log.target_type)}</div>
                    <div className="px-4 py-2 flex-1 min-w-0 text-[var(--text-muted)] truncate">{log.detail || '-'}</div>
                  </div>
                )}
              />
              {logs.length > 100 && (
                <div className="px-4 py-2 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-primary)]">
                  共 {logs.length} 条记录，虚拟滚动加载
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
