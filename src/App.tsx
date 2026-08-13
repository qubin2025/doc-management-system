import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Upload, BarChart3, Download, RefreshCw, Package, FolderOpen, Building2, Landmark, ArrowLeft, Database, HardDrive, Loader2, LogOut, MessageSquare, Users } from 'lucide-react';
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
import { getTheme, setTheme, type ThemeMode } from './data/themeEngine';
import BaselineManager from './components/BaselineManager';
import AuditLogViewer from './components/AuditLogViewer';
import StakeholderManager from './components/StakeholderManager';
import RiskManager from './components/RiskManager';
import ResourceManager from './components/ResourceManager';
import WorkflowBuilder from './components/WorkflowBuilder';
import MobilePhotoViewer from './components/MobilePhotoViewer';
import PortfolioManager from './components/PortfolioManager';
import GlobalDashboard from './components/GlobalDashboard';
import IssueManager from './components/IssueManager';
import DesktopDailyReport from './components/DesktopDailyReport';
import DesktopProgressView from './components/DesktopProgressView';
import ContractManager from './components/ContractManager';
import KnowledgeReview from './components/KnowledgeReview';
import ExperiencePanel from './components/ExperiencePanel';
import HomePage from './components/HomePage';
import StandardSelectPage from './components/StandardSelectPage';
import { guideChapters } from './data/guideModules';
import { kgPipeline } from './data/kgPipeline';
import { startSync, markChanged } from './data/syncService';
import { appendixAData as buildingData } from './data/appendixA';
import { appendixAData_municipal as municipalData } from './data/appendixA_municipal';
import { UploadInfo, FilterOptions, CategoryStats, ProjectInfo, StandardType, AuthState, Permissions } from './types';
import * as api from './data/api';
import { setGlobalProject, setGlobalAuth } from './data/ProjectContext';
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getTheme());
  const STORAGE_KEY = `doc-mgmt-upload-${standard}`;
  const PROJECTS_KEY = `doc-mgmt-projects-${standard}`;

  // ===== API 可用性 =====
  // 有本地token时优先假定API可用(避免空localStorage覆盖), checkConnection异步验证
  const hasToken = !!(localStorage.getItem(AUTH_KEY) || localStorage.getItem('doc-system-token'));
  const [apiAvailable, setApiAvailable] = useState(hasToken);
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
  const [view, setView] = useState<string>(auth ? 'dashboard-global' : 'login');

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
          // API失败但有token → token可能过期 → 清除重新登录
          if (localStorage.getItem(AUTH_KEY)) {
            localStorage.removeItem(AUTH_KEY);
            console.warn('[启动] API调用失败, token可能过期, 已清除认证信息');
          }
          loadProjectsFromLocal();
        }
      } else {
        loadProjectsFromLocal();
      }
    })();

    function loadProjectsFromLocal() {
      const s = localStorage.getItem(PROJECTS_KEY);
      if (s) { try { setProjects(JSON.parse(s)); } catch { setProjects([]); } }
      // 无本地缓存也无API → 空项目列表(用户会看到空看板, 可手动刷新)
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

  // useMemo 保证引用稳定，避免 || {} 每次渲染创建新对象触发 useEffect 无限更新
  const uploadInfo = useMemo(() => allUploadInfo[currentProject] || {}, [allUploadInfo, currentProject]);

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

  // 同步 App state → ProjectContext 全局状态
  useEffect(() => { setGlobalProject(currentProject); }, [currentProject]);
  useEffect(() => { setGlobalAuth(auth); }, [auth]);

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
    setView('dashboard-global');
    // 登录成功证明API可用, 立即标记避免加载空localStorage
    if (!apiAvailable) setApiAvailable(true);
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
      try {
        const data = JSON.stringify(allUploadInfo);
        if (data.length > 4 * 1024 * 1024) {
          console.warn('[存储] 上传数据超过4MB, 跳过localStorage保存 (使用API同步)');
        } else {
          localStorage.setItem(STORAGE_KEY, data);
        }
      } catch (e: unknown) {
        const msg = (e as Error).message || '';
        if (msg.includes('quota') || msg.includes('Quota')) {
          console.warn('[存储] localStorage配额已满, 清理旧数据...');
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
      }
    }
  }, [allUploadInfo]);

  // 保存项目列表到本地
  useEffect(() => {
    if (projects.length > 0) {
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      } catch (e: unknown) {
        const msg = (e as Error).message || '';
        if (msg.includes('quota') || msg.includes('Quota')) {
          console.warn('[存储] 项目列表保存失败, 配额已满');
        }
      }
    }
  }, [projects]);

  // ===== 操作 =====
  const [showProjectDialog, setShowProjectDialog] = useState(false);
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

      // 异步上传到 API（记录失败但不阻塞UI）
      if (apiAvailable) {
        api.uploadDocument(currentProject, docId, newInfo, standard).catch((e) => {
          console.warn('[Upload] 云端同步失败:', e.message);
          markChanged(); // 标记待同步
        });
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

  // 判断新项目引导步骤：裁剪 → 目标 → 首页
  const getProjectOnboardingStep = (projectName: string): 'tailoring' | 'objectives' | 'homepage' => {
    try {
      const tc = localStorage.getItem(`tailoring-config-${projectName}`);
      const obj = localStorage.getItem(`project-objectives-${projectName}`);
      if (!tc) return 'tailoring';
      if (!obj || obj === '[]') return 'objectives';
      return 'homepage';
    } catch { return 'tailoring'; }
  };

  // 根据项目引导步骤跳转
  const enterProject = (projectName: string) => {
    setCurrentProject(projectName);
    startSync(projectName); // 启动自动同步
    const step = getProjectOnboardingStep(projectName);
    if (step === 'tailoring') setView('tailoring-engine');
    else if (step === 'objectives') setView('target-manager');
    else setView('homepage');
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
    // 新项目 → 自动进入裁剪引擎
    setView('tailoring-engine');
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
    return <AiChatPage onBack={() => { setView('dashboard-global'); setShowAiChat(false); }} projectName={currentProject} standard={standard} initialQuery={aiQuery} isAdmin={isAdmin} />;
  }

  if (view === 'dashboard' && currentProject) {
    return <Dashboard projectName={currentProject} onBack={() => setView('dashboard-global')} onNavigate={(v) => setView(v)} />;
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
      return <GuideChapter chapter={chapter} projectName={currentProject} onBack={() => { setGuideChapterId(null); setView('homepage'); }} />;
    }
  }

  // ===== 施工组织设计审查 =====
  if (view === 'construction-review' && currentProject) {
    return <ConstructionReview projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 合同管理 =====
  if (view === 'contract-manager') {
    return <ContractManager projectName={currentProject} onBack={() => setView('homepage')} />;
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

  // 引导流程：从项目创建或项目选择进入时为true
  const onboardingFlow = getProjectOnboardingStep(currentProject) !== 'homepage';

  // ===== 模块裁剪引擎 (P0-3) =====
  if (view === 'tailoring-engine' && currentProject) {
    return <TailoringEngine projectName={currentProject}
      flowMode={onboardingFlow}
      onNext={(nextView) => setView(nextView)}
      onNavigate={(v, p) => { if (p?.chapterId) { setGuideChapterId(p.chapterId); } setView(v); }}
      onBack={() => setView('project-entry')} />;
  }

  // ===== Agent智能体 (P1-1) =====
  if (view === 'agent-console' && currentProject) {
    return <AgentConsole projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 技能面板 (P1-2) =====
  if (view === 'skill-panel' && currentProject) {
    return <SkillPanel projectName={currentProject} onBack={() => setView('homepage')} onNavigate={(v, params) => {
      if (params?.chapterId) { setGuideChapterId(params.chapterId); }
      setView(v);
    }} />;
  }

  // ===== 项目组合管理 (P3) =====
  if (view === 'portfolio') {
    return <PortfolioManager onBack={() => setView('homepage')} />;
  }

  // ===== 工作流构建器 (Phase 5) =====
  if (view === 'workflow' && currentProject) {
    return <WorkflowBuilder projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== PMBOK空白模块 (Phase 4) =====
  if (view === 'stakeholder' && currentProject) {
    return <StakeholderManager projectName={currentProject} onBack={() => setView('homepage')} />;
  }
  if (view === 'risk' && currentProject) {
    return <RiskManager projectName={currentProject} onBack={() => setView('homepage')} />;
  }
  if (view === 'resource' && currentProject) {
    return <ResourceManager projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 基线管理 (Phase 3) =====
  if (view === 'baseline' && currentProject) {
    return <BaselineManager projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 审计日志 (Phase 3) =====
  if (view === 'audit-log') {
    return <AuditLogViewer projectName={currentProject} onBack={() => isAdmin ? setView('admin') : setView('homepage')} />;
  }

  // ===== PMBOK框架 (P1-4) =====
  if (view === 'pmbok' && currentProject) {
    return <PMBOKFramework projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 目标管理 (P0-1) =====
  if (view === 'target-manager' && currentProject) {
    return <TargetManager projectName={currentProject} guideChapters={guideChapters}
      flowMode={onboardingFlow}
      onNext={(nextView) => setView(nextView)}
      onBack={() => onboardingFlow ? setView('tailoring-engine') : setView('homepage')} />;
  }

  // ===== 手机水印照片 =====
  if (view === 'mobile-photos') {
    return <MobilePhotoViewer projectName={currentProject || ''} onBack={() => setView('dashboard-global')} />;
  }

  // ===== 现场问题管理 =====
  if (view === 'issue-manager') {
    return <IssueManager onBack={() => setView('homepage')} />;
  }

  // ===== 项目日报管理 =====
  if (view === 'daily-report-manager') {
    return <DesktopDailyReport onBack={() => setView('homepage')} />;
  }

  // ===== 进度管理 =====
  if (view === 'progress-manager') {
    return <DesktopProgressView onBack={() => setView('homepage')} />;
  }

  // ===== 知识审核 =====
  if (view === 'knowledge-review') {
    return <KnowledgeReview onBack={() => setView('homepage')} />;
  }

  // ===== 项目经验库 =====
  if (view === 'experience') {
    return <ExperiencePanel projectName={currentProject} onBack={() => setView('homepage')} />;
  }

  // ===== 登录页 =====
  if (view === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  // ===== 全局项目看板（默认首页） =====
  if (view === 'dashboard-global') {
    return (
      <GlobalDashboard
        projects={projects}
        onNavigate={(v, params) => {
          if (v === 'dashboard' && params?.projectName) {
            setCurrentProject(params.projectName);
            setView('dashboard');
          } else if (v === 'project-entry') {
            setView('project-entry');
          } else if (v === 'ai-chat') {
            setShowAiChat(true);
            setView('ai-chat');
          } else if (v === 'mobile-photos') {
            setView('mobile-photos');
          } else {
            setView(v);
          }
        }}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        standard={standard}
      />
    );
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
          enterProject(name);
        }}
        onLogout={handleLogout}
        onCreateProject={() => { setShowProjectDialog(true); }}
        onRenameProject={(oldName, newName) => {
          if (!newName.trim() || oldName === newName) return;
          // v5.2: 同步到后端（含子表级联更新 project_name）
          if (apiAvailable) {
            api.updateProject(oldName, { newName: newName.trim() }).then(ok => {
              if (!ok) toast('后端同步失败，项目名仅本地更新', 'warning');
            });
          }
          // v5.2: 迁移 localStorage 中所有项目相关键（避免 syncService 用空数据覆盖后端）
          const prefixes = ['guide-', 'stakeholder-', 'risk-', 'resources-', 'raci-',
            'tailoring-config-', 'project-objectives-', 'schedule-',
            'knowledge-artifacts-', 'guide-forms-', 'guide-item-links-'];
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key) continue;
            for (const prefix of prefixes) {
              if (key.startsWith(prefix + oldName)) {
                const newKey = key.replace(prefix + oldName, prefix + newName.trim());
                localStorage.setItem(newKey, localStorage.getItem(key)!);
                localStorage.removeItem(key);
                break;
              }
            }
          }
          setProjects(prev => prev.map(p => p.name === oldName ? { ...p, name: newName.trim() } : p));
          if (currentProject === oldName) setCurrentProject(newName.trim());
          // 同步更新 allUploadInfo 中的项目名
          setAllUploadInfo(prev => {
            const next = { ...prev };
            if (next[oldName]) { next[newName.trim()] = next[oldName]; delete next[oldName]; }
            return next;
          });
        }}
        onUpdateProject={(name, details) => {
          // v5.2: 同步到后端
          if (apiAvailable) {
            api.updateProject(name, { details }).then(ok => {
              if (!ok) toast('详情后端同步失败，仅本地保存', 'warning');
            });
          }
          setProjects(prev => {
            const updated = prev.map(p => p.name === name ? { ...p, details } : p);
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
            return updated;
          });
        }}
        onBack={() => setView('dashboard-global')}
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
      <HomePage
        themeMode={themeMode}
        onNavigate={(v, params) => {
          if (params?.chapterId) { setGuideChapterId(params.chapterId); setView('guide-chapter'); }
          else setView(v);
        }}
        onToggleTheme={() => { const next = themeMode === 'dark' ? 'light' : 'dark'; setTheme(next); setThemeMode(next); }}
        onLogout={handleLogout}
      />
    );
  }

  // ===== 规程选择首页 =====
  if (view === 'standard-select' || showStandardSelect) {
    return (
      <StandardSelectPage
        onBack={() => setView('homepage')}
        onSelectStandard={(std) => handleSwitchStandard(std)}
      />
    );
  }

  // ===== 主应用 =====
  const colorClass = currentInfo.color;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-slate-300/70 backdrop-blur-md shadow-sm border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
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
                <span className="text-sm text-gray-600 flex items-center gap-1"><Users className="w-3 h-3" /> {auth?.user?.displayName || currentUser}</span>
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
