import React, { useState } from 'react';
import { Search, FolderOpen, ArrowRight, Send, User, LogOut, Sparkles, Plus, Settings, Paperclip, Image, BarChart3, ChevronDown, Edit3, Download, X, Loader, Upload, Trash2 } from 'lucide-react';
import { ProjectInfo } from '../types';
import * as api from '../data/api';
import { toast } from './Toast';

interface ProjectEntryPageProps {
  projects: ProjectInfo[];
  currentUser: string;
  userDisplay: string;
  isAdmin: boolean;
  userRole: string;
  onSelectProject: (name: string) => void;
  onLogout: () => void;
  onAiSubmit: (query: string) => void;
  onCreateProject: () => void;
  onRenameProject: (oldName: string, newName: string) => void;
  onUpdateProject: (name: string, details: any) => void;
}

const ProjectEntryPage: React.FC<ProjectEntryPageProps> = ({
  projects, currentUser, userDisplay, isAdmin, userRole,
  onSelectProject, onLogout, onAiSubmit, onCreateProject, onRenameProject, onUpdateProject
}) => {
  const light = true; // 固定浅色模式
  const [search, setSearch] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('ai-model') || 'deepseek-v4-pro');
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [editingProj, setEditingProj] = useState('');
  const [editProjName, setEditProjName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectInfo | null>(null);
  const [editForm, setEditForm] = useState({ overview: '', area: '', scale: '', investment: '', pipeline: '', aiReport: '', custom: [] as {key:string;value:string}[] });
  const [projectDocs, setProjectDocs] = useState<{ fileName: string; data: string; size: number }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // 读取项目的指南模块进度
  const getProjectProgress = (_projName: string): { done: number; total: number } => {
    let done = 0, total = 0;
    for (let i = 1; i <= 4; i++) {
      const projPrefix = `guide-${_projName}-chapter-`;
      const doneKey = `${projPrefix}ch${i}-done`;
      const completed: string[] = JSON.parse(localStorage.getItem(doneKey) || '[]');
      const modulesKey = `${projPrefix}ch${i}-modules`;
      const modules: any[] = JSON.parse(localStorage.getItem(modulesKey) || 'null');
      if (modules) {
        modules.forEach((sm: any) => {
          total += sm.workItems?.length || 0;
          sm.workItems?.forEach((wi: any) => {
            if (completed.includes(wi.id)) done++;
          });
        });
      }
    }
    return { done, total };
  };

  const filtered = search.trim()
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const displayed = showMore ? filtered : filtered.slice(0, 10);

  // 模拟项目阶段和健康度（基于项目名称哈希）
  const getProjectMeta = (name: string) => {
    let h = 0; for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
    const phases = ['前期阶段', '招标阶段', '施工阶段', '竣工结算阶段'];
    const pi = Math.abs(h) % 4;
    const healthLevel = Math.abs(h * 7) % 5 + 1; // 1-5
    const alertCount = Math.abs(h * 3) % 3; // 0-2 (0=无告警)
    return { phase: phases[pi], health: healthLevel, alerts: alertCount };
  };

  // 主题样式
  const t = {
    bg: light ? 'bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200' : 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950',
    hdr: light ? 'bg-white/90 backdrop-blur-md border-b border-gray-300 shadow-sm' : 'bg-white/10 backdrop-blur-xl border-b border-white/10 shadow-lg',
    logoBg: light ? 'bg-blue-600' : 'bg-blue-600',
    logoShadow: light ? '' : 'shadow-lg shadow-blue-600/30',
    h1Text: light ? 'text-gray-800' : 'text-white',
    subText: light ? 'text-gray-400' : 'text-blue-300/70',
    userText: light ? 'text-gray-600' : 'text-blue-100',
    roleAdmin: light ? 'bg-red-100 text-red-700' : 'bg-red-500/30 text-red-200',
    roleUser: light ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/30 text-blue-200',
    logout: light ? 'text-gray-600 hover:text-red-600 hover:bg-red-50' : 'text-blue-200/70 hover:text-white hover:bg-white/10',
    searchBg: light ? 'bg-white border border-gray-300 text-gray-800 shadow-sm' : 'bg-white/5 backdrop-blur-xl border border-white/10 text-white placeholder:text-blue-300/50 shadow-lg',
    searchPh: light ? '' : 'placeholder:text-blue-300/50',
    card: light ? 'bg-white shadow-md border border-gray-200 hover:shadow-lg hover:border-gray-300' : 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-400/30 hover:bg-white/10',
    cardTitle: light ? 'text-gray-800' : 'text-white',
    cardDate: light ? 'text-gray-400' : 'text-blue-300/50',
    cardIconBg: light ? 'bg-blue-50 group-hover:bg-blue-100' : 'bg-blue-500/20 group-hover:bg-blue-500/30',
    cardIcon: light ? 'text-blue-500' : 'text-blue-400',
    cardArrow: light ? 'text-gray-300 group-hover:text-blue-500' : 'text-blue-400/30 group-hover:text-blue-400',
    moreBtn: light ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm' : 'bg-white/5 backdrop-blur-xl border border-white/10 text-blue-300 hover:bg-white/10 hover:border-blue-400/30 shadow-lg',
    emptyIcon: light ? 'text-gray-300' : 'text-blue-400/30',
    emptyTitle: light ? 'text-gray-600' : 'text-blue-200',
    emptyDesc: light ? 'text-gray-400' : 'text-blue-300/50',
    aiBar: light ? 'bg-gradient-to-r from-blue-100 via-slate-200 to-blue-100' : 'bg-white/5 backdrop-blur-xl border-t border-white/10',
    aiLabel: light ? 'text-blue-700 font-semibold' : 'text-blue-300',
    aiIcon: light ? 'text-sky-500' : 'text-blue-400',
    aiInput: light ? 'bg-white border-transparent text-gray-800 focus:ring-4 focus:ring-blue-600/30 focus:border-blue-400/50' : 'bg-white/5 backdrop-blur-xl border border-white/10 text-white placeholder:text-blue-300/40 focus:bg-white/10',
    aiBtn: light ? 'bg-sky-500 hover:bg-sky-600' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30',
    aiBtnDisabled: light ? 'bg-gray-300' : 'bg-white/10 text-blue-300/30',
    filterCount: light ? 'text-gray-500' : 'text-blue-300',
    filterIcon: light ? 'text-blue-500' : 'text-blue-400',
    createBtn: light ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30',
    toggleBtn: light ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-blue-300/70 hover:text-white hover:bg-white/10',
  };

  const handleSend = () => {
    if (!aiQuery.trim()) return;
    onAiSubmit(aiQuery.trim());
    setAiQuery('');
    setAiFiles([]);
  };

  const handleAiKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${t.bg}`}>
      {/* 顶部导航 — 毛玻璃悬浮 */}
      <header className={`sticky top-0 z-30 ${t.hdr}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${t.logoBg} flex items-center justify-center rounded-lg ${t.logoShadow}`}>
              <span className="text-white font-black text-xs">ZHJK</span>
            </div>
            <div>
              <h1 className={`text-lg font-bold ${t.h1Text}`}>全过程工程咨询管理服务平台</h1>
              <p className={`text-[11px] ${t.subText}`}>项目管理入口 · 全局模式 — 选择项目进入详情</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 日月切换 */}
            {/* 管理入口 */}
            <button onClick={() => { if (isAdmin) toast('管理后台功能开发中', 'info'); }}
              className={`p-2 rounded-lg transition-colors ${isAdmin ? (light ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-blue-300/70 hover:text-white hover:bg-white/10') : 'text-gray-300 cursor-not-allowed opacity-40'}`}
              title={isAdmin ? '系统管理' : '仅管理员可用'}>
              <Settings className="w-4 h-4" />
            </button>
            <span className={`flex items-center gap-1 text-sm ${t.userText}`}>
              <User className="w-4 h-4" /> {userDisplay || currentUser}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium backdrop-blur-sm ${isAdmin ? t.roleAdmin : t.roleUser}`}>
              {isAdmin ? '管理员' : userRole === 'project_manager' ? '项目经理' : userRole === 'construction_unit' ? '建设单位' : '用户'}
            </span>
            <button onClick={onLogout} className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${t.logout}`}>
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* 搜索栏 + 项目总数 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索项目名称..."
              className={`w-full pl-12 pr-4 py-3 rounded-xl text-sm 500 focus:border-blue-500 ${t.searchBg} ${t.searchPh}`}
            />
          </div>
          <div className={`flex items-center gap-2 text-sm shrink-0 ${t.filterCount}`}>
            <FolderOpen className={`w-4 h-4 ${t.filterIcon}`} />
            <span>{filtered.length} 个项目</span>
          </div>
          <button onClick={onCreateProject}
            className="flex items-center gap-1.5 px-4 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors text-sm font-medium shadow-sm shrink-0">
            <Plus className="w-4 h-4" /> 创建项目
          </button>
        </div>

        {/* 项目卡片列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {displayed.map(proj => {
            const meta = getProjectMeta(proj.name);
            const progress = getProjectProgress(proj.name);
            const pct = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 0;
            return (
            <div
              key={proj.name}
              className={`rounded-xl p-5 text-left hover:-translate-y-0.5 transition-all duration-200 group relative cursor-pointer ${t.card}`}
              onClick={() => onSelectProject(proj.name)}
            >
              {meta.alerts > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse px-1.5">
                  {meta.alerts}
                </span>
              )}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${t.cardIconBg}`}>
                      <FolderOpen className={`w-4 h-4 ${t.cardIcon}`} />
                    </div>
                    {editingProj === proj.name ? (
                      <input value={editProjName} onChange={e => setEditProjName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { onRenameProject(proj.name, editProjName); setEditingProj(''); } if (e.key === 'Escape') setEditingProj(''); }}
                        onBlur={() => { onRenameProject(proj.name, editProjName); setEditingProj(''); }}
                        onClick={e => e.stopPropagation()}
                        className={`text-sm font-semibold border-b-2 border-blue-400 bg-transparent outline-none px-1 w-40 ${light ? 'text-gray-800' : 'text-white'}`} autoFocus />
                    ) : (
                      <h3 className={`font-semibold truncate ${t.cardTitle}`}
                        onDoubleClick={e => { e.stopPropagation(); setEditingProj(proj.name); setEditProjName(proj.name); }}>
                        {proj.name}
                      </h3>
                    )}
                  </div>
                  {/* 指南模块进度 */}
                  {progress.total > 0 && (
                    <div className="ml-10 mt-1.5 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] ${light ? 'text-gray-500' : 'text-blue-300/60'}`}>指南 {progress.done}/{progress.total}</span>
                        <div className={`flex-1 h-1.5 rounded-full ${light ? 'bg-gray-200' : 'bg-white/10'}`}>
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-[10px] font-medium ${pct >= 80 ? 'text-green-500' : pct >= 40 ? 'text-blue-500' : 'text-gray-400'}`}>{pct}%</span>
                      </div>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ml-10 ${t.cardDate}`}>创建于 {proj.createdAt}</p>
                </div>
                <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-all ${t.cardArrow} mt-2`} />
              </div>
              {/* 编辑按钮（右下角隐蔽） */}
              <button onClick={e => {
                e.stopPropagation();
                setEditTarget(proj);
                const d = proj.details || {};
                setEditForm({ overview: d.overview || '', area: d.area || '', scale: d.scale || '', investment: d.investment || '', pipeline: d.pipeline || '', aiReport: d.aiReport || '', custom: d.customFields || [] });
                setProjectDocs((d.projectDocs || []).map((doc: any) => ({ fileName: doc.fileName, data: '', size: 0 })));
                setShowEditModal(true);
              }}
                className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all"
                title="编辑项目信息">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )})}
        </div>

        {/* 展开更多 */}
        {filtered.length > 10 && !showMore && (
          <div className="text-center mb-8">
            <button
              onClick={() => setShowMore(true)}
              className={`px-6 py-2 rounded-lg text-sm transition-colors ${t.moreBtn}`}
            >
              查看更多项目（共 {filtered.length} 个）
            </button>
          </div>
        )}

        {projects.length === 0 && (
          <div className="text-center py-20">
            <FolderOpen className={`w-16 h-16 mx-auto mb-4 ${t.emptyIcon}`} />
            <p className={`text-lg font-medium mb-2 ${t.emptyTitle}`}>暂无项目</p>
            <p className={`text-sm mb-4 ${t.emptyDesc}`}>创建第一个项目以开始使用全过程工程咨询管理</p>
            <button onClick={onCreateProject}
              className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors font-medium shadow-sm">
              <Plus className="w-5 h-5" /> 创建第一个项目
            </button>
          </div>
        )}
      </div>

      {/* AI 对话框 — 底端深蓝渐变毛玻璃 */}
      <div className={`backdrop-blur-xl py-4 border-t ${t.aiBar}`}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${t.aiIcon}`} />
              <span className={`text-xs font-medium ${t.aiLabel}`}>全过程工程咨询 AI 助手</span>
              <span className="text-[10px] text-gray-400">| DeepSeek v4.0 Pro</span>
            </div>
            {/* 模型选择 */}
            <div className="relative">
              <button onClick={() => setShowModelMenu(!showModelMenu)}
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${light ? 'border-gray-300 text-gray-500' : 'border-white/20 text-blue-300'}`}>
                {aiModel} <ChevronDown className="w-3 h-3" />
              </button>
              {showModelMenu && (
                <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-xl border z-50 p-1 min-w-[160px] ${light ? 'bg-white border-gray-200' : 'bg-gray-800 border-white/10'}`}>
                  {['deepseek-v4-pro', 'deepseek-v3', 'gpt-4o', 'qwen-max'].map(m => (
                    <button key={m} onClick={() => { setAiModel(m); localStorage.setItem('ai-model', m); setShowModelMenu(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-xs rounded ${aiModel === m ? (light ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300') : (light ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-300 hover:bg-white/5')}`}>
                      {m}
                    </button>
                  ))}
                  <div className={`border-t my-1 ${light ? 'border-gray-100' : 'border-white/10'}`} />
                  <button onClick={() => { setShowModelMenu(false); toast('模型通过 /login 命令配置', 'info'); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs rounded ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                    /login 配置...
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="relative">
            <textarea
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={handleAiKeyDown}
              placeholder="输入您的问题，AI 将为您提供全过程工程咨询建议..."
              rows={2}
              className={`w-full px-4 pt-3 pb-10 pr-12 rounded-xl text-sm resize-none 500 focus:border-blue-500 transition-colors ${t.aiInput}`}
            />
            {/* 底部工具栏 */}
            <div className="absolute left-3 bottom-2 flex items-center gap-3">
              {/* 上传文件/图片 */}
              <label className={`cursor-pointer p-1 rounded hover:bg-white/10 transition-colors ${light ? 'text-gray-400 hover:text-blue-500' : 'text-blue-300/60 hover:text-blue-300'}`} title="上传文件">
                <Paperclip className="w-3.5 h-3.5" />
                <input type="file" className="hidden" multiple onChange={(e) => {
                  if (e.target.files) setAiFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }} />
              </label>
              <label className={`cursor-pointer p-1 rounded hover:bg-white/10 transition-colors ${light ? 'text-gray-400 hover:text-blue-500' : 'text-blue-300/60 hover:text-blue-300'}`} title="上传图片">
                <Image className="w-3.5 h-3.5" />
                <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => {
                  if (e.target.files) setAiFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }} />
              </label>
              {/* 上下文长度 */}
              <span className={`flex items-center gap-1 text-[10px] ${light ? 'text-gray-400' : 'text-blue-300/50'}`} title={`上下文长度：${aiQuery.length} 字符`}>
                <BarChart3 className="w-3 h-3" /> {aiQuery.length > 1000 ? `${(aiQuery.length/1000).toFixed(1)}k` : aiQuery.length}
              </span>
              {/* 已选文件数 */}
              {aiFiles.length > 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] ${light ? 'text-blue-500' : 'text-blue-400'}`}>
                  <Paperclip className="w-3 h-3" /> {aiFiles.length}个文件
                </span>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!aiQuery.trim()}
              className={`absolute right-3 top-3 p-1.5 text-white rounded-lg disabled:cursor-not-allowed transition-colors ${t.aiBtn} disabled:${t.aiBtnDisabled}`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========== 项目编辑弹窗 ========== */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">编辑项目信息 — {editTarget.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* 项目概况文件上传 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">项目概况文件</label>
                  <label className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" /> 上传文件
                    <input type="file" className="hidden" multiple onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const MAX_SIZE = 10 * 1024 * 1024;
                      for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        if (f.size > MAX_SIZE) { toast(`文件"${f.name}"超过10MB限制`, 'warning'); continue; }
                        const reader = new FileReader();
                        reader.onload = () => setProjectDocs(prev => [...prev, { fileName: f.name, data: reader.result as string, size: f.size }]);
                        reader.readAsDataURL(f);
                      }
                      e.target.value = '';
                    }} accept=".pdf,.doc,.docx,.txt,.xls,.xlsx" />
                  </label>
                </div>
                {/* 已有文件列表 */}
                {projectDocs.filter(d => !d.data).length > 0 && (
                  <div className="space-y-1 mb-1">
                    {projectDocs.filter(d => !d.data).map((doc, idx) => {
                      const originalIdx = idx;
                      return (
                        <div key={`old-${originalIdx}`} className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                          <Paperclip className="w-3 h-3 text-gray-400" /> {doc.fileName}
                          <span className="text-[10px] text-gray-400">（已有文件）</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* 新上传文件列表 */}
                {projectDocs.filter(d => !!d.data).length > 0 && (
                  <div className="space-y-1">
                    {projectDocs.map((doc, idx) => {
                      if (!doc.data) return null;
                      return (
                        <div key={`new-${idx}`} className="flex items-center gap-2 text-[11px] text-gray-600 bg-blue-50 rounded px-2 py-1.5 group/att">
                          <Paperclip className="w-3 h-3 text-blue-500" /> {doc.fileName}
                          <span className="text-[10px] text-gray-400">({(doc.size / 1024).toFixed(0)}KB) · {currentUser} · {new Date().toLocaleDateString('zh-CN')}</span>
                          <button onClick={() => setProjectDocs(prev => prev.filter((_, i) => i !== idx))}
                            className="ml-auto opacity-0 group-hover/att:opacity-100 p-0.5 text-red-400 hover:text-red-600 rounded transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {projectDocs.length === 0 && (
                  <p className="text-[10px] text-gray-400 pl-0.5">上传项目概况文档后，AI 可根据文档内容自动填充下方字段</p>
                )}
              </div>

              {/* AI 按钮组 */}
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  setAiLoading(true);
                  try {
                    // 如果已上传项目文档，将文档内容加入 prompt
                    const docDescriptions = projectDocs.filter(d => !!d.data).map((d, i) => `[文件${i + 1}: ${d.fileName}]`).join('\n');
                    const promptBase = docDescriptions
                      ? `请根据以下项目概况文档的内容，提取并填写项目信息。\n\n已上传文档：\n${docDescriptions}\n\n请提取：建设规模、建筑面积、投资额、市政管线信息、项目概况摘要。用简洁格式输出，每个字段一行。项目名称："${editTarget.name}"。`
                      : `请根据项目名称"${editTarget.name}"生成项目概况。包括：建设规模、建筑面积、投资额、市政管线等信息。用简洁的表格形式输出，每个字段一行。`;
                    const reply = await api.aiChat([{ role: 'user', content: promptBase }], '', { model: 'auto' });
                    // 解析AI回复填充表单
                    const lines = reply.split('\n');
                    const form: any = { ...editForm };
                    for (const line of lines) {
                      const cleaned = line.replace(/^[-*•]\s*/, '').replace(/\*?\*(.+?)\*?\*/g, '$1');
                      if (cleaned.includes('面积')) form.area = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                      else if (cleaned.includes('规模')) form.scale = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                      else if (cleaned.includes('投资') || cleaned.includes('金额')) form.investment = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                      else if (cleaned.includes('管线') || cleaned.includes('市政')) form.pipeline = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                      else if (cleaned.includes('概况') || cleaned.includes('概述') || cleaned.includes('简介')) form.overview = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                    }
                    setEditForm(form);
                  } catch { toast('AI填充失败', 'error'); }
                  finally { setAiLoading(false); }
                }} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 text-sm font-medium disabled:opacity-50">
                  {aiLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  AI 自动填写
                </button>
                <button onClick={async () => {
                  setAiLoading(true);
                  try {
                    const reply = await api.aiChat([{ role: 'user', content: `请为项目"${editTarget.name}"生成一份专业分析报告。项目概况：${editForm.overview||'待补充'}，投资额：${editForm.investment||'待定'}。包括：风险分析、进度评估、成本优化建议、质量控制要点。输出清晰的分段报告。` }], '', { model: 'auto' });
                    setEditForm(p => ({ ...p, aiReport: reply }));
                  } catch { toast('AI分析失败', 'error'); }
                  finally { setAiLoading(false); }
                }} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 text-sm font-medium disabled:opacity-50">
                  <Sparkles className="w-4 h-4" />
                  AI 分析报告
                </button>
                {editForm.aiReport && (
                  <button onClick={() => {
                    const blob = new Blob(['\uFEFF' + editForm.aiReport], { type: 'text/plain;charset=utf-8' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = `${editTarget.name}_AI分析报告.txt`; a.click();
                  }}
                    className="flex items-center gap-1 px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">
                    <Download className="w-4 h-4" /> 下载报告
                  </button>
                )}
              </div>

              {/* 项目概况 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目概况</label>
                <textarea value={editForm.overview} onChange={e => setEditForm(p => ({ ...p, overview: e.target.value }))}
                  rows={3} placeholder="项目简介、地点、类型..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none 500" />
              </div>

              {/* 指标字段 */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'area', label: '建筑面积', placeholder: '如 50000㎡' },
                  { key: 'scale', label: '建设规模', placeholder: '如 地上20层/地下3层' },
                  { key: 'investment', label: '投资额', placeholder: '如 3.2亿元' },
                  { key: 'pipeline', label: '市政管线', placeholder: '如 给排水/电力/燃气' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <input type="text" value={(editForm as any)[field.key]} onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm 500" />
                  </div>
                ))}
              </div>

              {/* 自定义字段 */}
              {editForm.custom.map((cf, i) => (
                <div key={i} className="flex gap-2">
                  <input value={cf.key} onChange={e => {
                    const nc = [...editForm.custom]; nc[i] = { ...nc[i], key: e.target.value };
                    setEditForm(p => ({ ...p, custom: nc }));
                  }} placeholder="字段名" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input value={cf.value} onChange={e => {
                    const nc = [...editForm.custom]; nc[i] = { ...nc[i], value: e.target.value };
                    setEditForm(p => ({ ...p, custom: nc }));
                  }} placeholder="值" className="flex-[2] px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <button onClick={() => setEditForm(p => ({ ...p, custom: p.custom.filter((_, j) => j !== i) }))}
                    className="text-red-400 hover:text-red-600 px-2"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setEditForm(p => ({ ...p, custom: [...p.custom, { key: '', value: '' }] }))}
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> 添加自定义字段
              </button>

              {/* AI 报告 */}
              {editForm.aiReport && (
                <div className="p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-purple-700">AI 分析报告</span>
                    <span className="text-[10px] text-purple-400">可编辑</span>
                  </div>
                  <textarea value={editForm.aiReport} onChange={e => setEditForm(p => ({ ...p, aiReport: e.target.value }))}
                    rows={8} className="w-full px-4 py-2.5 border border-purple-100 rounded-xl text-sm resize-none bg-white" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">取消</button>
              <button onClick={() => {
                // 合并新上传文档到已有文档
                const existingDocs = editTarget.details?.projectDocs || [];
                const newDocs = projectDocs.filter(d => !!d.data).map(d => ({
                  fileName: d.fileName, uploader: currentUser,
                  uploadTime: new Date().toLocaleString('zh-CN'), data: d.data,
                }));
                onUpdateProject(editTarget.name, {
                  ...editForm,
                  aiReportTime: editForm.aiReport ? new Date().toLocaleString('zh-CN') : editTarget.details?.aiReportTime,
                  projectDocs: [...existingDocs, ...newDocs],
                });
                setShowEditModal(false);
              }}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectEntryPage;
