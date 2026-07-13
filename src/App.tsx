import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, BarChart3, Download, RefreshCw, Package, FolderOpen, Building2, Landmark, ArrowLeft, Database, HardDrive, Loader2, LogOut, User, MessageSquare, ClipboardCheck, FileSearch, HardHat, CheckCircle2, Sparkles, Shield, BookOpen, GitBranch, FileCheck, Target, Bot, Zap } from 'lucide-react';
import DocumentTable from './components/DocumentTable';
import FilterBar from './components/FilterBar';
import LoginPage from './components/LoginPage';
import AiChat from './components/AiChat';
import AiChatPage from './components/AiChatPage';
import { toast } from './components/Toast';
import BackupModal from './components/BackupModal';
import GuideChapter from './components/GuideChapter';
import ProjectEntryPage from './components/ProjectEntryPage';
import Dashboard from './components/Dashboard';
import PlanManager from './components/PlanManager';
import SupplierManager from './components/SupplierManager';
import CostManager from './components/CostManager';
import AnalysisCenter from './components/AnalysisCenter';
import AdminPanel from './components/AdminPanel';
import ModelAdmin from './components/ModelAdmin';
import LandReserveArchive from './components/LandReserveArchive';
import KnowledgeBase from './components/KnowledgeBase';
import KnowledgeGraphView from './components/KnowledgeGraph';
import PolicyLibrary from './components/PolicyLibrary';
import RegulationsLibrary from './components/RegulationsLibrary';
import ConstructionReview from './components/ConstructionReview';
import ContractReview from './components/ContractReview';
import BidReview from './components/BidReview';
import PlanGenerator from './components/PlanGenerator';
import TargetManager from './components/TargetManager';
import TailoringEngine from './components/TailoringEngine';
import AgentConsole from './components/AgentConsole';
import SkillPanel from './components/SkillPanel';
import PMBOKFramework from './components/PMBOKFramework';
import { guideChapters } from './data/guideModules';
import { kgPipeline } from './data/kgPipeline';
import { appendixAData as buildingData } from './data/appendixA';
import { appendixAData_municipal as municipalData } from './data/appendixA_municipal';
import { UploadInfo, FilterOptions, CategoryStats, ProjectInfo, StandardType, AuthState, Permissions } from './types';
import * as api from './data/api';
import JSZip from 'jszip';

const AUTH_KEY = 'doc-system-auth';
const STANDARD_KEY = 'document-management-standard';

const STANDARD_INFO: Record<StandardType, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  headerBg: string;
}> = {
  'DB11/T695-2025': {
    title: '建筑工程资料管理系统',
    subtitle: '《建筑工程资料管理规程》DB11/T 695-2025 附录A',
    icon: <Building2 className="w-12 h-12" />,
    color: 'blue',
    headerBg: 'bg-blue-500',
  },
  'DB11/T808-2020': {
    title: '市政工程资料管理系统',
    subtitle: '《市政基础设施工程资料管理规程》DB11/T 808-2020 附录A',
    icon: <Landmark className="w-12 h-12" />,
    color: 'teal',
    headerBg: 'bg-teal-600',
  }
};

