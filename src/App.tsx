import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { FileText, Upload, BarChart3, Download, RefreshCw, Package, FolderOpen, Building2, Landmark, ArrowLeft, Database, HardDrive, Loader2, MessageSquare, Users } from 'lucide-react';
import DocumentTable from './components/DocumentTable';
import FilterBar from './components/FilterBar';
import GlobalSearch from './components/GlobalSearch';
import StateView from './components/StateView';

// 大组件懒加载（减少首屏JS体积，按需加载）
const KnowledgeGraphView = lazy(() => import('./components/KnowledgeGraph'));
const PlanGenerator = lazy(() => import('./components/PlanGenerator'));
const TailoringEngine = lazy(() => import('./components/TailoringEngine'));
const AgentConsole = lazy(() => import('./components/AgentConsole'));
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
import PolicyLibrary from './components/PolicyLibrary';
import RegulationsLibrary from './components/RegulationsLibrary';
import ConstructionReview from './components/ConstructionReview';
import ContractReview from './components/ContractReview';
import BidReview from './components/BidReview';
import TargetManager from './components/TargetManager';
import SkillPanel from './components/SkillPanel';
import PMBOKFramework from './components/PMBOKFramework';
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
import { setCachedProjects, setCachedUploads } from './data/projectDataCache';
import { migrateKeyOnRename } from './data/projectKeyUtils';
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
          setCachedProjects(list);  // v5.2: 填充 API-backed 缓存供数据模块同步读取
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
        } catch (err: any) {
          // v6.0 FIX: 区分认证失败 vs 网络/服务器错误
          //   v5.7 原实现：任何错误都清除 token → 临时网络抖动也会强制登出，闪烁循环
          //   v6.0 新策略：仅当 err.authFailed=true（后端明确返回 401/未登录）才清除 token
          //               其他错误（网络断开、500、超时）保留 token，提示用户稍后重试
          const isAuthFailed = err?.authFailed === true || /未登录|登录已过期|请先登录/.test(err?.message || '');
          if (isAuthFailed) {
            if (localStorage.getItem(AUTH_KEY)) {
              localStorage.removeItem(AUTH_KEY);
              console.warn('[启动] 认证失效, 已清除认证信息:', err.message);
            }
            setApiAvailable(false);
            setProjects([]);
            toast('登录状态已失效，请重新登录', 'warning');
          } else {
            // 网络/服务器错误：保留 token，避免用户被强制登出
            console.warn('[启动] 获取项目列表失败(非认证错误), 保留登录态:', err.message);
            // 尝试加载本地缓存, 避免空白
            loadProjectsFromLocal();
            toast('获取项目列表失败：' + (err?.message || '网络错误') + '，已加载本地缓存', 'warning');
          }
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

  // ===== 本地辅助函数：重命名 / 更新详情（后端成功后调用）=====
  const doLocalRename = useCallback((oldName: string, newName: string) => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      const newKey = migrateKeyOnRename(key, oldName, newName);
      if (newKey) {
        localStorage.setItem(newKey, localStorage.getItem(key)!);
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem('knowledge-graph');
    // v5.6: 同步写 PROJECTS_KEY,确保关闭对话框时本地缓存已更新(避免用户马上刷新看到旧名)
    setProjects(prev => {
      const updated = prev.map(p => p.name === oldName ? { ...p, name: newName } : p);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
      return updated;
    });
    if (currentProject === oldName) setCurrentProject(newName);
    setAllUploadInfo(prev => {
      const next = { ...prev };
      if (next[oldName]) { next[newName] = next[oldName]; delete next[oldName]; }
      return next;
    });
  }, [currentProject, PROJECTS_KEY]);

  const doUpdateLocal = useCallback((name: string, details: any) => {
    setProjects(prev => {
      const updated = prev.map(p => p.name === name ? { ...p, details } : p);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [PROJECTS_KEY]);

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

  // v5.2: 同步上传记录 → API-backed 缓存，供 indicatorEngine/knowledgeGraph/projectAggregator 同步读取
  useEffect(() => {
    if (Object.keys(allUploadInfo).length > 0) {
      setCachedUploads(allUploadInfo);
    }
  }, [allUploadInfo]);

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

  // v5.6: 删除项目 (App 级对话框的删除按钮)
  // 安全规则:1) 仅 isAdmin 可操作(前端 + 后端 requireRole 双重校验) 2) 强制输入 DELETE-{项目名} 防误触 3) 先 API 成功再改前端 state(禁止乐观删除)
  const handleDeleteProject = async (projName: string) => {
    if (!isAdmin) { toast('仅系统管理员可删除项目', 'error'); return; }
    const expected = `DELETE-${projName}`;
    const promptText =
      `[危险操作] 即将永久删除项目「${projName}」\n\n` +
      `• 后端数据库 20+ 张业务表级联删除(事务)\n` +
      `• 本地 localStorage/向量库/知识图谱分区同步清理\n` +
      `• 此操作不可撤销,建议先导出归档\n\n` +
      `请在下方输入框中准确输入「${expected}」以继续:`;
    const input = (typeof window !== 'undefined' && typeof (window as any).prompt === 'function')
      ? (window as any).prompt(promptText, '') as string | null
      : null;
    if (input?.trim() !== expected) { if (input !== null) toast('取消删除或输入不匹配', 'warning'); return; }
    let deletedName: string | null = null;
    let isPhantom = false;
    try {
      if (apiAvailable) {
        const r = await api.deleteProjectApi(projName);
        deletedName = r.deletedProjectName || projName;
        isPhantom = !!(r as any).phantom;
        // v5.6 FIX: phantom 项目表示后端已无此记录(幽灵项目),跳过 KG 清理(没东西可清)
        if (!isPhantom) {
          try { await api.deleteProjectKGNodes(projName); } catch (_) { /* noop */ }
        }
      } else {
        deletedName = projName;
        isPhantom = true; // 离线模式下所有删除都是纯本地清理
      }
    } catch (e: any) {
      toast(`后端删除失败:${e?.message || '未知错误'}。未删除任何数据。`, 'error');
      return; // 后端失败则一律不做乐观删除
    }
    // API 成功 → 本地清理
    const target = deletedName || projName;
    // localStorage: 清理项目专属 key 缓存 + knowledge-graph 重建
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        // 项目级 key 通用前缀:通用工作项指南/目标/上传信息
        if (k === `guide-${target}-done` ||
          k.endsWith(`-${target}-done`) ||
          k.startsWith(`objectives-root-${target}`) ||
          k.startsWith(`upload-info-${target}-`) ||
          k.startsWith(`tailoring-${target}-`) ||
          k.startsWith(`project-detail-${target}-`) ||
          k === `kb-sync-state-${target}` ||
          k.includes(`:${target}:`)) {
          keysToRemove.push(k);
        }
        if (k.startsWith('doc-mgmt-projects-')) {
          try {
            const v = JSON.parse(localStorage.getItem(k) || '[]');
            if (Array.isArray(v)) localStorage.setItem(k, JSON.stringify(v.filter((x: any) => (x.name || '') !== target)));
          } catch {}
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('knowledge-graph');
    } catch (_) { /* localStorage 清理失败不阻断主结论 */ }
    // 向量库分区清理
    try {
      const { vectorStore } = await import('./data/vectorStore');
      try { vectorStore.removeByPrefix('daily', target); } catch (_) {}
      try { vectorStore.removeByPrefix('issue', target); } catch (_) {}
      try { vectorStore.removeByPrefix('exp', target); } catch (_) {}
    } catch (_) { /* 离线场景跳过 */ }
    // 前端 React state 同步移除
    setProjects(prev => {
      const updated = prev.filter(p => p.name !== target);
      // 不仅更新当前标准的 key, 更新所有标准的项目列表 key
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('doc-mgmt-projects-')) {
          localStorage.setItem(k, JSON.stringify(updated));
        }
      }
      return updated;
    });
    setAllUploadInfo(prev => { const next = { ...prev }; delete next[target]; return next; });
    if (currentProject === target) {
      const remaining = projects.filter(p => p.name !== target);
      setCurrentProject(remaining.length > 0 ? remaining[0].name : '');
    }
    toast(`项目「${target}」已彻底删除`, 'success');
    // 300ms 后刷新页面,保证各模块/缓存全量失效不残留
    setTimeout(() => window.location.reload(), 300);
  };

  // ===== AI 对话页 =====
  if (view === 'ai-chat' || showAiChat) {
    return <AiChatPage onBack={() => { setView('homepage'); setShowAiChat(false); }} projectName={currentProject} standard={standard} initialQuery={aiQuery} isAdmin={isAdmin} />;
  }

  if (view === 'dashboard' && currentProject) {
    return <Dashboard projectName={currentProject} onBack={() => setView('dashboard-global')} onNavigate={(v) => setView(v)} />;
  }

  if (view === 'plan-manager') {
    return <PlanManager onBack={() => setView('homepage')} projectName={currentProject || undefined} />;
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
    return (
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />加载知识图谱...</div>}>
        <KnowledgeGraphView onBack={() => setView('homepage')} />
      </Suspense>
    );
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
    return (
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />加载方案生成器...</div>}>
        <PlanGenerator projectName={currentProject} onBack={() => setView('homepage')} />
      </Suspense>
    );
  }

  // 引导流程：从项目创建或项目选择进入时为true
  const onboardingFlow = getProjectOnboardingStep(currentProject) !== 'homepage';

  // ===== 模块裁剪引擎 (P0-3) =====
  if (view === 'tailoring-engine' && currentProject) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />加载裁剪引擎...</div>}>
        <TailoringEngine projectName={currentProject}
          flowMode={onboardingFlow}
          onNext={(nextView) => setView(nextView)}
          onNavigate={(v, p) => { if (p?.chapterId) { setGuideChapterId(p.chapterId); } setView(v); }}
          onBack={() => setView('homepage')} />
      </Suspense>
    );
  }

  // ===== Agent智能体 (P1-1) =====
  if (view === 'agent-console' && currentProject) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />加载智能体控制台...</div>}>
        <AgentConsole projectName={currentProject} onBack={() => setView('homepage')} />
      </Suspense>
    );
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
    return <AuditLogViewer projectName={currentProject} onBack={() => setView('homepage')} />;
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
      onBack={() => setView('homepage')} />;
  }

  // ===== 手机水印照片 =====
  if (view === 'mobile-photos') {
    return <MobilePhotoViewer projectName={currentProject || ''} onBack={() => setView('homepage')} />;
  }

  // ===== 现场问题管理 =====
  if (view === 'issue-manager') {
    return <IssueManager onBack={() => setView('homepage')} projectName={currentProject} />;
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
          const trimmed = newName.trim();
          // v5.5: 先调后端，成功后再更新本地；失败则提示具体错误
          if (apiAvailable) {
            api.updateProject(oldName, { newName: trimmed }).then(res => {
              if (res.ok) {
                doLocalRename(oldName, trimmed);
              } else {
                toast(res.error || '后端同步失败', 'error');
              }
            });
          } else {
            doLocalRename(oldName, trimmed);
          }
        }}
        onUpdateProject={(name, details) => {
          // v5.2: 同步到后端；v5.5 失败提示具体错误
          if (apiAvailable) {
            api.updateProject(name, { details }).then(res => {
              if (res.ok) {
                doUpdateLocal(name, details);
              } else {
                toast(res.error || '详情保存失败', 'error');
              }
            });
          } else {
            doUpdateLocal(name, details);
          }
        }}
        onSaveProject={async (oldName, newName, details) => {
          const trimmed = newName.trim();
          if (!trimmed) return false;
          const changed = trimmed !== oldName;
          // 单次 API 调用同时处理重命名 + 详情更新
          const payload: any = { details };
          if (changed) payload.newName = trimmed;
          if (apiAvailable) {
            let upgradedLocalProject = false; // 标记是否做了 404→create 降级(纯本地项目升级为后端项目)
            try {
              let res = await api.updateProject(oldName, payload);
              // v5.6 修复:本地缓存中有该项目但后端不存在(离线模式创建的纯本地项目)
              // → 返回 404 "项目不存在" 时,先 createProject 在后端建立该项目,再 PUT 更新一次
              if (!res.ok && res.error === '项目不存在') {
                upgradedLocalProject = true;
                try {
                  // v5.6 BUG FIX: 之前 createProject(oldName) = "用旧名去创建",然后再 PUT /oldName?oldName→newName 重命名,
                  //   但如果此时另一个 tab/会话已经有 oldName 对应的行存在于后端(或 oldName 本身被其它项目占了),create 失败且 catch 的 message
                  //   走 "includes('已存在')" → 静默吞掉,然后继续 PUT /oldName → 该 oldName 指向的是别人的项目,或者根本就是个死循环。
                  //   正确做法:直接 create 【trimmed 最终目标名】, 因为用户 intent 就是"保存一份叫这个名的项目"。
                  //   1) 先尝试 trimmed(目标名); 如果 409(已存在),再 fallback oldName。这样避免了目标名被一个"无主的刚创建的空壳 oldName" 占用
                  const createAttempts = changed ? [trimmed, oldName] : [oldName];
                  let actuallyCreated = null;
                  let lastErr: any = null;
                  for (const nm of createAttempts) {
                    try {
                      await api.createProject(nm);
                      actuallyCreated = nm;
                      break;
                    } catch (e2: any) {
                      lastErr = e2;
                      const m = (e2?.message || '').toString();
                      // 如果 UNIQUE 冲突了,尝试下一个候选名
                      if (!m.includes('已存在') && !m.includes('UNIQUE')) break;
                    }
                  }
                  if (!actuallyCreated) {
                    // 两个候选名都创建失败(都占了)
                    toast(`后端无法创建该项目: ${(lastErr?.message || '') || '名称冲突,请换用其他名称'}`, 'error');
                    return false;
                  }
                  // 如果实际创建的名称和 payload.newName 不一致,说明 trimmed 没创建成功,走的是 oldName
                  // → 先改 payload.newName 以匹配实际项目名,然后等 PUT /actuallyCreated 走重命名流程
                  //   (除非 actuallyCreated 就是 trimmed,那 oldName 参数要替换)
                  const apiOldNameForPut = actuallyCreated;
                  const res2 = await api.updateProject(apiOldNameForPut, payload);
                  // 覆盖外层 res,供后续 if (res.ok) 判断用
                  res = res2;
                  // 如果 PUT 最终成功 → 无论走了哪条路径,最终 DB 中的项目名应该是 trimmed(如果有改名)
                  // → localStorage 的 doLocalRename 需要用"用户点击保存时的 oldName"作为 src,
                  //   所以 DO NOT overwrite outer `oldName` / `trimmed` 变量,保持后续逻辑不变。
                } catch (e: any) {
                  const msg = e?.message || '';
                  if (!msg.includes('已存在')) {
                    toast(`后端无法创建该项目: ${msg || '未知错误'}`, 'error');
                    return false;
                  }
                }
              }
              if (res.ok) {
                // v5.6: 404 降级成功后,强制从后端刷新 projects 列表,使纯本地项目获得后端 id 并同步 projects state
                // 避免后续再编辑时因前端 state 陈旧导致的 duplicate 死胡同或 404 循环
                if (upgradedLocalProject) {
                  try {
                    const freshList = await api.fetchProjects();
                    setProjects(freshList);
                    setCachedProjects(freshList);
                    localStorage.setItem(PROJECTS_KEY, JSON.stringify(freshList));
                  } catch (_) { /* 刷新失败不影响成功结论,下次 useEffect 会自动重拉 */ }
                }
                if (changed) doLocalRename(oldName, trimmed);
                doUpdateLocal(changed ? trimmed : oldName, details);
                toast('保存成功', 'success');
                return true;
              } else {
                // v5.6: 409 改名冲突 + 404 升级场景,先刷新 projects 同步后端最新状态,再给用户明确引导
                if (upgradedLocalProject) {
                  try {
                    const freshList = await api.fetchProjects();
                    setProjects(freshList);
                    setCachedProjects(freshList);
                    localStorage.setItem(PROJECTS_KEY, JSON.stringify(freshList));
                  } catch (_) { /* noop */ }
                }
                if (res.error === '项目名称已存在') {
                  toast(`新名称「${trimmed}」已被占用${changed ? `,请改回原名称「${oldName}」保存详情,或换用其他未使用的项目名称` : ''}`, 'warning');
                } else {
                  toast(res.error || '保存失败', 'error');
                }
                return false;
              }
            } catch (e: any) {
              toast(`保存失败: ${e?.message || '未知错误'}`, 'error');
              return false;
            }
          } else {
            if (changed) doLocalRename(oldName, trimmed);
            doUpdateLocal(changed ? trimmed : oldName, details);
            toast('已保存到本地', 'success');
            return true;
          }
        }}
        onBack={() => setView('homepage')}
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
        onNavigate={(v, params) => {
          if (params?.chapterId) { setGuideChapterId(params.chapterId); setView('guide-chapter'); }
          else setView(v);
        }}
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
              <button onClick={() => setView('homepage')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50">
                <ArrowLeft className="w-4 h-4" /> 返回首页
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 全局搜索（Ctrl+K） */}
      {currentProject && (
        <GlobalSearch
          projectName={currentProject}
          onNavigate={(view, params) => {
            if (view === 'guide-chapter' && params?.chapterId) {
              setGuideChapterId(params.chapterId);
            }
            setView(view);
          }}
        />
      )}

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
        <StateView
          loading={uploadInfoLoading}
          empty={!uploadInfoLoading && currentData.length === 0}
          emptyTitle="暂无文档资料"
          emptyDescription="当前规程下暂无文档，可点击上方上传按钮添加"
        >
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
        </StateView>
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
                          {isAdmin && (
                            <button onClick={() => handleDeleteProject(p.name)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded" title="删除项目(仅管理员)">删除</button>
                          )}
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
