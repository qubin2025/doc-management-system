// 移动端项目选择页
import React, { useEffect, useState } from 'react';
import { FolderOpen, LogOut, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { fetchProjectsWithId } from '../data/mobileApi';
import { MobileProject } from '../types';
import { UserInfo } from '../../types';

interface Props {
  user: UserInfo;
  onSelect: (p: MobileProject) => void;
  onLogout: () => void;
}

const ProjectPicker: React.FC<Props> = ({ user, onSelect, onLogout }) => {
  const [projects, setProjects] = useState<MobileProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setProjects(await fetchProjectsWithId());
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-slate-800">选择项目</h1>
          <p className="text-xs text-slate-500">{user.displayName || user.username}</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 text-sm text-slate-500 px-3 py-2 rounded-lg active:bg-slate-100">
          <LogOut className="w-4 h-4" /> 退出
        </button>
      </header>

      <main className="flex-1 p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载项目中…
          </div>
        )}
        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button onClick={load} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-blue-600 text-white text-sm">
              <RefreshCw className="w-4 h-4" /> 重试
            </button>
          </div>
        )}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">暂无项目，请先在电脑端创建项目</div>
        )}
        {!loading && projects.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 active:bg-blue-50 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex-1 text-base text-slate-800 font-medium truncate">{p.name}</span>
            <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
          </button>
        ))}
      </main>
    </div>
  );
};

export default ProjectPicker;
