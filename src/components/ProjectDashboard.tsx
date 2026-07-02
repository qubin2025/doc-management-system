import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderOpen, BarChart3, Users, FileText, Clock, ArrowRight, LogOut, User, Shield, Sparkles, ChevronRight, ChevronDown, Building2, DollarSign, ClipboardCheck, Truck, BookOpen, GitBranch, MessageSquare, Wrench, FileCheck, FileSearch, PenTool, Settings } from 'lucide-react';
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
  { id: 'project-entry', label: '项目创建', icon: FolderOpen, desc: '新建工作空间和项目' },
  { type: 'divider' },
  { id: 'plan-manager', label: '计划管理', icon: Clock },
  { id: 'safety-inspection', label: '安全管理', icon: Shield },
  { id: 'cost', label: '成本管理', icon: DollarSign },
  { id: 'analysis', label: '质量管理', icon: ClipboardCheck },
  { id: 'supplier', label: '供应商管理', icon: Truck },
  { type: 'divider' },
  { id: 'homepage', label: '工程资料管理', icon: Building2, desc: 'DB11/T695 & T808' },
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newWorkspace, setNewWorkspace] = useState('全过程工程咨询服务');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

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

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const created = await api.createProject(newProjectName.trim(), newWorkspace, selectedCards);
      const list = await api.fetchProjects();
      setProjects(Array.isArray(list) ? list : []);
      setNewProjectName(''); setSelectedCards([]);
      setShowCreateDialog(false);
      // 导航到新项目
      // 创建后直接进入工程资料管理页
      onNavigate('homepage', newProjectName.trim());
    } catch { setShowCreateDialog(false); }
  };

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

      {/* ===== 项目列表(按工作空间分组) ===== */}
      {(() => {
        // 分组逻辑
        const workspaces = [...new Set(filtered.map((p: any) => p.workspace || '默认'))];
        const grouped: Record<string, any[]> = {};
        workspaces.forEach(ws => {
          grouped[ws] = filtered.filter((p: any) => (p.workspace || '默认') === ws);
        });

        return workspaces.map(ws => (
          <div key={ws} className="rounded-xl border overflow-hidden mb-4" style={{ background: C.surface, borderColor: C.border }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" style={{ color: C.primary }} />
                <h2 className="font-semibold text-sm" style={{ color: C.text }}>{ws}</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.primaryBg, color: C.primary }}>{grouped[ws].length}</span>
              </div>
            </div>
            {grouped[ws].map((proj: any) => (
              <div key={proj.name || proj.id} onClick={() => onNavigate('homepage', proj.name)}
                className="flex items-center justify-between px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50 border-b last:border-0" style={{ borderColor: C.border }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg }}>
                    <FolderOpen className="w-4 h-4" style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: C.text }}>{proj.name}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(proj.cards || []).slice(0, 4).map((c: string) => (
                        <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{c}</span>
                      ))}
                      {proj.createdAt && <span className="text-[10px] text-gray-400 ml-1">{proj.createdAt}</span>}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4" style={{ color: C.muted }} />
              </div>
            ))}
          </div>
        ));
      })()}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ background: C.surface, borderColor: C.border }}>
          <FolderOpen className="w-8 h-8 mx-auto mb-2" style={{ color: C.muted, opacity: 0.4 }} />
          <p className="text-sm text-gray-500">暂无项目</p>
          <p className="text-xs text-gray-400 mt-1">点击右上角「新建」创建第一个项目</p>
        </div>
      )}

      {loading && <div className="text-center text-xs py-8" style={{ color: C.muted }}>加载中...</div>}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
      {/* Header — 横贯整个顶部 */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-300 shadow-sm shrink-0">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-10 h-10 rounded-lg object-contain" alt="Logo" />
            <div>
              <h1 className="text-lg font-bold text-gray-800">全过程工程咨询管理服务平台</h1>
              <p className="text-[11px] text-gray-400">项目管理仪表盘 · {stats.projects}个项目</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('admin')} className="p-2 rounded-lg transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100" title="管理后台">
              <Settings className="w-4 h-4" />
            </button>
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <User className="w-4 h-4" /> {currentUser?.username || 'admin'}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium backdrop-blur-sm ${currentUser?.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {currentUser?.role === 'admin' ? '管理员' : '用户'}
            </span>
            <button onClick={() => { try { api.logout(); } catch {} onLogout(); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors text-gray-600 hover:text-red-600 hover:bg-red-50">
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
        </div>
      </header>

      {/* 下方区域: 侧边栏 + 内容 */}
      <div className="flex flex-1">
      {/* ===== 左侧边栏 ===== */}
      <aside className="flex flex-col border-r transition-all duration-200 shrink-0" style={{
        width: sidebarCollapsed ? 64 : 224,
        background: C.sidebar,
        borderColor: C.border,
      }}>

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
                      {child.desc && <span className="text-[11px]" style={{ color: C.muted }}>{child.desc}</span>}
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
            className="w-full flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg transition-colors hover:bg-white/50"
            style={{ color: C.muted }}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            {!sidebarCollapsed && '折叠'}
          </button>
        </div>
      </aside>

      {/* ===== 右侧内容区 ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
      </div>

      {/* ===== 新建项目弹窗 ===== */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderColor: C.border }}>
            <div className="px-6 py-5 border-b" style={{ borderColor: C.border }}>
              <h3 className="font-semibold text-gray-800">新建项目</h3>
              <p className="text-xs text-gray-500 mt-1">选择工作空间，填写项目名称，勾选需要的功能卡片</p>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 工作空间下拉 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">工作空间（项目集）</label>
                <select value={newWorkspace} onChange={e => setNewWorkspace(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: C.border }}>
                  {['全过程工程咨询服务', '施工管理项目', '项目管理项目', '规划设计项目', '造价咨询项目', '招标代理项目'].map(ws => (
                    <option key={ws} value={ws}>{ws}</option>
                  ))}
                </select>
              </div>
              {/* 项目名称 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">项目名称</label>
                <input autoFocus value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                  placeholder="如：小红门调水干线工程"
                  className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none"
                  style={{ borderColor: C.border, color: C.text }}
                  onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = `0 0 0 2px ${C.primary}15`; }}
                  onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}/>
              </div>
              {/* 功能卡片勾选 */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">功能卡片（可多选）</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'doc-mgmt', label: '工程资料管理', desc: 'DB11/T695 & T808' },
                    { id: 'safety', label: '安全巡检', desc: 'GLM-5V对标JGJ59' },
                    { id: 'review', label: '施工组织设计审查', desc: 'AI逐章审查' },
                    { id: 'contract', label: '合同审查', desc: '8类风险条款' },
                    { id: 'bid', label: '招投标审查', desc: '7要素合规检查' },
                    { id: 'plan-gen', label: 'AI方案生成', desc: '7种模板' },
                    { id: 'kg', label: '知识图谱', desc: '15种节点3D可视化' },
                    { id: 'kb', label: '知识库', desc: '全文+语义+混合检索' },
                  ].map(card => (
                    <label key={card.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedCards.includes(card.id) ? 'border-[#8f482f] bg-[#ffdbd0]/30' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input type="checkbox" checked={selectedCards.includes(card.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedCards(prev => [...prev, card.id]);
                          else setSelectedCards(prev => prev.filter(c => c !== card.id));
                        }}
                        className="mt-0.5 accent-[#8f482f]" />
                      <div>
                        <p className="text-xs font-medium text-gray-700">{card.label}</p>
                        <p className="text-[10px] text-gray-400">{card.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowCreateDialog(false); setSelectedCards([]); }}
                  className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-500">取消</button>
                <button onClick={handleCreateProject} disabled={!newProjectName.trim()}
                  className="px-6 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50" style={{ background: C.primary }}>
                  创建项目
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
