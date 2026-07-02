import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderOpen, BarChart3, Users, FileText, Clock, ArrowRight, LogOut, User, Shield, Sparkles, ChevronRight, ChevronDown, Building2, DollarSign, ClipboardCheck, Truck, BookOpen, GitBranch, MessageSquare, Wrench, FileCheck, FileSearch, PenTool } from 'lucide-react';
import * as api from '../data/api';
import { ProjectInfo } from '../types';

interface Props {
  onNavigate: (view: string, project?: string) => void;
  onLogout: () => void;
  currentUser?: { username: string; role: string };
}

// PMOK60630 颜色常量
const C = {
  primary: '#8f482f', primaryBg: '#ffdbd0',
  surface: '#ffffff', bg: '#f6f8fa',
  text: '#111827', textVar: '#374151', muted: '#6b7280',
  border: '#dde3ea', sidebar: '#f1f4f7',
  sidebarHover: '#ffffffc7', sidebarActive: '#fffffff0', sidebarActiveBorder: '#8f482f29',
  danger: '#b42318', dangerBg: '#fee4e2',
  info: '#2d628f', infoBg: '#d9ecff',
  success: '#4f6237', successBg: '#dcfae6',
  warning: '#b54708', warningBg: '#fef0c7',
};

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: '仪表盘', icon: BarChart3 },
  { id: 'project-list', label: '项目列表', icon: FolderOpen },
  { id: 'plan-manager', label: '计划管理', icon: Clock },
  { id: 'safety-inspection', label: '安全管理', icon: Shield },
  { id: 'cost', label: '成本管理', icon: DollarSign },
  { type: 'divider' },
  { id: 'analysis', label: '质量管理', icon: ClipboardCheck },
  { id: 'supplier', label: '供应商管理', icon: Truck },
  { type: 'divider' },
  { id: 'eng-docs', label: '工程资料管理', icon: Building2, children: [
    { id: 'project-entry', label: '土建资料', desc: 'DB11/T695-2025', icon: Building2 },
    { id: 'project-entry', label: '市政资料', desc: 'DB11/T808-2020', icon: Building2 },
  ]},
  { id: 'knowledge-graph', label: '知识图谱', icon: GitBranch },
  { id: 'knowledge-base', label: '知识库', icon: BookOpen },
  { type: 'divider' },
  { id: 'ai-chat', label: '沟通管理', icon: MessageSquare },
  { id: 'tools', label: '项目工具', icon: Wrench, children: [
    { id: 'analysis', label: '智能分析', icon: Sparkles },
    { id: 'construction-review', label: '施工组织设计审查', icon: FileCheck },
    { id: 'contract-review', label: '合同审查', icon: FileSearch },
    { id: 'plan-generator', label: 'AI方案生成', icon: PenTool },
    { id: 'bid-review', label: '招投标文件审查', icon: FileText },
  ]},
];

