
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User, Node, Link, AuditLogEntry, Role, RelationType, ThemeType } from './types';
import { initialNodes, initialLinks, initialLogs } from './data/initialData';
import { 
  Settings, 
  History, 
  Database,
  Cpu,
  Languages,
  X,
  ChevronUp,
  Palette,
  AlertTriangle,
  Download,
  LogOut,
  Menu,
  Save,
  Edit2,
  ChevronLeft,
  RotateCcw,
  Phone,
  Users as UsersIcon
} from 'lucide-react';
import RelationshipGraph from './components/RelationshipGraph';
import SearchSidebar from './components/SearchSidebar';
import AdminPanel from './components/AdminPanel';
import AuditLogView from './components/AuditLogView';
import Login from './components/Login';
import { translations, Language } from './i18n';

const APP_VERSION = '1.1.8';

// 预设超级管理员信息 - 用于开发阶段
const INITIAL_USERS: User[] = [
  { id: 'sa-1', phone: '13051248370', name: '超级管理员', role: 'SUPER_ADMIN', createdAt: Date.now() }
];

const App: React.FC = () => {
  // --- Persistence Helpers ---
  const loadState = <T,>(key: string, defaultValue: T): T => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  };

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadState('current_user', null));
  const [allUsers, setAllUsers] = useState<User[]>(() => loadState('authorized_users', INITIAL_USERS));
  const [nodes, setNodes] = useState<Node[]>(() => loadState('nodes', initialNodes));
  const [links, setLinks] = useState<Link[]>(() => loadState('links', initialLinks));
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => loadState('logs', initialLogs));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'admin' | 'logs'>('graph');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [lang, setLang] = useState<Language>('zh');
  const [theme, setTheme] = useState<ThemeType>('space');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showUpdateWarning, setShowUpdateWarning] = useState(false);

  // Editing state for the bio overlay
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editingBioText, setEditingBioText] = useState('');

  const t = translations[lang];

  // --- Persistence Effects ---
  useEffect(() => localStorage.setItem('nodes', JSON.stringify(nodes)), [nodes]);
  useEffect(() => localStorage.setItem('links', JSON.stringify(links)), [links]);
  useEffect(() => localStorage.setItem('logs', JSON.stringify(logs)), [logs]);
  useEffect(() => localStorage.setItem('authorized_users', JSON.stringify(allUsers)), [allUsers]);
  useEffect(() => localStorage.setItem('current_user', JSON.stringify(currentUser)), [currentUser]);

  // Version Check
  useEffect(() => {
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion && lastVersion !== APP_VERSION) {
      setShowUpdateWarning(true);
    }
    localStorage.setItem('app_version', APP_VERSION);
  }, []);

  // Sync editing text when selected node changes
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
        setEditingBioText(node.bio);
        setIsEditingBio(false);
      }
    }
  }, [selectedNodeId, nodes]);

  // --- Handlers ---
  const addLog = useCallback((action: AuditLogEntry['action'], details: string) => {
    const newLog: AuditLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      userId: currentUser?.id || 'system',
      userName: currentUser?.name || 'System',
      action,
      details
    };
    setLogs(prev => [newLog, ...prev]);
  }, [currentUser]);

  const handleLogin = (phone: string, code: string) => {
    if (code !== '666666') {
      alert(lang === 'zh' ? "验证码错误，请输入 666666" : "Invalid verification code. Please use 666666");
      return;
    }

    const user = allUsers.find(u => u.phone === phone);
    if (user) {
      setCurrentUser(user);
      addLog('AUTH_LOGIN', `用户已登录: ${user.name} (${user.role})`);
    } else {
      alert(lang === 'zh' ? "该手机号未授权，请联系管理员。" : "Unauthorized phone number. Contact admin.");
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      addLog('AUTH_LOGOUT', `用户登出: ${currentUser.name}`);
    }
    setCurrentUser(null);
  };

  const handleAddNode = (newNode: Omit<Node, 'id' | 'createdBy'>) => {
    if (!currentUser) return;
    const node: Node = {
      ...newNode,
      id: Math.random().toString(36).substr(2, 9),
      createdBy: currentUser.id
    };
    setNodes(prev => [...prev, node]);
    addLog('ADD_NODE', `添加人物: ${node.name}`);
  };

  const handleUpdateNode = (id: string, updates: Partial<Node>) => {
    if (!currentUser) return;
    const oldNode = nodes.find(n => n.id === id);
    if (!oldNode) return;

    // Permissions check: Super Admin or Creator
    const canUpdate = currentUser.role === 'SUPER_ADMIN' || oldNode.createdBy === currentUser.id;
    if (!canUpdate) {
      alert(lang === 'zh' ? "权限不足。您只能修改自己创建的人物。" : "Permission denied. You can only update your own creations.");
      return;
    }

    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    
    // Log details
    const changes = Object.entries(updates).map(([key, value]) => `${key}: ${oldNode[key as keyof Node]} -> ${value}`).join(', ');
    addLog('UPDATE_NODE', `更新人物 ${oldNode.name} (${id}) - 修改项: [${changes}]`);
  };

  const handleDeleteNode = (id: string) => {
    if (!currentUser) return;
    const nodeToDelete = nodes.find(n => n.id === id);
    if (!nodeToDelete) return;
    
    const canDelete = currentUser.role === 'SUPER_ADMIN' || nodeToDelete.createdBy === currentUser.id;
    if (!canDelete) {
      alert(lang === 'zh' ? "权限不足。您只能删除自己创建的人物。" : "Permission denied. You can only delete your own creations.");
      return;
    }

    setNodes(prev => prev.filter(n => n.id !== id));
    setLinks(prev => prev.filter(l => l.source !== id && l.target !== id));
    addLog('DELETE_NODE', `删除人物: ${nodeToDelete.name}`);
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleAddLink = (newLink: Omit<Link, 'id' | 'createdBy'>) => {
    if (!currentUser) return;
    const link: Link = {
      ...newLink,
      id: Math.random().toString(36).substr(2, 9),
      createdBy: currentUser.id
    };
    setLinks(prev => [...prev, link]);
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    addLog('ADD_LINK', `建立关系: ${sourceNode?.name} -> ${targetNode?.name} (${link.type})`);
  };

  const handleAddUser = (user: Omit<User, 'id' | 'createdAt'>) => {
    if (!currentUser) return;
    const newUser: User = {
      ...user,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now()
    };
    setAllUsers(prev => [...prev, newUser]);
    addLog('USER_CREATE', `创建用户: ${newUser.name} 权限: ${newUser.role}`);
  };

  const handleDeleteUser = (id: string) => {
    if (!currentUser) return;
    const target = allUsers.find(u => u.id === id);
    if (!target) return;
    if (target.role === 'SUPER_ADMIN') {
      alert(lang === 'zh' ? "无法删除超级管理员。" : "Cannot delete Super Admin.");
      return;
    }
    setAllUsers(prev => prev.filter(u => u.id !== id));
    addLog('USER_DELETE', `删除用户: ${target.name}`);
  };

  const handleTransferSuperAdmin = (targetId: string) => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
    
    const targetUser = allUsers.find(u => u.id === targetId);
    if (!targetUser) return;

    if (!window.confirm(t.transferSADesc)) return;

    const updatedUsers = allUsers.map(u => {
      if (u.id === currentUser.id) return { ...u, role: 'ADMIN' as Role };
      if (u.id === targetId) return { ...u, role: 'SUPER_ADMIN' as Role };
      return u;
    });

    setAllUsers(updatedUsers);
    
    const updatedSelf = updatedUsers.find(u => u.id === currentUser.id);
    if (updatedSelf) setCurrentUser(updatedSelf);

    addLog('USER_CREATE', `超级管理员权限已从 ${currentUser.name} 转让给 ${targetUser.name}`);
    alert(lang === 'zh' ? "权限转让成功。您现在的身份是：管理员" : "Status transferred. You are now an Administrator.");
  };

  const handleExport = () => {
    const nodeHeader = "ID,Name,Phone,Weight,Category,Org,Pos,Title,Bio,CreatedBy\n";
    const nodeRows = nodes.map(n => `"${n.id}","${n.name}","${n.phone || ''}",${n.weight},"${n.category}","${n.organization || ''}","${n.position || ''}","${n.title || ''}","${n.bio.replace(/"/g, '""')}","${n.createdBy}"`).join("\n");
    const linkHeader = "\n\nSourceID,TargetID,Type,Strength,CreatedBy\n";
    const linkRows = links.map(l => `"${l.source}","${l.target}","${l.type}",${l.strength},"${l.createdBy}"`).join("\n");
    
    const blob = new Blob(["\uFEFF" + nodeHeader + nodeRows + linkHeader + linkRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Nexus3D_数据备份_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog('EXPORT_DATA', '导出完整数据备份 (CSV/Excel 格式)。');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const sections = text.split("\n\n");
        const nodeLines = sections[0].split("\n").slice(1);
        const linkLines = sections[1].split("\n").slice(1);

        const newNodes: Node[] = nodeLines.filter(l => l.trim()).map(line => {
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(p => p.replace(/^"|"$/g, '')) || [];
          return { 
            id: parts[0], 
            name: parts[1], 
            phone: parts[2],
            weight: parseInt(parts[3]), 
            category: parts[4], 
            organization: parts[5], 
            position: parts[6], 
            title: parts[7], 
            bio: parts[8], 
            createdBy: parts[9] 
          };
        });

        const newLinks: Link[] = linkLines.filter(l => l.trim()).map((line, i) => {
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(p => p.replace(/^"|"$/g, '')) || [];
          return { id: `imp-${i}`, source: parts[0], target: parts[1], type: parts[2] as RelationType, strength: parseInt(parts[3]), createdBy: parts[4] };
        });

        if (newNodes.length > 0) {
          setNodes(newNodes);
          setLinks(newLinks);
          addLog('IMPORT_DATA', `导入成功：${newNodes.length} 个节点和 ${newLinks.length} 条关系。`);
          alert(t.importSuccess);
        }
      } catch (err) {
        console.error(err);
        alert(t.importError);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm(lang === 'zh' ? '确定要重置所有系统数据吗？此操作不可逆。' : 'Are you sure you want to reset all system data? This cannot be undone.')) {
      setNodes(initialNodes);
      setLinks(initialLinks);
      setLogs(initialLogs);
      addLog('VERSION_UPDATE', '系统数据已手动重置为初始状态。');
      setActiveTab('graph');
    }
  };

  const toggleLang = () => setLang(prev => prev === 'en' ? 'zh' : 'en');

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    return nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [nodes, searchQuery]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  if (!currentUser) {
    return <Login onLogin={handleLogin} t={t} />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-100 overflow-hidden font-sans flex-col md:flex-row relative">
      
      {showUpdateWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-gray-900 border border-amber-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4 text-amber-500 mb-4">
              <AlertTriangle size={48} />
              <h2 className="text-2xl font-bold uppercase tracking-tight">安全备份提醒</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-8">
              {t.backupWarning}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleExport}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition-all"
              >
                <Download size={20} /> {t.exportBtn}
              </button>
              <button 
                onClick={() => { setShowUpdateWarning(false); addLog('VERSION_UPDATE', `确认版本 ${APP_VERSION} 更新并已手动备份。`); }}
                className="py-3 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                {t.backupAck}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={`hidden md:flex flex-col bg-gray-900/40 backdrop-blur-md border-r border-gray-800/50 transition-all duration-300 z-50 print:hidden ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-gray-800/50">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Cpu className="text-white" size={24} />
          </div>
          {isSidebarOpen && <h1 className="text-xl font-bold tracking-tight">{t.appTitle}<span className="text-indigo-500">3D</span></h1>}
        </div>

        <div className="flex-1 py-6 flex flex-col gap-2">
          {[
            { id: 'graph', icon: Database, label: t.navGraph },
            { id: 'admin', icon: Settings, label: t.navAdmin },
            { id: 'logs', icon: History, label: t.navLogs }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 px-6 py-3 transition-colors ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-400 border-r-2 border-indigo-500' : 'hover:bg-gray-800 text-gray-400'}`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="p-4 mt-auto border-t border-gray-800/50 space-y-2">
          <div className="relative">
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="w-full flex items-center justify-between gap-2 py-2 px-3 text-xs bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-indigo-400" />
                {isSidebarOpen && <span>{t.themeLabel}</span>}
              </div>
              {isSidebarOpen && <ChevronUp size={12} className={`transition-transform ${showThemePicker ? 'rotate-180' : ''}`} />}
            </button>
            {showThemePicker && isSidebarOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-gray-900/60 backdrop-blur-md border border-gray-700/50 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                {(['dusk', 'starlight', 'dawn', 'space', 'moonlight'] as ThemeType[]).map(th => (
                  <button 
                    key={th}
                    onClick={() => { setTheme(th); setShowThemePicker(false); }}
                    className={`w-full text-left px-4 py-2 text-[10px] hover:bg-gray-700 transition-colors uppercase font-bold tracking-wider ${theme === th ? 'text-indigo-400 bg-indigo-400/5' : 'text-gray-400'}`}
                  >
                    {t.themes[th]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleLang} className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-indigo-900/20 text-indigo-300 rounded-md border border-indigo-500/30">
            <Languages size={14} />
            {isSidebarOpen && <span>{t.langLabel}</span>}
          </button>
          
          <div className={`flex items-center gap-3 py-2 ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-indigo-600`}>
              {currentUser.name[0]}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold truncate">{currentUser.name}</p>
                <p className="text-[9px] text-gray-500 uppercase font-black truncate tracking-tighter">{t.roles[currentUser.role]}</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-red-900/10 text-red-500 hover:bg-red-900/20 rounded-md transition-colors border border-red-500/20">
            <LogOut size={14} />
            {isSidebarOpen && <span className="font-bold">{t.switchRole}</span>}
          </button>
        </div>
      </nav>

      <main className="flex-1 relative overflow-hidden bg-gray-950">
        {/* Background 3D Graph - Always persists to avoid obscuring context */}
        <div className="absolute inset-0 z-0 print:hidden">
          <RelationshipGraph 
            nodes={nodes} 
            links={links} 
            selectedNodeId={selectedNodeId}
            onNodeClick={(node) => setSelectedNodeId(node.id)}
            theme={theme}
            t={t}
          />
        </div>

        {/* Overlay Search & Details */}
        {activeTab === 'graph' && (
          <div className="absolute inset-0 z-10 pointer-events-none print:hidden">
            <div className="absolute top-4 left-4 right-4 md:left-6 md:top-6 md:w-80 pointer-events-auto">
              <SearchSidebar 
                searchQuery={searchQuery} 
                setSearchQuery={setSearchQuery} 
                nodes={filteredNodes}
                onSelectNode={setSelectedNodeId}
                t={t}
              />
            </div>

            {/* Total Population Counter Overlay */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-gray-900/40 backdrop-blur-2xl border border-white/5 px-4 py-2.5 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-500 pointer-events-auto flex items-center gap-3">
              <div className="bg-indigo-600/20 p-1.5 rounded-lg">
                <UsersIcon size={16} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{t.totalPeople}</p>
                <p className="text-lg font-black text-white leading-none">{nodes.length}</p>
              </div>
            </div>

            {selectedNode && (
              <div className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-24 md:right-6 md:w-80 bg-gray-900/30 backdrop-blur-3xl border-t md:border border-gray-800/20 rounded-t-3xl md:rounded-xl p-6 shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-300 pointer-events-auto">
                <div className="w-12 h-1 bg-gray-700/40 rounded-full mx-auto mb-4 md:hidden" />
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">{t.nodeDetails}</h3>
                  <button onClick={() => setSelectedNodeId(null)} className="text-gray-500 hover:text-white p-1">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4 max-h-[35vh] md:max-h-[60vh] overflow-y-auto">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-indigo-400 font-semibold text-xl">{selectedNode.name}</h4>
                      <p className="text-xs text-gray-400 uppercase tracking-tighter">
                        {t.categories[selectedNode.category as keyof typeof t.categories] || selectedNode.category}
                      </p>
                    </div>
                    {(currentUser.role === 'SUPER_ADMIN' || selectedNode.createdBy === currentUser.id) && (
                      <button 
                        onClick={() => {
                          if (isEditingBio) {
                            handleUpdateNode(selectedNode.id, { bio: editingBioText });
                            setIsEditingBio(false);
                          } else {
                            setIsEditingBio(true);
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors ${isEditingBio ? 'bg-green-600/60 text-white hover:bg-green-500' : 'bg-gray-800/40 text-gray-400 hover:text-indigo-400'}`}
                        title={isEditingBio ? t.saveChanges : t.editNode}
                      >
                        {isEditingBio ? <Save size={18} /> : <Edit2 size={18} />}
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 border-l-2 border-white/5 pl-3 py-1">
                    {selectedNode.phone && (
                      <p className="text-xs text-indigo-400 font-bold flex items-center gap-2">
                        <Phone size={12} />
                        {selectedNode.phone}
                      </p>
                    )}
                    {selectedNode.organization && (
                      <p className="text-xs text-gray-300 font-medium">
                        <span className="text-gray-500 mr-2 uppercase tracking-tighter">{t.orgLabel}:</span>
                        {selectedNode.organization}
                      </p>
                    )}
                    {selectedNode.position && (
                      <p className="text-xs text-gray-300">
                        <span className="text-gray-500 mr-2 uppercase tracking-tighter">{t.posLabel}:</span>
                        {selectedNode.position}
                      </p>
                    )}
                    {selectedNode.title && (
                      <p className="text-xs text-indigo-300 italic">
                        <span className="text-gray-500 mr-2 uppercase tracking-tighter not-italic">{t.titleLabel}:</span>
                        {selectedNode.title}
                      </p>
                    )}
                  </div>

                  {isEditingBio ? (
                    <div className="space-y-2">
                      <textarea 
                        value={editingBioText}
                        onChange={(e) => setEditingBioText(e.target.value)}
                        className="w-full bg-gray-800/50 border border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-gray-100 outline-none min-h-[100px] resize-none focus:ring-1 focus:ring-indigo-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            handleUpdateNode(selectedNode.id, { bio: editingBioText });
                            setIsEditingBio(false);
                          }}
                          className="flex-1 bg-indigo-600/70 py-2 rounded-lg text-xs font-bold hover:bg-indigo-500 transition-colors"
                        >
                          {t.saveChanges}
                        </button>
                        <button 
                          onClick={() => setIsEditingBio(false)}
                          className="px-4 bg-gray-800/30 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-colors"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 leading-relaxed italic border-l-2 border-indigo-500/40 pl-3">
                      "{selectedNode.bio}"
                    </p>
                  )}

                  <div className="pt-4 border-t border-gray-800/20">
                    <h5 className="text-xs font-bold text-gray-500 mb-2 uppercase">{t.connections}</h5>
                    <div className="grid grid-cols-1 gap-2">
                      {links
                        .filter(l => l.source === selectedNodeId || l.target === selectedNodeId)
                        .map(l => {
                          const otherId = l.source === selectedNodeId ? l.target : l.source;
                          const otherNode = nodes.find(n => n.id === otherId);
                          return (
                            <div key={l.id} className="flex items-center justify-between text-xs bg-gray-800/10 p-2.5 rounded-lg border border-gray-700/10 backdrop-blur-md">
                              <span className="font-medium">{otherNode?.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                l.type.startsWith('Work') ? 'bg-blue-900/30 text-blue-300' : 
                                l.type.startsWith('Family') ? 'bg-red-900/30 text-red-300' : 
                                'bg-green-900/30 text-green-300'
                              }`}>
                                {t.relationTypes[l.type as keyof typeof t.relationTypes]}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Semi-Transparent Overlays */}
        {(activeTab === 'admin' || activeTab === 'logs') && (
          <div className="absolute inset-0 z-20 bg-gray-950/40 backdrop-blur-3xl overflow-y-auto animate-in fade-in duration-500 print:bg-white print:backdrop-blur-none print:inset-0 print:overflow-visible">
             {activeTab === 'admin' && (
              <AdminPanel 
                nodes={nodes} 
                links={links} 
                currentUser={currentUser} 
                allUsers={allUsers}
                onAddNode={handleAddNode}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onAddLink={handleAddLink}
                onExport={handleExport}
                onImport={handleImport}
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
                onTransferSA={handleTransferSuperAdmin}
                onBack={() => setActiveTab('graph')}
                onReset={handleReset}
                t={t}
              />
            )}
            {activeTab === 'logs' && (
              <AuditLogView 
                logs={logs} 
                onBack={() => setActiveTab('graph')}
                t={t} 
              />
            )}
          </div>
        )}

        {/* Global Mobile Menu Button - Ultra Semi-transparent */}
        <div className="md:hidden fixed bottom-6 right-6 z-[60] print:hidden">
          {isMobileMenuOpen && (
            <div className="absolute bottom-16 right-0 bg-gray-900/50 backdrop-blur-3xl border border-gray-800/20 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
              <button onClick={() => { setActiveTab('graph'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'graph' ? 'bg-indigo-600/30 text-indigo-100' : 'hover:bg-gray-800/30'}`}>
                <Database size={18} className={activeTab === 'graph' ? 'text-indigo-300' : 'text-gray-400'} />
                <span className="text-sm font-bold">{t.navGraph}</span>
              </button>
              <button onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'admin' ? 'bg-indigo-600/30 text-indigo-100' : 'hover:bg-gray-800/30'}`}>
                <Settings size={18} className={activeTab === 'admin' ? 'text-indigo-300' : 'text-gray-400'} />
                <span className="text-sm font-bold">{t.navAdmin}</span>
              </button>
              <button onClick={() => { setActiveTab('logs'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'logs' ? 'bg-indigo-600/30 text-indigo-100' : 'hover:bg-gray-800/30'}`}>
                <History size={18} className={activeTab === 'logs' ? 'text-indigo-300' : 'text-gray-400'} />
                <span className="text-sm font-bold">{t.navLogs}</span>
              </button>
              <div className="h-px bg-gray-800/20 my-1 mx-2" />
              {/* Corrected handleLogout usage: changed handleLogout prop to onClick */}
              <button onClick={handleLogout} className="flex items-center gap-3 p-3 hover:bg-red-900/30 text-red-400 rounded-xl transition-colors">
                <LogOut size={18} />
                <span className="text-sm font-bold">{t.switchRole}</span>
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="w-14 h-14 bg-indigo-600/10 backdrop-blur-2xl rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all border border-indigo-500/20 text-white/70 hover:bg-indigo-600/30"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