const App: React.FC = () => {
  // ===== 规程 =====
  const [standard, setStandard] = useState<StandardType>(() => {
    return (localStorage.getItem(STANDARD_KEY) as StandardType) || 'DB11/T695-2025';
  });
  const [showStandardSelect, setShowStandardSelect] = useState(!localStorage.getItem(STANDARD_KEY));

  const currentInfo = STANDARD_INFO[standard];
  const currentData = standard === 'DB11/T695-2025' ? buildingData : municipalData;
  const STORAGE_KEY = `doc-mgmt-upload-${standard}`;
  const PROJECTS_KEY = `doc-mgmt-projects-${standard}`;

  // ===== API 可用性 =====
  const [apiAvailable, setApiAvailable] = useState(false);
  const [apiChecking, setApiChecking] = useState(true);

  useEffect(() => {
    api.checkConnection().then(ok => { setApiAvailable(ok); setApiChecking(false); });
  }, []);

  // ===== 认证 =====
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) { try { const a = JSON.parse(saved); api.setAuthToken(a.token); return a; } catch {} }
    return null;
  });

  const currentUser = auth?.user?.username || '';
  const isAdmin = auth?.user?.role === 'admin';
  const permissions: Permissions = auth?.permissions || { can_upload: true, can_download: true, can_use_ai: false };
  const canUpload = isAdmin || permissions.can_upload;
  const canUseAi = isAdmin || permissions.can_use_ai;

  // ===== View 路由 =====
  const [view, setView] = useState<string>(auth ? 'project-entry' : 'login');

  // ===== 项目列表 =====
  const [projects, setProjects] = useState<ProjectInfo[]>([]);

  // 加载项目列表
  useEffect(() => {
    (async () => {
      if (apiAvailable) {
        try {
          const list = await api.fetchProjects();
          setProjects(list);
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
        } catch {
          loadProjectsFromLocal();
        }
      } else {
        loadProjectsFromLocal();
      }
    })();

    function loadProjectsFromLocal() {
      const s = localStorage.getItem(PROJECTS_KEY);
      if (s) { try { setProjects(JSON.parse(s)); } catch { setProjects([]); } }
    }
  }, [apiAvailable, PROJECTS_KEY]);

  // ===== 当前项目 =====
  const [currentProject, setCurrentProject] = useState<string>('');

  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      setCurrentProject(projects[0].name);
    }
  }, [projects]);

  // ===== 上传数据 =====
  const [allUploadInfo, setAllUploadInfo] = useState<Record<string, Record<string, UploadInfo[]>>>({});
  const [uploadInfoLoading, setUploadInfoLoading] = useState(false);

  const uploadInfo = allUploadInfo[currentProject] || {};

  // 切换项目时从 API 加载数据
  useEffect(() => {
    if (!currentProject || !apiAvailable) return;
    setUploadInfoLoading(true);
    api.fetchDocuments(currentProject, standard).then(data => {
      setAllUploadInfo(prev => ({ ...prev, [currentProject]: data }));
    }).catch(() => {
      // 回退到本地
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed[currentProject]) {
            setAllUploadInfo(prev => ({ ...prev, [currentProject]: parsed[currentProject] }));
          }
        } catch {}
      }
    }).finally(() => setUploadInfoLoading(false));
  }, [currentProject, apiAvailable, standard]);

  // ===== View 路由 =====
  const [showAiChat, setShowAiChat] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [guideChapterId, setGuideChapterId] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState('');

  // ===== 登录/登出 =====
  const handleLogin = (authState: AuthState) => {
    setAuth(authState);
    localStorage.setItem(AUTH_KEY, JSON.stringify(authState));
    api.setAuthToken(authState.token);
    setView('project-entry');
  };

  const handleLogout = () => {
    api.logout();
    setAuth(null);
    localStorage.removeItem(AUTH_KEY);
    setView('login');
  };

  // ===== 筛选 & 统计 =====
  const [filters, setFilters] = useState<FilterOptions>({ category: '', archiveUnit: '', searchKeyword: '' });
  const [stats, setStats] = useState<CategoryStats>({ total: 0, uploaded: 0, pending: 0 });

  useEffect(() => {
    const total = currentData.length;
    const uploaded = Object.keys(uploadInfo).filter(k => uploadInfo[k]?.length > 0).length;
    setStats({ total, uploaded, pending: total - uploaded });
  }, [uploadInfo, currentData]);

  // 保存到本地（作为备份）
  useEffect(() => {
    if (Object.keys(allUploadInfo).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allUploadInfo));
    }
  }, [allUploadInfo]);

  // 保存项目列表到本地
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  // ===== 操作 =====
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showModelAdmin, setShowModelAdmin] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleSwitchStandard = (std: StandardType) => {
    setStandard(std);
    setShowStandardSelect(false);
    setView('main');
    localStorage.setItem(STANDARD_KEY, std);
    // 切换规程时清空当前数据，等重新加载
    setAllUploadInfo({});
  };

  const handleUpload = useCallback((docId: string, info: UploadInfo) => {
    if (!currentProject) {
      toast('请先选择或创建项目。', 'warning');
      return;
    }

    setAllUploadInfo(prev => {
      const projectData = prev[currentProject] || {};
      const existing = projectData[docId] || [];
      let newVersion: string;
      if (existing.length === 0) {
        newVersion = info.version || 'V1.0';
      } else {
        const lastUploadTime = existing[existing.length - 1].uploadTime;
        const now = new Date();
        const BATCH_GAP = 15 * 60 * 1000;
        let lastTime: Date | null = null;
        try {
          const parts = lastUploadTime.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
          if (parts) {
            lastTime = new Date(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6]);
          } else {
            lastTime = new Date(lastUploadTime);
          }
        } catch { lastTime = null; }
        if (lastTime && (now.getTime() - lastTime.getTime()) < BATCH_GAP) {
          newVersion = existing[existing.length - 1].version;
        } else {
          const maxVer = existing.reduce((max, f) => {
            const v = parseFloat(f.version?.replace('V', '') || '0');
            return v > max ? v : max;
          }, 0);
          newVersion = `V${(maxVer + 0.1).toFixed(1)}`;
        }
      }
      const newInfo = { ...info, version: newVersion };

      // 异步上传到 API
      if (apiAvailable) {
        api.uploadDocument(currentProject, docId, newInfo, standard).catch(() => {});
      }

      return {
        ...prev,
        [currentProject]: {
          ...projectData,
          [docId]: [...existing, newInfo]
        }
      };
    });
    kgPipeline.onDocumentChange();
  }, [currentProject, apiAvailable, standard]);

  const handleDelete = useCallback((docId: string, fileIndex: number) => {
    setAllUploadInfo(prev => {
      const projectData = { ...(prev[currentProject] || {}) };
      const existing = projectData[docId] || [];
      const updated = existing.filter((_, i) => i !== fileIndex);
      if (updated.length === 0) {
        delete projectData[docId];
      } else {
        projectData[docId] = updated;
      }

      // 异步删除 API
      if (apiAvailable) {
        api.deleteDocumentApi(docId, fileIndex, currentProject, standard).catch(() => {});
      }

      return { ...prev, [currentProject]: projectData };
    });
    kgPipeline.onDocumentChange();
  }, [currentProject, apiAvailable, standard]);

  const handleExport = () => {
    const dataWithUpload = currentData.map(item => {
      const files = uploadInfo[item.id] || [];
      return { ...item, files };
    });
    const rows: string[] = [];
    const header = ['序号', '类别', '编号', '工程资料名称', '表格编号', '规范依据', '施工', '监理', '建设', '档案馆', '上传文件名', '上传时间', '上传人', '版本号', '所属项目'].join(',');
    rows.push(header);
    dataWithUpload.forEach((item: any, idx: number) => {
      const files = item.files;
      if (files.length === 0) {
        rows.push([idx + 1, item.category, item.id, item.name, item.tableCode || '', item.standard || '',
          item.archiveUnits.construction ? '●' : '', item.archiveUnits.supervision ? '●' : '',
          item.archiveUnits.constructionUnit ? '●' : '', item.archiveUnits.archive ? '●' : '',
          '', '', '', '', currentProject].join(','));
      } else {
        files.forEach((f: UploadInfo) => {
          rows.push([idx + 1, item.category, item.id, item.name, item.tableCode || '', item.standard || '',
            item.archiveUnits.construction ? '●' : '', item.archiveUnits.supervision ? '●' : '',
            item.archiveUnits.constructionUnit ? '●' : '', item.archiveUnits.archive ? '●' : '',
            f.fileName || '', f.uploadTime || '', f.uploader || '', f.version || '', currentProject].join(','));
        });
      }
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${currentProject}_工程资料_${new Date().toISOString().split('T')[0]}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const handlePackageDownload = async () => {
    if (!currentProject) { toast('请先选择项目。', 'warning'); return; }
    const projectData = allUploadInfo[currentProject] || {};
    const allFiles: { docId: string; file: UploadInfo }[] = [];
    for (const [docId, files] of Object.entries(projectData)) {
      for (const file of files) { if (file.fileData) allFiles.push({ docId, file }); }
    }
    if (allFiles.length === 0) { toast('当前项目没有可下载的文件。', 'warning'); return; }
    const zip = new JSZip();
    const docNameMap: Record<string, string> = {};
    for (const d of currentData) docNameMap[d.id] = d.name;
    for (const { docId, file } of allFiles) {
      if (file.fileData) {
        const base64 = file.fileData.split(',')[1] || file.fileData;
        zip.file(`${docId}_${docNameMap[docId] || docId}/${file.fileName}`, base64, { base64: true });
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${currentProject}_打包_${new Date().toISOString().split('T')[0]}.zip`;
    link.click(); URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm(`确定要清空项目"${currentProject}"的所有上传记录吗？`)) {
      setAllUploadInfo(prev => { const next = { ...prev }; delete next[currentProject]; return next; });
      if (apiAvailable) { toast('提示：云端记录将保留，需要手动在管理后台清空。', 'warning'); }
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    if (projects.some(p => p.name === name)) { toast('项目名称已存在。', 'warning'); return; }
    const newProj: ProjectInfo = { name, createdAt: new Date().toLocaleString('zh-CN') };

    if (apiAvailable) {
      try { await api.createProject(name); } catch { toast('云端同步失败，项目仅保存在本地。', 'warning'); }
    }
    setProjects(prev => [...prev, newProj]);
    setCurrentProject(name);
    setNewProjectName('');
    setShowProjectDialog(false);
  };

  const handleDeleteProject = (projName: string) => {
    if (!confirm(`确定要删除项目"${projName}"及其所有数据吗？此操作不可撤销。`)) return;
    if (apiAvailable) { api.deleteProjectApi(projName).catch(() => {}); }
    setProjects(prev => prev.filter(p => p.name !== projName));
    setAllUploadInfo(prev => { const next = { ...prev }; delete next[projName]; return next; });
    if (currentProject === projName) {
      const remaining = projects.filter(p => p.name !== projName);
      setCurrentProject(remaining.length > 0 ? remaining[0].name : '');
    }
  };

  // ===== AI 对话页 =====
  if (view === 'ai-chat' || showAiChat) {
    return <AiChatPage onBack={() => { setView('project-entry'); setShowAiChat(false); }} projectName={currentProject} standard={standard} initialQuery={aiQuery} isAdmin={isAdmin} />;
  }

  if (view === 'dashboard' && currentProject) {
    return <Dashboard projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  if (view === 'plan-manager') {
    return <PlanManager onBack={() => setView('homepage')} />;
  }

  if (view === 'supplier') {
    return <SupplierManager onBack={() => setView('homepage')} />;
  }

  if (view === 'cost') {
    return <CostManager onBack={() => setView('homepage')} />;
  }

  if (view === 'analysis' && currentProject) {
    return <AnalysisCenter projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  if (view === 'admin') {
    return <AdminPanel onBack={() => setView('homepage')} />;
  }

  if (view === 'land-reserve') {
    return <LandReserveArchive onBack={() => setView('homepage')} />;
  }

  if (view === 'knowledge-base') {
    return <KnowledgeBase onBack={() => setView('homepage')} />;
  }

  if (view === 'knowledge-graph') {
    return <KnowledgeGraphView onBack={() => setView('homepage')} />;
  }

  if (view === 'policy-library') {
    return <PolicyLibrary onBack={() => setView('homepage')} />;
  }

  if (view === 'regulations-library') {
    return <RegulationsLibrary onBack={() => setView('homepage')} />;
  }

  // ===== 指南章节详情页 =====
  if (view === 'guide-chapter' && guideChapterId) {
    const chapter = guideChapters.find(c => c.id === guideChapterId);
    if (chapter) {
      return <GuideChapter chapter={chapter} onBack={() => { setGuideChapterId(null); setView('homepage'); }} />;
    }
  }

  // ===== 施工组织设计审查 =====
  if (view === 'construction-review' && currentProject) {
    return <ConstructionReview projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 合同审查 =====
  if (view === 'contract-review' && currentProject) {
    return <ContractReview projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 招投标文件审查 =====
  if (view === 'bid-review' && currentProject) {
    return <BidReview projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 方案生成 =====
  if (view === 'plan-generator' && currentProject) {
    return <PlanGenerator projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 模块裁剪引擎 (P0-3) =====
  if (view === 'tailoring-engine' && currentProject) {
    return <TailoringEngine projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== Agent智能体 (P1-1) =====
  if (view === 'agent-console' && currentProject) {
    return <AgentConsole projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 技能面板 (P1-2) =====
  if (view === 'skill-panel' && currentProject) {
    return <SkillPanel projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== PMBOK框架 (P1-4) =====
  if (view === 'pmbok' && currentProject) {
    return <PMBOKFramework projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 目标管理 (P0-1) =====
  if (view === 'target-manager' && currentProject) {
    return <TargetManager projectName={currentProject} guideChapters={guideChapters} onBack={() => setView('homepage')} />;
  }

  // ===== 登录页 =====
  if (view === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  // ===== 项目入口页 =====
  if (view === 'project-entry') {
    return (
      <>
      <ProjectEntryPage
        projects={projects}
        currentUser={currentUser}
        userDisplay={auth?.user?.displayName || ''}
        isAdmin={isAdmin}
        userRole={auth?.user?.role || ''}
        onSelectProject={(name) => {
          setCurrentProject(name);
          setView('homepage');
        }}
        onLogout={handleLogout}
        onCreateProject={() => { setShowProjectDialog(true); }}
        onRenameProject={(oldName, newName) => {
          if (!newName.trim() || oldName === newName) return;
          setProjects(prev => prev.map(p => p.name === oldName ? { ...p, name: newName } : p));
          if (currentProject === oldName) setCurrentProject(newName);
          // 同步更新 allUploadInfo 中的项目名
          setAllUploadInfo(prev => {
            const next = { ...prev };
            if (next[oldName]) { next[newName] = next[oldName]; delete next[oldName]; }
            return next;
          });
        }}
        onUpdateProject={(name, details) => {
          setProjects(prev => prev.map(p => p.name === name ? { ...p, details } : p));
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.map(p => p.name === name ? { ...p, details } : p)));
        }}
        onAiSubmit={(query) => {
          setAiQuery(query);
          setView('ai-chat');
          // 从项目入口页发起AI → 全局模式（不限定项目）
          setShowAiChat(true);
        }}
      />
      {showProjectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">创建新项目</h3>
            <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="输入项目名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:border-blue-500" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowProjectDialog(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleCreateProject} disabled={!newProjectName.trim()}
                className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed">创建</button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // ===== 首页 =====
  if (view === 'homepage') {
    return (
      <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          {/* 项目状态提醒条 — 全宽醒目 */}
          <div className={`text-center py-1.5 text-xs font-bold ${currentProject ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
            {currentProject ? `当前项目：${currentProject}` : '全局模式 — 未进入具体项目，AI将回答全局信息'}
          </div>
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-none">
                <span className="text-white font-black text-xs">ZHJK</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">全过程工程咨询管理服务平台</h1>
                <p className="text-xs text-gray-400">全过程工程咨询管理服务平台</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setView('project-entry')} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" /> 切换项目
              </button>
              <span className="flex items-center gap-1 text-sm text-gray-600"><User className="w-4 h-4" /> {auth?.user?.displayName || auth?.user?.username}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isAdmin ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {isAdmin ? '管理员' : auth?.user?.role === 'project_manager' ? '项目经理' : auth?.user?.role === 'construction_unit' ? '建设单位' : '用户'}
              </span>
              {isAdmin && (
                <button onClick={() => setShowModelAdmin(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="模型配置">
                  <Sparkles className="w-4 h-4" /> 模型
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setView('admin')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="系统管理">
                  <Shield className="w-4 h-4" /> 管理
                </button>
              )}
              <button onClick={handleLogout} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" /> 退出
              </button>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* ===== 第一区块：工作指南工作模块 ===== */}
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">指南工作模块</h2>
          <p className="text-center text-gray-500 mb-8 text-sm">各模块以项目为单位严格按照指南手册内容执行，大模型智能分析驱动全过程管理</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {[
              { id: 'ch1', icon: <ClipboardCheck className="w-6 h-6 text-blue-600" />, number: 1, title: '前期工作', desc: '项目立项、可行性研究、用地规划许可、建设许可、施工许可等前期管理' },
              { id: 'ch2', icon: <FileSearch className="w-6 h-6 text-amber-600" />, number: 2, title: '招标采购', desc: '招标文件编制、招标公告、评标定标、中标通知、合同签订与备案' },
              { id: 'ch3', icon: <HardHat className="w-6 h-6 text-emerald-600" />, number: 3, title: '工程施工', desc: '施工准备、质量管理、进度控制、安全监督、变更管理、监理协调' },
              { id: 'ch4', icon: <CheckCircle2 className="w-6 h-6 text-indigo-600" />, number: 4, title: '竣工验收及移交', desc: '竣工预验收、正式验收、备案归档、工程移交、竣工结算、保修管理' },
            ].map((m) => (
              <button key={m.id} onClick={() => { setGuideChapterId(m.id); setView('guide-chapter'); }}
                className="bg-white rounded-xl shadow-sm p-5 text-left border-2 border-transparent hover:shadow-md hover:-translate-y-1 transition-all duration-200 hover:border-gray-200 group cursor-pointer">
                <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">{m.icon}</div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-gray-800 group-hover:text-gray-900">第{m.number}章 {m.title}</h3>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-medium">已上线</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* 分隔线 */}
          <div className="flex items-center gap-4 mb-12">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 font-medium">功能模块</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* ===== 第二区块：功能模块 ===== */}
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">功能模块</h2>
          <p className="text-center text-gray-500 mb-8 text-sm">各模块以项目为单位打通数据联系，大模型智能分析驱动全过程管理</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* P1新功能: AI智能体 */}
            <button onClick={() => setView('agent-console')}
              className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-5 text-left border-2 border-purple-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative overflow-hidden">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] rounded-full bg-purple-500 text-white font-bold">NEW</div>
              <div className="w-11 h-11 rounded-lg bg-purple-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">AI智能体 <span className="text-xs text-purple-500">P1</span></h3>
              <p className="text-xs text-gray-500 leading-relaxed">自主规划执行 · ReAct推理 · 多工具编排</p>
            </button>

            {/* P1新功能: 技能面板 */}
            <button onClick={() => setView('skill-panel')}
              className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-sm p-5 text-left border-2 border-amber-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative overflow-hidden">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500 text-white font-bold">NEW</div>
              <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">技能面板 <span className="text-xs text-amber-500">P1</span></h3>
              <p className="text-xs text-gray-500 leading-relaxed">7个AI技能 · 审查/生成/填写 · 一键执行</p>
            </button>

            {/* P1新功能: PMBOK框架 */}
            <button onClick={() => setView('pmbok')}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-sm p-5 text-left border-2 border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative overflow-hidden">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500 text-white font-bold">NEW</div>
              <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">PMBOK框架 <span className="text-xs text-blue-500">P1</span></h3>
              <p className="text-xs text-gray-500 leading-relaxed">10大知识领域 · 49过程 · 8大绩效域</p>
            </button>

            {/* P0新功能: 模块裁剪 */}
            <button onClick={() => setView('tailoring-engine')}
              className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl shadow-sm p-5 text-left border-2 border-purple-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative overflow-hidden">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] rounded-full bg-purple-500 text-white font-bold">NEW</div>
              <div className="w-11 h-11 rounded-lg bg-purple-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">模块裁剪 <span className="text-xs text-purple-500">P0</span></h3>
              <p className="text-xs text-gray-500 leading-relaxed">项目特征问卷 · PMBOK裁剪建议 · 灵活组装模块</p>
            </button>

            {/* P0新功能: 目标管理 */}
            <button onClick={() => setView('target-manager')}
              className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl shadow-sm p-5 text-left border-2 border-sky-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative overflow-hidden">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] rounded-full bg-sky-500 text-white font-bold">NEW</div>
              <div className="w-11 h-11 rounded-lg bg-sky-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">目标管理 <span className="text-xs text-sky-500">P0</span></h3>
              <p className="text-xs text-gray-500 leading-relaxed">OKR/WBS分解 · 目标-工作项联动 · 达成度自动计算</p>
            </button>

            {/* 资料管理 - 已上线 */}
            <button
              onClick={() => setView('standard-select')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-blue-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">工程资料管理</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线 v1.0</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">建筑/市政工程资料分类保存管理，DB11/T 695-2025 & DB11/T 808-2020 附录A</p>
            </button>
            {/* 土储中心归档 - 已上线 */}
            <button onClick={() => setView('land-reserve')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-teal-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-teal-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-teal-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">土储中心归档资料</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">土储中心归档移交资料规程，86项分类归档管理，上传自动填充</p>
            </button>
            {/* 项目仪表盘 - 已上线 */}
            <button onClick={() => setView('dashboard')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-purple-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-purple-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">项目仪表盘</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">CPI/SPI/完整度/质量分 KPI实时监控，异常预警，多项目对比</p>
            </button>
            {/* 计划管理 - 已上线 */}
            <button onClick={() => setView('plan-manager')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-indigo-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-indigo-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">计划管理</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">项目进度甘特图、各章节完成度、里程碑节点、预计工期</p>
            </button>
            {/* 未来模块 - 规划中 */}
            {/* 供应商库 - 已上线 */}
            <button onClick={() => setView('supplier')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-orange-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">供应商库</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">供应商信息管理、资质审核标记、评价星级、供应商资源池</p>
            </button>
            {/* 造价数据 - 已上线 */}
            <button onClick={() => setView('cost')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-cyan-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-cyan-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-cyan-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">造价数据</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">工程量清单录入、单位价格、分类汇总、成本合计</p>
            </button>
            {/* 知识库 - 已上线 */}
            <button onClick={() => setView('knowledge-base')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-blue-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">知识库</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">全文检索+语义搜索、文档自动索引、向量化知识库</p>
            </button>
            {/* 知识图谱 - 已上线 */}
            <button onClick={() => setView('knowledge-graph')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-purple-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <GitBranch className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">知识图谱</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">项目-表单-文档-人员关系图谱、节点可点击跳转</p>
            </button>
            {/* 政策库 - 已上线 */}
            <button onClick={() => setView('policy-library')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-red-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">政策库</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">全过程工程咨询服务相关政策法规、管理办法、技术标准</p>
            </button>
            {/* 制度规范库 - 已上线 */}
            <button onClick={() => setView('regulations-library')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-teal-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-teal-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-teal-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">制度规范库</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">土储中心制度规范、地方标准、工作规程、档案管理</p>
            </button>
            {/* 智能分析 - 已上线 */}
            <button onClick={() => setView('analysis')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-emerald-300 group cursor-pointer bg-gradient-to-br from-white to-emerald-50/30">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-100 to-emerald-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">智能分析</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">AI综合项目分析、风险预警、知识图谱、智能建议</p>
            </button>
            {/* 施工组织设计审查 */}
            <button onClick={() => setView('construction-review')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-amber-300 group cursor-pointer bg-gradient-to-br from-white to-amber-50/30">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileCheck className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">施工组织设计审查</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">专项方案+施组审查、标准合规验证、知识图谱追溯</p>
            </button>
            {/* 合同审查 */}
            <button onClick={() => setView('contract-review')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-blue-300 group cursor-pointer bg-gradient-to-br from-white to-blue-50/30">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">合同审查</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">合同条款合规审查、风险条款识别、知识库标准对照</p>
            </button>
            {/* 方案生成 - Phase3 */}
            <button onClick={() => setView('plan-generator')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-green-300 group cursor-pointer bg-gradient-to-br from-white to-green-50/30">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">AI方案生成</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">Phase3</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">AI逐章生成施工方案、标准条款自动注入、Word导出</p>
            </button>
            {/* 招投标文件审查 */}
            <button onClick={() => setView('bid-review')}
              className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 border-2 border-indigo-300 group cursor-pointer bg-gradient-to-br from-white to-indigo-50/30">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileSearch className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-bold text-gray-800">招投标文件审查</h3>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">招标文件合规性审查、评标要素提取、知识库辅助</p>
            </button>
          </div>
        </div>
        <footer className="text-center text-xs text-gray-400 py-8">全过程工程咨询管理服务平台 · 内网系统</footer>
      </div>
      {showModelAdmin && <ModelAdmin onClose={() => setShowModelAdmin(false)} />}
      </>
    );
  }

  // ===== 规程选择首页 =====
  if (view === 'standard-select' || showStandardSelect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <button onClick={() => setView('homepage')} className="flex items-center gap-1 mb-6 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium border border-gray-200">
            <ArrowLeft className="w-4 h-4" /> 返回首页
          </button>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">工程资料管理系统</h1>
            <p className="text-gray-500">请选择资料管理规程</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {(['DB11/T695-2025', 'DB11/T808-2020'] as StandardType[]).map((std) => {
              const info = STANDARD_INFO[std];
              return (
                <button key={std} onClick={() => handleSwitchStandard(std)}
                  className="bg-white rounded-xl shadow-lg p-8 text-left hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border-2 border-transparent hover:border-blue-400 group">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${info.headerBg} bg-opacity-10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <div className={info.color === 'blue' ? 'text-blue-600' : 'text-teal-600'}>{info.icon}</div>
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">
                    {std === 'DB11/T695-2025' ? '建筑工程资料管理规程' : '市政基础设施工程资料管理规程'}
                  </h2>
                  <p className="text-sm text-gray-500 mb-1">{std}</p>
                  <p className="text-xs text-gray-400">
                    {std === 'DB11/T695-2025' ? '附录A — 建筑工程资料分类保存表' : '附录A — 市政工程资料分类保存表'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===== 主应用 =====
  const colorClass = currentInfo.color;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colorClass === 'blue' ? 'bg-blue-500' : 'bg-teal-600'}`}>
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-800">{currentInfo.title}</h1>
                  <button onClick={() => setShowStandardSelect(true)}
                    className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> 切换规程
                  </button>
                  {/* 连接状态 */}
                  {!apiChecking && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                      apiAvailable ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`} title={apiAvailable ? '已连接云端数据库' : '离线模式 - 数据存在本地'}>
                      {apiAvailable ? <><Database className="w-3 h-3" /> 云端</> : <><HardDrive className="w-3 h-3" /> 本地</>}
                    </span>
                  )}
                  {apiChecking && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                </div>
                <p className="text-sm text-gray-500">{currentInfo.subtitle}</p>
              </div>
            </div>

            {/* 项目选择 + 操作按钮 */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FolderOpen className={`w-4 h-4 ${colorClass === 'blue' ? 'text-blue-500' : 'text-teal-500'}`} />
                <select value={currentProject} onChange={(e) => setCurrentProject(e.target.value)}
                  className={`px-3 py-2 border rounded-lg text-sm font-medium  min-w-[150px] ${
                    colorClass === 'blue'
                      ? 'border-blue-300 bg-blue-50 text-blue-900 focus:border-blue-500'
                      : 'border-teal-300 bg-teal-50 text-teal-900 focus:border-teal-500'
                  }`}>
                  {projects.length === 0 && <option value="">-- 无项目 --</option>}
                  {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <button onClick={() => setShowProjectDialog(true)}
                  className={`px-2 py-2 text-white rounded-lg transition-colors text-sm ${colorClass === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                  title="新建/管理项目">+ 项目</button>
              </div>

              {/* 用户信息 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 flex items-center gap-1"><User className="w-3 h-3" /> {auth?.user?.displayName || currentUser}</span>
                {isAdmin ? (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">管理员</span>
                ) : (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">{auth?.user?.role === 'project_manager' ? '项目经理' : auth?.user?.role === 'construction_unit' ? '建设单位' : '用户'}</span>
                )}
                <button onClick={() => setView('homepage')} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium border border-gray-200">
                  <ArrowLeft className="w-4 h-4" /> 返回首页
                </button>
                <button onClick={handleLogout} className="px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded" title="退出登录">
                  <LogOut className="w-3 h-3" />
                </button>
              </div>

              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm">
                <Download className="w-4 h-4" />导出CSV</button>
              <button onClick={handlePackageDownload} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm">
                <Package className="w-4 h-4" />打包下载</button>
              {canUseAi && (
                <button onClick={() => setShowAiChat(!showAiChat)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-white ${showAiChat ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'}`}>
                  <MessageSquare className="w-4 h-4" /> AI
                </button>
              )}
              <button onClick={() => setShowBackupModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm">
                <Package className="w-4 h-4" />备份</button>
              {isAdmin && (
                <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                  <RefreshCw className="w-4 h-4" />清空记录</button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 统计卡片 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-4">
          <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${colorClass === 'blue' ? 'border-l-blue-500' : 'border-l-teal-500'}`}>
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">资料总数</p><p className="text-2xl font-bold text-gray-800">{stats.total}</p></div>
              <FileText className={`w-10 h-10 ${colorClass === 'blue' ? 'text-blue-200' : 'text-teal-200'}`} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">已上传</p><p className="text-2xl font-bold text-green-600">{stats.uploaded}</p></div>
              <Upload className="w-10 h-10 text-green-300" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">待上传</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></div>
              <BarChart3 className="w-10 h-10 text-yellow-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="max-w-7xl mx-auto px-4">
        <FilterBar filters={filters} onFilterChange={setFilters} showECategory={standard === 'DB11/T808-2020'} />
      </div>

      {/* 表格 */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {uploadInfoLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <DocumentTable
            data={currentData}
            uploadInfo={uploadInfo}
            onUpload={handleUpload}
            onDelete={handleDelete}
            filters={filters}
            currentUser={currentUser}
            isAdmin={isAdmin}
            canUpload={canUpload}
            projectName={currentProject}
          />
        )}
      </div>

      {/* 项目管理对话框 */}
      {showProjectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">项目管理</h3>
              <button onClick={() => setShowProjectDialog(false)} className="p-1 hover:bg-gray-100 rounded"><span className="text-gray-500">✕</span></button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="输入新项目名称"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500" />
                <button onClick={handleCreateProject} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">创建</button>
              </div>
              {projects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无项目，请创建第一个项目</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {projects.map(p => {
                    const data = allUploadInfo[p.name] || {};
                    const fileCount = Object.values(data).reduce((sum: number, files) => sum + files.length, 0);
                    return (
                      <div key={p.name} className={`flex items-center justify-between p-3 rounded-lg border ${currentProject === p.name ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-xs text-gray-500">创建于 {p.createdAt} · {fileCount} 个文件</div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {currentProject !== p.name && (
                            <button onClick={() => { setCurrentProject(p.name); setShowProjectDialog(false); }}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">选择</button>
                          )}
                          {currentProject === p.name && <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">当前</span>}
                          <button onClick={() => handleDeleteProject(p.name)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded" title="删除项目">删除</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t bg-gray-50">
              <button onClick={() => setShowProjectDialog(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 页脚 */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>工程资料管理系统 - 严格按照规程附录A表格样式设计</p>
          <p className="mt-1">
            {apiAvailable ? '云端数据库共享模式 ·' : '离线模式 ·'} 数据同步保障 · 支持CSV导入导出
          </p>
        </div>
      </footer>

      {/* AI 聊天窗口 */}
      {showAiChat && (
        <AiChat
          onClose={() => setShowAiChat(false)}
          projectName={currentProject}
          standard={standard}
          colorClass={colorClass}
        />
      )}

      {/* 备份弹窗 */}
      {showBackupModal && (
        <BackupModal
          onClose={() => setShowBackupModal(false)}
        />
      )}
    </div>
  );
};

export default App;
