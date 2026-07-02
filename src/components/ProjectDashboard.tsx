import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderOpen, BarChart3, Users, FileText, Clock, ArrowRight, LogOut, User, Shield, Sparkles } from 'lucide-react';
import * as api from '../data/api';
import { toast } from './Toast';
import { ProjectInfo } from '../types';

interface Props {
  onNavigate: (view: string, project?: string) => void;
  onLogout: () => void;
  currentUser?: { username: string; role: string };
}

const ProjectDashboard: React.FC<Props> = ({ onNavigate, onLogout, currentUser }) => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [stats, setStats] = useState({ projects: 0, documents: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await api.fetchProjects();
        setProjects(Array.isArray(list) ? list : []);
        try {
          const s = await (await fetch('/api/stats')).json();
          setStats({ projects: s.projects || list.length, documents: s.documents || 0, users: s.users || 0 });
        } catch {}
      } catch { setProjects([]); }
      setLoading(false);
    })();
  }, []);

  const filtered = searchQuery ? projects.filter(p => p.name.includes(searchQuery)) : projects;

  return (
    <div className="min-h-screen" style={{ background: '#f6f8fa' }}>
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-30 border-b" style={{ height: 56, background: '#ffffff', borderColor: '#dde3ea' }}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#8f482f' }}>
                <span className="text-white font-black text-xs">PM</span>
              </div>
              <div>
                <h1 className="font-bold text-sm" style={{ color: '#111827' }}>全过程工程咨询管理平台</h1>
                <p className="text-[10px]" style={{ color: '#4b5563' }}>Project Management System</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs" style={{ color: '#4b5563' }}>
              <User className="w-3.5 h-3.5 inline mr-1" />
              {currentUser?.username || 'admin'}
              <span className="mx-1.5" style={{ color: '#8b98a7' }}>|</span>
              <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#f6f8fa', color: '#4b5563' }}>
                {currentUser?.role === 'admin' ? '管理员' : currentUser?.role === 'project_manager' ? '项目经理' : '用户'}
              </span>
            </div>
            <button onClick={() => { try { api.logout(); } catch {} onLogout(); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#4b5563', border: '1px solid #dde3ea' }}>
              <LogOut className="w-3.5 h-3.5"/> 退出
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ===== 统计卡片 ===== */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { icon: FolderOpen, label: '项目总数', value: stats.projects, color: '#8f482f', bg: '#ffdbd0' },
            { icon: FileText, label: '文档总数', value: stats.documents, color: '#2d628f', bg: '#d9ecff' },
            { icon: Users, label: '系统用户', value: stats.users, color: '#4f6237', bg: '#dcfae6' },
            { icon: Clock, label: '活跃项目', value: projects.length, color: '#b54708', bg: '#fef0c7' },
          ].map((card, i) => (
            <div key={i} className="rounded-xl p-5 border" style={{ background: '#ffffff', borderColor: '#dde3ea' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#4b5563' }}>{card.label}</p>
                  <p className="text-2xl font-bold" style={{ color: '#111827' }}>{loading ? '-' : card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== 快捷入口 ===== */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: Search, label: '项目资料管理', desc: '按规程管理工程资料', view: 'project-entry', color: '#8f482f', bg: '#ffdbd0' },
            { icon: Shield, label: '安全巡检', desc: '照片→JGJ59对标分析', view: 'safety-inspection', color: '#b42318', bg: '#fee4e2' },
            { icon: Sparkles, label: 'AI 助手', desc: '大模型对话+文件分析', view: 'ai-chat', color: '#2d628f', bg: '#d9ecff' },
            { icon: BarChart3, label: '管理后台', desc: '用户/统计/健康面板', view: 'admin', color: '#4f6237', bg: '#f6f8fa' },
          ].map((item, i) => (
            <button key={i} onClick={() => onNavigate(item.view)}
              className="rounded-xl p-4 text-left border transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: '#ffffff', borderColor: '#dde3ea' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: item.bg }}>
                <item.icon className="w-4.5 h-4.5" style={{ color: item.color }} />
              </div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: '#111827' }}>{item.label}</h3>
              <p className="text-[11px]" style={{ color: '#4b5563' }}>{item.desc}</p>
            </button>
          ))}
        </div>

        {/* ===== 项目列表 ===== */}
        <div className="rounded-xl border overflow-hidden" style={{ background: '#ffffff', borderColor: '#dde3ea' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#dde3ea' }}>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: '#111827' }}>项目列表</h2>
              <p className="text-[11px] mt-0.5" style={{ color: '#4b5563' }}>
                {filtered.length} 个项目 · 点击进入项目资料管理
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b98a7' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索项目..."
                  className="pl-9 pr-4 py-2 rounded-lg text-sm border outline-none transition-colors"
                  style={{ borderColor: '#dde3ea', color: '#111827', background: '#ffffff', width: 240 }}
                  onFocus={e => { e.target.style.borderColor = '#8f482f'; e.target.style.boxShadow = '0 0 0 3px rgba(143,72,47,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#dde3ea'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <button onClick={() => onNavigate('project-entry')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ background: '#8f482f' }}>
                <Plus className="w-4 h-4"/> 新建项目
              </button>
            </div>
          </div>
          {loading ? (
            <div className="px-6 py-12 text-center text-sm" style={{ color: '#8b98a7' }}>加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FolderOpen className="w-8 h-8 mx-auto mb-3" style={{ color: '#8b98a7', opacity: 0.5 }} />
              <p className="text-sm" style={{ color: '#4b5563' }}>{searchQuery ? '未找到匹配项目' : '暂无项目'}</p>
              <p className="text-xs mt-1" style={{ color: '#8b98a7' }}>
                {searchQuery ? '尝试其他关键词' : '点击右上角「新建项目」开始'}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#dde3ea' }}>
              {filtered.map((proj: any) => (
                <div key={proj.name || proj.id}
                  onClick={() => onNavigate('project-entry', proj.name)}
                  className="flex items-center justify-between px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f6f8fa' }}>
                      <FolderOpen className="w-4 h-4" style={{ color: '#8f482f' }} />
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: '#111827' }}>{proj.name}</p>
                      <p className="text-[10px]" style={{ color: '#4b5563' }}>
                        创建于 {proj.createdAt || proj.created_at || '—'}
                        {proj.details?.scale ? ` · ${proj.details.scale}` : ''}
                        {proj.details?.investment ? ` · ${proj.details.investment}` : ''}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4" style={{ color: '#8b98a7' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