const ProjectDashboard: React.FC<Props> = ({ onNavigate, onLogout, currentUser }) => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [stats, setStats] = useState({ projects: 0, documents: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMenus, setExpandedMenus] = useState<Record<string,boolean>>({ 'eng-docs': true, 'tools': true });
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  const toggleMenu = (id: string) => setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));

  const renderContent = () => (
    <div>
      {/* ===== 统计卡片 ===== */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { icon: FolderOpen, label: '项目总数', value: stats.projects, color: C.primary, bg: C.primaryBg },
          { icon: FileText, label: '文档总数', value: stats.documents, color: C.info, bg: C.infoBg },
          { icon: Users, label: '系统用户', value: stats.users, color: C.success, bg: C.successBg },
          { icon: Clock, label: '活跃项目', value: projects.length, color: C.warning, bg: C.warningBg },
        ].map((card, i) => (
          <div key={i} className="rounded-xl p-4 border" style={{ background: C.surface, borderColor: C.border }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                <card.icon className="w-4.5 h-4.5" style={{ color: card.color }} />
              </div>
              <div>
                <p className="text-[11px]" style={{ color: C.textVar }}>{card.label}</p>
                <p className="text-xl font-bold" style={{ color: C.text }}>{loading ? '-' : card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== 快捷入口 ===== */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[
          { icon: FolderOpen, label: '项目资料', view: 'project-entry', color: C.primary, bg: C.primaryBg },
          { icon: Shield, label: '安全巡检', view: 'safety-inspection', color: C.danger, bg: C.dangerBg },
          { icon: Sparkles, label: 'AI 助手', view: 'ai-chat', color: C.info, bg: C.infoBg },
          { icon: BarChart3, label: '管理后台', view: 'admin', color: C.success, bg: C.successBg },
        ].map((item, i) => (
          <button key={i} onClick={() => onNavigate(item.view)}
            className="rounded-xl p-3.5 text-left border transition-all hover:-translate-y-0.5 hover:shadow-sm"
            style={{ background: C.surface, borderColor: C.border }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: item.bg }}>
              <item.icon className="w-4 h-4" style={{ color: item.color }} />
            </div>
            <h3 className="font-semibold text-xs" style={{ color: C.text }}>{item.label}</h3>
          </button>
        ))}
      </div>

      {/* ===== 项目列表 ===== */}
      <div className="rounded-xl border overflow-hidden" style={{ background: C.surface, borderColor: C.border }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: C.border }}>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: C.text }}>全部项目</h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.textVar }}>{filtered.length} 个项目</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索项目..." className="pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none transition-colors"
                style={{ borderColor: C.border, color: C.text, background: C.surface, width: 180 }}
                onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = `0 0 0 2px ${C.primary}15`; }}
                onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}/>
            </div>
            <button onClick={() => onNavigate('project-entry')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
              style={{ background: C.primary }}><Plus className="w-3.5 h-3.5"/> 新建</button>
          </div>
        </div>
        {loading ? <div className="px-5 py-10 text-center text-xs" style={{ color: C.muted }}>加载中...</div>
        : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FolderOpen className="w-8 h-8 mx-auto mb-2" style={{ color: C.muted, opacity: 0.4 }} />
            <p className="text-sm" style={{ color: C.textVar }}>{searchQuery ? '未找到匹配' : '暂无项目'}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: C.border }}>
            {filtered.map((proj: any) => (
              <div key={proj.name || proj.id} onClick={() => onNavigate('project-entry', proj.name)}
                className="flex items-center justify-between px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg }}>
                    <FolderOpen className="w-4 h-4" style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: C.text }}>{proj.name}</p>
                    <p className="text-[10px]" style={{ color: C.textVar }}>
                      {proj.createdAt || proj.created_at || '—'}
                      {proj.details?.scale ? ` · ${proj.details.scale}` : ''}
                      {proj.details?.investment ? ` · ${proj.details.investment}` : ''}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4" style={{ color: C.muted }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: C.bg }}>
      {/* ===== 左侧边栏 ===== */}
      <aside className="flex flex-col border-r transition-all duration-200 shrink-0" style={{
        width: sidebarCollapsed ? 64 : 224,
        background: C.sidebar,
        borderColor: C.border,
      }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b shrink-0" style={{ borderColor: C.border }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.primary }}>
            <span className="text-white font-black text-[10px]">PM</span>
          </div>
          {!sidebarCollapsed && <span className="font-bold text-sm" style={{ color: C.text }}>项目管理</span>}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item, i) => {
            if (item.type === 'divider') return <div key={i} className="mx-3 my-1.5 border-t" style={{ borderColor: C.border }} />;

            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const hasChildren = !!item.children;
            const isExpanded = expandedMenus[item.id];

            return (
              <div key={item.id}>
                <button onClick={() => {
                  setActiveNav(item.id);
                  if (hasChildren) toggleMenu(item.id);
                  else onNavigate(item.id);
                }}
                className="w-full flex items-center gap-2.5 px-4 rounded-none text-left transition-colors text-sm"
                style={{
                  height: 40, fontWeight: isActive ? 600 : 400,
                  color: isActive ? C.primary : C.text,
                  background: isActive ? C.sidebarActive : 'transparent',
                  borderLeft: isActive ? `3px solid ${C.primary}` : '3px solid transparent',
                }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? C.primary : C.muted }} />
                {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!sidebarCollapsed && hasChildren && (isExpanded ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>)}
              </button>
              {hasChildren && isExpanded && !sidebarCollapsed && (
                <div className="ml-4 mr-0 mt-0.5 space-y-0.5">
                  {item.children!.map(child => (
                    <button key={child.id + child.label} onClick={() => onNavigate(child.id)}
                      className="w-full flex items-center gap-2 pl-10 pr-3 py-1.5 rounded-none text-[13px] transition-colors hover:bg-white/50"
                      style={{ color: C.text }}>
                      {child.icon && <child.icon className="w-3.5 h-3.5" style={{ color: C.muted }}/>}
                      <span className="flex-1 truncate">{child.label}</span>
                      {child.desc && <span className="text-[10px]" className="text-[11px]" style={{ color: C.muted }}>{child.desc}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </nav>

        {/* 底部折叠按钮 */}
        <div className="border-t px-3 py-2.5" style={{ borderColor: C.border }}>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-lg transition-colors hover:bg-white/50"
            style={{ color: C.muted }}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            {!sidebarCollapsed && '折叠'}
          </button>
          <button onClick={() => { try { api.logout(); } catch {} onLogout(); }}
            className="w-full flex items-center justify-center gap-1 text-[10px] py-1.5 mt-1 rounded-lg transition-colors hover:bg-white/50"
            style={{ color: C.muted }}>
            <LogOut className="w-3.5 h-3.5"/>
            {!sidebarCollapsed && '退出'}
          </button>
        </div>
      </aside>

      {/* ===== 右侧内容区 ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b shrink-0" style={{ height: 48, background: C.surface, borderColor: C.border }}>
          <div className="h-full px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-sm" style={{ color: C.text }}>
                {SIDEBAR_ITEMS.find(i => i.id === activeNav && i.type !== 'divider')?.label || '仪表盘'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs" style={{ color: C.textVar }}>
                <User className="w-3.5 h-3.5 inline mr-1" />
                {currentUser?.username || 'admin'}
                <span className="mx-1.5" style={{ color: C.muted }}>|</span>
                <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: C.bg, color: C.textVar }}>
                  {currentUser?.role === 'admin' ? '管理员' : '用户'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
