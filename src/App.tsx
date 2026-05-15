import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, BarChart3, Download, RefreshCw, Package, FolderOpen, Building2, Landmark, ArrowLeft, Database, HardDrive, Loader2 } from 'lucide-react';
import DocumentTable from './components/DocumentTable';
import FilterBar from './components/FilterBar';
import { appendixAData as buildingData } from './data/appendixA';
import { appendixAData_municipal as municipalData } from './data/appendixA_municipal';
import { UploadInfo, FilterOptions, CategoryStats, ProjectInfo, StandardType } from './types';
import * as api from './data/api';
import JSZip from 'jszip';

const USER_KEY = 'document-management-current-user';
const STANDARD_KEY = 'document-management-standard';
const ADMIN_USERS = ['管理员', 'admin'];

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

  // ===== 用户 =====
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem(USER_KEY) || '';
  });
  const isAdmin = ADMIN_USERS.includes(currentUser);

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
  const [newProjectName, setNewProjectName] = useState('');

  const handleSwitchStandard = (std: StandardType) => {
    setStandard(std);
    setShowStandardSelect(false);
    localStorage.setItem(STANDARD_KEY, std);
    // 切换规程时清空当前数据，等重新加载
    setAllUploadInfo({});
  };

  const handleUpload = useCallback((docId: string, info: UploadInfo) => {
    if (!currentProject) {
      alert('请先选择或创建项目。');
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
    if (!currentProject) { alert('请先选择项目。'); return; }
    const projectData = allUploadInfo[currentProject] || {};
    const allFiles: { docId: string; file: UploadInfo }[] = [];
    for (const [docId, files] of Object.entries(projectData)) {
      for (const file of files) { if (file.fileData) allFiles.push({ docId, file }); }
    }
    if (allFiles.length === 0) { alert('当前项目没有可下载的文件。'); return; }
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
      // 同时也要从 API 清空（需要逐个删除，这里暂时不做，以后加上）
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    if (projects.some(p => p.name === name)) { alert('项目名称已存在。'); return; }
    const newProj: ProjectInfo = { name, createdAt: new Date().toLocaleString('zh-CN') };

    if (apiAvailable) {
      try { await api.createProject(name); } catch { /* 继续 */ }
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

  // ===== 规程选择首页 =====
  if (showStandardSelect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
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
      <header className="bg-white shadow-sm border-b border-gray-200">
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
                  className={`px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 min-w-[150px] ${
                    colorClass === 'blue'
                      ? 'border-blue-300 bg-blue-50 text-blue-900 focus:ring-blue-500 focus:border-blue-500'
                      : 'border-teal-300 bg-teal-50 text-teal-900 focus:ring-teal-500 focus:border-teal-500'
                  }`}>
                  {projects.length === 0 && <option value="">-- 无项目 --</option>}
                  {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <button onClick={() => setShowProjectDialog(true)}
                  className={`px-2 py-2 text-white rounded-lg transition-colors text-sm ${colorClass === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                  title="新建/管理项目">+ 项目</button>
              </div>

              <div className="flex items-center gap-2">
                <input type="text" value={currentUser}
                  onChange={(e) => { setCurrentUser(e.target.value); localStorage.setItem(USER_KEY, e.target.value); }}
                  placeholder="当前用户"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                {isAdmin && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">管理员</span>}
              </div>

              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm">
                <Download className="w-4 h-4" />导出CSV</button>
              <button onClick={handlePackageDownload} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm">
                <Package className="w-4 h-4" />打包下载</button>
              <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                <RefreshCw className="w-4 h-4" />清空记录</button>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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
    </div>
  );
};

export default App;
