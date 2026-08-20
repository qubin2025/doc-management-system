import React, { useState, useEffect } from 'react';
import { Search, FolderOpen, ArrowRight, Send, User, Sparkles, Plus, Settings, Paperclip, Image, BarChart3, ChevronDown, Edit3, Download, X, Loader, Upload, Trash2, FileText, Users } from 'lucide-react';
import { ProjectInfo } from '../types';
import * as api from '../data/api';
import { fetchAllIssues, DesktopIssue } from '../data/api';
import { toast } from './Toast';
import { collectKeysForTarget } from '../data/projectKeyUtils';
import { parseDocument, ParseProgress } from '../data/documentParser';
import { vectorStore, VectorDoc } from '../data/vectorStore';
import ProjectMembersDialog from './ProjectMembersDialog';

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
  onSaveProject?: (oldName: string, newName: string, details: any) => Promise<boolean> | boolean;
  onBack?: () => void;
}

// v5.6: Markdown → HTML 转换器(支持表格/列表/标题/加粗/段落)
// forWord=true 时,生成 Word 兼容的 HTML(带 xmlns + 严格样式)
function markdownToHtml(md: string, projectName: string, forWord: boolean = false): string {
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = (md || '').split('\n');
  const out: string[] = [];
  let inTable = false;
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    // 表格检测
    if (line.trim().startsWith('|')) {
      if (!inTable) { out.push('<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px;">'); inTable = true; }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      // 分隔行(|---|---|)跳过
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      // 简化:第一行作为表头
      const isHeader = !out.some(s => s.includes('<tr>'));
      const cellTag = isHeader ? 'th' : 'td';
      const style = isHeader ? 'background:#3b82f6;color:#fff;padding:8px;text-align:left;' : 'padding:6px;border:1px solid #e5e7eb;';
      out.push('<tr>' + cells.map(c => `<${cellTag} style="${style}">${escapeHtml(c)}</${cellTag}>`).join('') + '</tr>');
      continue;
    } else if (inTable) {
      out.push('</table>'); inTable = false;
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      const sizes = ['28px', '24px', '20px', '18px', '16px', '14px'];
      const colors = ['#1e40af', '#1e3a8a', '#374151', '#374151', '#374151', '#374151'];
      out.push(`<h${lvl} style="font-size:${sizes[lvl-1]};color:${colors[lvl-1]};margin:18px 0 10px;border-bottom:${lvl<=2?'2px solid #3b82f6':'none'};padding-bottom:${lvl<=2?'6px':'0'};">${escapeHtml(h[2])}</h${lvl}>`);
      continue;
    }
    // 无序列表(* / - / •) → 严格按用户要求:转换为对应数字序号 <ol> 十进制样式
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      if (!inOl) { closeLists(); out.push('<ol style="margin:6px 0 6px 24px;list-style-type:decimal;">'); inOl = true; }
      out.push(`<li style="margin:3px 0;">${escapeHtml(ul[1])}</li>`);
      continue;
    }
    // 有序列表 1. 2. 3. → 同样数字序号 <ol>
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (!inOl) { closeLists(); out.push('<ol style="margin:6px 0 6px 24px;list-style-type:decimal;">'); inOl = true; }
      out.push(`<li style="margin:3px 0;">${escapeHtml(ol[1])}</li>`);
      continue;
    }
    // 空行
    if (!line.trim()) { closeLists(); continue; }
    // 段落
    closeLists();
    // 加粗
    const html = escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out.push(`<p style="margin:6px 0;line-height:1.7;font-size:14px;">${html}</p>`);
  }
  if (inTable) out.push('</table>');
  closeLists();
  const body = out.join('\n');
  const css = `body{font-family:"Microsoft YaHei","SimSun",Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:900px;margin:30px auto;padding:0 20px;}
h1,h2{color:#1e40af;} table{margin:10px 0;} .footer{margin-top:30px;padding-top:10px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;text-align:center;}
.header{background:linear-gradient(135deg,#3b82f6,#1e40af);color:white;padding:16px 20px;border-radius:8px;margin-bottom:20px;}`;
  if (forWord) {
    // Word 兼容的 HTML(带 xmlns 命名空间)
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="UTF-8"/><title>${escapeHtml(projectName)} AI 分析报告</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head>
<body>
<div class="header"><h1 style="margin:0;font-size:24px;color:white;">${escapeHtml(projectName)} 工程咨询分析报告</h1><div style="margin-top:4px;font-size:13px;opacity:0.9;">生成时间:${new Date().toLocaleString('zh-CN')}</div></div>
${body}
<div class="footer">由「中航建科·工程咨询管理平台」AI 智能生成</div>
</body></html>`;
  }
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(projectName)} AI 分析报告</title><style>${css}</style></head><body>
<div class="header"><h1 style="margin:0;font-size:24px;color:white;">${escapeHtml(projectName)} 工程咨询分析报告</h1><div style="margin-top:4px;font-size:13px;opacity:0.9;">生成时间:${new Date().toLocaleString('zh-CN')}</div></div>
${body}
<div class="footer">由「中航建科·工程咨询管理平台」AI 智能生成</div>
</body></html>`;
}

const ProjectEntryPage: React.FC<ProjectEntryPageProps> = ({
  projects, currentUser, userDisplay, isAdmin, userRole,
  onSelectProject, onLogout, onAiSubmit, onCreateProject, onRenameProject, onUpdateProject, onSaveProject, onBack
}) => {
  const light = typeof document !== 'undefined' && document.documentElement.dataset.theme !== 'dark';
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
  const [editForm, setEditForm] = useState({ overview: '', area: '', scale: '', investment: '', pipeline: '', aiReport: '', structureType: '', landArea: '', floorHeight: '', floors: '', custom: [] as {key:string;value:string}[] });
  const [editName, setEditName] = useState('');
  const [projectDocs, setProjectDocs] = useState<{ fileName: string; data: string; size: number; parsedText?: string; parsing?: boolean; progress?: ParseProgress }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  // v5.6: 删除项目二次确认 Modal 状态 (仅 isAdmin 可见)
  const [deleteTarget, setDeleteTarget] = useState<ProjectInfo | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  // 项目未解决问题计数（从后端真实数据聚合，替代原基于名称哈希的模拟告警数）
  const [projectAlerts, setProjectAlerts] = useState<Record<string, number>>({});
  // v5.7 迭代4: 项目成员管理对话框
  const [membersProject, setMembersProject] = useState<{ id: number; name: string } | null>(null);

  // 加载各项目未解决问题数（无 mock 兜底，加载失败不显示告警角标）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log('[ProjectEntry] 加载项目告警计数 → backend: /api/mobile/issue/list');
        const issues: DesktopIssue[] = await fetchAllIssues();
        if (cancelled || !Array.isArray(issues)) return;
        // 聚合各项目未关闭问题数（status 不属于已解决/已关闭视为未解决）
        const CLOSED_STATUSES = ['resolved', 'closed', '已完成', '已解决', '关闭', 'done'];
        const counts: Record<string, number> = {};
        for (const iss of issues) {
          if (!iss.projectName) continue;
          const st = (iss.status || '').toLowerCase();
          if (CLOSED_STATUSES.some(s => st === s)) continue;
          counts[iss.projectName] = (counts[iss.projectName] || 0) + 1;
        }
        console.log('[ProjectEntry] 告警计数加载完成', { totalIssues: issues.length, projectsWithAlerts: Object.keys(counts).length });
        if (!cancelled) setProjectAlerts(counts);
      } catch (e: any) {
        console.warn('[ProjectEntry] 告警计数加载失败（不注入 mock，隐藏告警角标）:', e?.message || e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // v5.6: 删除项目前置 — 只打开红色二次确认 Modal,不立刻执行
  // 真正执行在 doConfirmDelete 中,需:isAdmin + 确认文本 = DELETE-{项目名} + 按钮点击
  const handleDeleteProject = (projectName: string) => {
    if (!isAdmin) { toast('仅系统管理员可删除项目', 'error'); return; }
    const proj = projects.find(p => p.name === projectName);
    if (!proj) { toast('项目未找到', 'error'); return; }
    setDeleteTarget(proj);
    setDeleteConfirmText('');
    setDeleteLoading(false);
  };

  const doConfirmDelete = async () => {
    if (!deleteTarget || !isAdmin) return;
    const expected = `DELETE-${deleteTarget.name}`;
    if (deleteConfirmText.trim() !== expected) {
      toast(`请在输入框中准确输入「${expected}」以确认删除`, 'warning');
      return;
    }
    setDeleteLoading(true);
    const targetName = deleteTarget.name;
    try {
      // 1) 后端 20+ 张表级联事务删除 (v5.6: ghost 项目返回 phantom=true,跳过后端删除但继续本地清理)
      const result = await api.deleteProjectApi(targetName);
      const isPhantom = !!(result as any).phantom;
      // 2) Neo4j 知识图谱节点清理 (仅非 phantom 时执行,避免无效 API 调用)
      if (!isPhantom) {
        try { await api.deleteProjectKGNodes(targetName); } catch (_) { /* noop */ }
      }
      // 3) 本地 localStorage 精确前缀清理 (不伤其他项目)
      const keysToRemove = collectKeysForTarget(targetName);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('doc-mgmt-projects-')) {
          try {
            const v = JSON.parse(localStorage.getItem(k) || '[]');
            if (Array.isArray(v)) localStorage.setItem(k, JSON.stringify(v.filter((x: any) => (x.name || '') !== targetName)));
          } catch {}
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('knowledge-graph');
      // 4) 向量库按项目分区清理
      try {
        const { vectorStore } = await import('../data/vectorStore');
        try { vectorStore.removeByPrefix('daily', targetName); } catch (_) {}
        try { vectorStore.removeByPrefix('issue', targetName); } catch (_) {}
        try { vectorStore.removeByPrefix('exp', targetName); } catch (_) {}
      } catch (_) { /* 离线场景 vectorStore 不可用,跳过 */ }
      // 5) v5.7 FIX: 删除后用 API 最新列表覆盖 localStorage
      //    即使 fetchProjects 失败, 上面的 localStorage 遍历清理已保证正确
      if (typeof window !== 'undefined') {
        try {
          const fresh = await api.fetchProjects();
          // 用 API 返回的最新列表更新所有标准的项目列表 key
          // 这样即使 document-management-standard 值变化, 所有 key 都会被正确更新
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('doc-mgmt-projects-')) {
              localStorage.setItem(k, JSON.stringify(fresh));
            }
          }
        } catch (_) {
          // fetchProjects 失败不阻断, localStorage 清理已在上面完成
          // 但为了确保正确, 再次遍历清理一次
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('doc-mgmt-projects-')) {
              try {
                const v = JSON.parse(localStorage.getItem(k) || '[]');
                if (Array.isArray(v)) localStorage.setItem(k, JSON.stringify(v.filter((x: any) => (x.name || '') !== targetName)));
              } catch {}
            }
          }
        }
      }
      // 6) 通知用户
      const count = Object.keys(result.deletedCounts || {}).length;
      if (isPhantom) {
        toast(`项目「${targetName}」仅存在于本地缓存,已彻底清理本地所有残留数据`, 'success');
      } else {
        toast(`项目「${targetName}」已彻底删除 (共清理 ${count} 类数据)`, 'success');
      }
      setDeleteTarget(null);
      setDeleteConfirmText('');
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      toast('删除失败: ' + (e.message || '后端未响应'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

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

  // 主题样式
  const t = {
    bg: light ? 'bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 m-0 p-0' : 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 m-0 p-0',
    searchBg: light ? 'bg-blue-50/30 border-2 border-blue-300 text-slate-800 shadow-sm' : 'bg-blue-900/20 backdrop-blur-xl border-2 border-blue-400/30 text-white placeholder:text-blue-300 shadow-lg',
    searchPh: light ? 'placeholder:text-blue-400 placeholder:font-medium' : 'placeholder:text-blue-300',
    card: light ? 'bg-white shadow-md border border-gray-200 hover:shadow-lg hover:border-gray-300' : 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-400/30 hover:bg-white/10',
    cardTitle: light ? 'text-slate-800' : 'text-white',
    cardDate: light ? 'text-slate-400' : 'text-blue-300/50',
    cardIconBg: light ? 'bg-blue-50 group-hover:bg-blue-100' : 'bg-blue-500/20 group-hover:bg-blue-500/30',
    cardIcon: light ? 'text-blue-500' : 'text-blue-400',
    cardArrow: light ? 'text-slate-300 group-hover:text-blue-500' : 'text-blue-400/30 group-hover:text-blue-400',
    moreBtn: light ? 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50 shadow-sm' : 'bg-white/5 backdrop-blur-xl border border-white/10 text-blue-300 hover:bg-white/10 hover:border-blue-400/30 shadow-lg',
    emptyIcon: light ? 'text-slate-300' : 'text-blue-400/30',
    emptyTitle: light ? 'text-slate-600' : 'text-blue-200',
    emptyDesc: light ? 'text-slate-400' : 'text-blue-300/50',
    aiBar: light ? 'bg-gradient-to-r from-blue-100 via-slate-200 to-blue-100' : 'bg-white/5 backdrop-blur-xl',
    aiLabel: light ? 'text-blue-700 font-semibold' : 'text-blue-300',
    aiIcon: light ? 'text-sky-500' : 'text-blue-400',
    aiInput: light ? 'bg-white border-transparent text-slate-800 focus:border-blue-400/50' : 'bg-white/5 backdrop-blur-xl border border-white/10 text-white placeholder:text-blue-300/40 focus:bg-white/10',
    aiBtn: light ? 'bg-sky-500 hover:bg-sky-600' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30',
    aiBtnDisabled: light ? 'bg-gray-300' : 'bg-white/10 text-blue-300/30',
    filterCount: light ? 'text-slate-500' : 'text-blue-300',
    filterIcon: light ? 'text-blue-500' : 'text-blue-400',
    createBtn: light ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30',
    toggleBtn: light ? 'text-slate-500 hover:text-slate-700 hover:bg-gray-100' : 'text-blue-300/70 hover:text-white hover:bg-white/10',
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
      {/* 顶部导航 — 与全局顶栏统一样式 */}
      <header className="bg-slate-300/70 backdrop-blur-md shadow-sm border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/zhjk-logo.png" alt="中航建科" className="h-9 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">全过程工程咨询管理服务平台</h1>
              <p className="text-xs text-[var(--text-secondary)]">项目管理入口 · 全局模式 — 选择项目进入详情</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 管理入口 */}
            <button onClick={() => { if (isAdmin) toast('管理后台功能开发中', 'info'); }}
              className={`p-2 rounded-lg transition-colors ${isAdmin ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10' : 'text-slate-300 cursor-not-allowed opacity-40'}`}
              title={isAdmin ? '系统管理' : '仅管理员可用'}>
              <Settings className="w-4 h-4" />
            </button>
            <span className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
              <User className="w-4 h-4" /> {userDisplay || currentUser}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isAdmin ? (light ? 'bg-red-100 text-red-700' : 'bg-red-500/30 text-red-200') : (light ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/30 text-blue-200')}`}>
              {isAdmin ? '管理员' : userRole === 'project_manager' ? '项目经理' : userRole === 'construction_unit' ? '建设单位' : '用户'}
            </span>
            <button onClick={() => onBack ? onBack() : onLogout()} className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${light ? 'text-slate-600 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}>
              <ArrowRight className="w-4 h-4" /> 返回
            </button>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* 搜索栏 + 项目总数 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
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
            const alertCount = projectAlerts[proj.name] || 0;
            const progress = getProjectProgress(proj.name);
            const pct = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 0;
            return (
            <div
              key={proj.name}
              className={`rounded-xl p-5 text-left hover:-translate-y-0.5 transition-all duration-200 group relative cursor-pointer ${t.card}`}
              onClick={() => onSelectProject(proj.name)}
            >
              {alertCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse px-1.5">
                  {alertCount}
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
                        className={`text-sm font-semibold border-b-2 border-blue-400 bg-transparent outline-none px-1 w-40 ${light ? 'text-slate-800' : 'text-white'}`} autoFocus />
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
                        <span className={`text-[11px] ${light ? 'text-slate-500' : 'text-blue-300/60'}`}>指南 {progress.done}/{progress.total}</span>
                        <div className={`flex-1 h-1.5 rounded-full ${light ? 'bg-gray-200' : 'bg-white/10'}`}>
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-[10px] font-medium ${pct >= 80 ? 'text-green-500' : pct >= 40 ? 'text-blue-500' : 'text-slate-400'}`}>{pct}%</span>
                      </div>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ml-10 ${t.cardDate}`}>创建于 {proj.createdAt}</p>
                </div>
                <div className="flex items-center gap-1 mt-2">
                {isAdmin && (
                  <button onClick={e => { e.stopPropagation(); handleDeleteProject(proj.name); }}
                    className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition" title="删除项目">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && proj.id && (
                  <button onClick={e => { e.stopPropagation(); setMembersProject({ id: proj.id!, name: proj.name }); }}
                    className="p-1 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 transition"
                    title="项目成员管理">
                    <Users className="w-4 h-4" />
                  </button>
                )}
                <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-all ${t.cardArrow}`} />
              </div>
              </div>
              {/* 编辑按钮（右下角隐蔽） */}
              <button onClick={e => {
                e.stopPropagation();
                setEditTarget(proj);
                setEditName(proj.name);
                const d = proj.details || {};
                setEditForm({ overview: d.overview || '', area: d.area || '', scale: d.scale || '', investment: d.investment || '', pipeline: d.pipeline || '', aiReport: d.aiReport || '', structureType: d.structureType || '', landArea: d.landArea || '', floorHeight: d.floorHeight || '', floors: d.floors || '', custom: d.customFields || [] });
                setProjectDocs((d.projectDocs || []).map((doc: any) => ({ fileName: doc.fileName, data: '', size: 0, parsedText: doc.parsedText })));
                setShowEditModal(true);
              }}
                className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-all"
                title="编辑项目信息">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {/* v5.7 迭代4: 成员管理按钮（隐蔽，admin 可见） */}
              {isAdmin && proj.id && (
                <button onClick={e => { e.stopPropagation(); setMembersProject({ id: proj.id!, name: proj.name }); }}
                  className="absolute bottom-3 right-14 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-all"
                  title="成员管理">
                  <Users className="w-3.5 h-3.5" />
                </button>
              )}
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

      {/* AI 对话框 — 底端深蓝渐变毛玻璃+背景图 */}
      <div className={`backdrop-blur-xl py-4 border-t w-full ${t.aiBar}`}
        style={{ backgroundImage: 'url(/project-header-bg.png)', backgroundSize: 'cover', backgroundPosition: 'bottom', filter: 'brightness(0.9)', margin: 0 }}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${t.aiIcon}`} />
              <span className={`text-xs font-medium ${t.aiLabel}`}>全过程工程咨询 AI 助手</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">| DeepSeek v4.0 Pro</span>
            </div>
            {/* 模型选择 */}
            <div className="relative">
              <button onClick={() => setShowModelMenu(!showModelMenu)}
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${light ? 'border-gray-300 text-slate-500' : 'border-white/20 text-blue-300'}`}>
                {aiModel} <ChevronDown className="w-3 h-3" />
              </button>
              {showModelMenu && (
                <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-xl border z-50 p-1 min-w-[160px] ${light ? 'bg-white border-gray-200' : 'bg-gray-800 border-white/10'}`}>
                  {['deepseek-v4-pro', 'deepseek-v3', 'gpt-4o', 'qwen-max'].map(m => (
                    <button key={m} onClick={() => { setAiModel(m); localStorage.setItem('ai-model', m); setShowModelMenu(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-xs rounded ${aiModel === m ? (light ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300') : (light ? 'text-slate-600 hover:bg-gray-50' : 'text-slate-300 hover:bg-white/5')}`}>
                      {m}
                    </button>
                  ))}
                  <div className={`border-t my-1 ${light ? 'border-gray-100' : 'border-white/10'}`} />
                  <button onClick={() => { setShowModelMenu(false); toast('模型通过 /login 命令配置', 'info'); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs rounded ${light ? 'text-slate-400' : 'text-slate-500'}`}>
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
              <label className={`cursor-pointer p-1 rounded hover:bg-white/10 transition-colors ${light ? 'text-slate-400 hover:text-blue-500' : 'text-blue-300/60 hover:text-blue-300'}`} title="上传文件">
                <Paperclip className="w-3.5 h-3.5" />
                <input type="file" className="hidden" multiple onChange={(e) => {
                  if (e.target.files) setAiFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }} />
              </label>
              <label className={`cursor-pointer p-1 rounded hover:bg-white/10 transition-colors ${light ? 'text-slate-400 hover:text-blue-500' : 'text-blue-300/60 hover:text-blue-300'}`} title="上传图片">
                <Image className="w-3.5 h-3.5" />
                <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => {
                  if (e.target.files) setAiFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }} />
              </label>
              {/* 上下文长度 */}
              <span className={`flex items-center gap-1 text-[10px] ${light ? 'text-slate-400' : 'text-blue-300/50'}`} title={`上下文长度：${aiQuery.length} 字符`}>
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
      </div>{/* 关闭 AI bar */}

      {/* ========== 项目编辑弹窗 ========== */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">编辑项目信息</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* 项目名称 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">项目名称</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="请输入项目名称"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" />
              </div>
              {/* 项目概况文件上传 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">项目概况文件</label>
                  <label className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" /> 上传文件
                    <input type="file" className="hidden" multiple onChange={async (e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const MAX_SIZE = 10 * 1024 * 1024;
                      const validFiles: File[] = [];
                      for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        if (f.size > MAX_SIZE) { toast(`文件"${f.name}"超过10MB限制`, 'warning'); continue; }
                        validFiles.push(f);
                      }
                      if (validFiles.length === 0) { e.target.value = ''; return; }

                      // v5.6: 并行处理所有文件 — Promise.all
                      // 第一步:并行读取所有文件的 DataURL
                      const dataUrls = await Promise.all(validFiles.map(f => new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => resolve(r.result as string);
                        r.onerror = reject;
                        r.readAsDataURL(f);
                      })));

                      // 第二步:先在 projectDocs 中占位(parsing=true,初始进度)
                      const startIdx = projectDocs.length;
                      setProjectDocs(prev => [...prev, ...validFiles.map((f, i) => ({
                        fileName: f.name,
                        data: dataUrls[i],
                        size: f.size,
                        parsing: true,
                        progress: { stage: 'read' as const, percent: 5, message: '准备读取文件…' } as ParseProgress,
                      }))]);

                      // 第三步:并行启动解析任务,每个文件独立 onProgress 回调
                      await Promise.all(validFiles.map(async (f, i) => {
                        const docIdx = startIdx + i;  // 该文件在 projectDocs 中的固定索引
                        try {
                          const text = await parseDocument(f, (p) => {
                            setProjectDocs(prev => prev.map((d, idx) =>
                              idx === docIdx ? { ...d, progress: p } : d
                            ));
                          });
                          setProjectDocs(prev => prev.map((d, idx) => (idx === docIdx)
                            ? { ...d, parsedText: text.slice(0, 50000), parsing: false,
                                progress: { stage: 'done', percent: 100, message: `解析完成,提取 ${text.length} 字` } }
                            : d));
                          toast(`已解析"${f.name}"，提取${(text || '').length}字`, 'success');
                        } catch (err: any) {
                          setProjectDocs(prev => prev.map((d, idx) => (idx === docIdx)
                            ? { ...d, parsing: false,
                                progress: { stage: 'error', percent: 100, message: `解析失败: ${err?.message || '未知错误'}` } }
                            : d));
                          toast(`解析"${f.name}"失败: ${err?.message || '未知错误'}`, 'warning');
                        }
                      }));
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
                        <div key={`old-${originalIdx}`} className="flex items-center gap-2 text-[11px] text-slate-500 bg-gray-50 rounded px-2 py-1.5">
                          <Paperclip className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {doc.fileName}
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">（已有文件）</span>
                          {doc.parsedText ? (
                            <span className="ml-1 flex items-center gap-1 text-[10px] text-emerald-600">
                              <FileText className="w-3 h-3" /> {doc.parsedText.length}字
                            </span>
                          ) : null}
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
                      const hasText = !!doc.parsedText;
                      const p = doc.progress;
                      const isError = p?.stage === 'error';
                      const isDone = p?.stage === 'done' || hasText;
                      const stageLabel = p ? ({
                        read: '读取', encode: '编码', transfer: '传输',
                        parse: p.stage === 'parse' && doc.fileName.match(/\.(png|jpg|jpeg|bmp|tiff?)$/i) ? 'OCR' : '解析',
                        done: '完成', error: '失败'
                      } as Record<string, string>)[p.stage] || '处理' : '处理';
                      const stageColor = isError ? 'text-red-600' : isDone ? 'text-emerald-600' : 'text-blue-600';
                      return (
                        <div key={`new-${idx}`} className="bg-blue-50 rounded px-2 py-1.5 group/att">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Paperclip className="w-3 h-3 text-blue-500" /> {doc.fileName}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">({(doc.size / 1024).toFixed(0)}KB) · {currentUser} · {new Date().toLocaleDateString('zh-CN')}</span>
                            {doc.parsing ? (
                              <span className={`ml-1 flex items-center gap-1 text-[10px] ${stageColor}`}>
                                <Loader className="w-3 h-3 animate-spin" /> {stageLabel} {p?.percent || 0}%
                              </span>
                            ) : isDone ? (
                              <span className="ml-1 flex items-center gap-1 text-[10px] text-emerald-600">
                                <FileText className="w-3 h-3" /> {doc.parsedText!.length}字
                              </span>
                            ) : isError ? (
                              <span className="ml-1 text-[10px] text-red-600">失败</span>
                            ) : (
                              <span className="ml-1 text-[10px] text-slate-400">未解析</span>
                            )}
                            <button onClick={() => setProjectDocs(prev => prev.filter((_, i) => i !== idx))}
                              className="ml-auto opacity-0 group-hover/att:opacity-100 p-0.5 text-red-400 hover:text-red-600 rounded transition-opacity">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {/* v5.6: 进度条 */}
                          {doc.parsing && p && !isError && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300"
                                  style={{ width: `${p.percent}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-500 min-w-[80px] text-right">
                                {p.message}{p.elapsedMs ? ` · ${(p.elapsedMs / 1000).toFixed(1)}s` : ''}
                              </span>
                            </div>
                          )}
                          {isError && p && (
                            <div className="mt-1 text-[10px] text-red-500 pl-0.5">{p.message}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {projectDocs.length === 0 && (
                  <p className="text-[10px] text-slate-400 pl-0.5">上传项目概况文档后，AI 可根据文档内容自动填充下方字段</p>
                )}
              </div>

              {/* AI 按钮组 */}
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  setAiLoading(true);
                  try {
                    // ========== 构造文档正文上下文 ==========
                    const parsedDocs = projectDocs.filter(d => !!d.parsedText && d.parsedText!.length > 0);
                    let docContext = '';
                    if (parsedDocs.length > 0) {
                      docContext = parsedDocs.map((d, i) =>
                        `===== 【文件${i + 1}】${d.fileName} =====\n${d.parsedText!}`
                      ).join('\n\n');
                    }
                    // v5.7 迭代3: 检索向量知识库，补充项目所有已入库文档（全域 AI 能力依赖知识库）
                    try {
                      const kbDocs = vectorStore.getByProject(editName);
                      if (kbDocs.length > 0) {
                        const kbContext = kbDocs.slice(0, 20).map((d: VectorDoc, i: number) =>
                          `===== 【知识库${i + 1}】${d.metadata?.fileName || ''} =====\n${d.text?.slice(0, 800) || ''}`
                        ).join('\n\n');
                        docContext = docContext ? `${docContext}\n\n${kbContext}` : kbContext;
                        console.log(`[AI 自动填写] 知识库补充: ${kbDocs.length} 条已入库文档`);
                      }
                    } catch (e) {
                      console.warn('[AI 自动填写] 知识库检索失败:', e);
                    }
                    // 若有文档但无解析文本,直接终止(避免空 context 误导 AI)
                    const hasDocs = projectDocs.filter(d => !!d.data).length > 0;
                    const noTextDocs = hasDocs && parsedDocs.length === 0 && docContext.length === 0;
                    if (noTextDocs) {
                      toast('文档解析中或解析失败，无可用文本内容。请等待解析完成或重新上传', 'warning');
                      setAiLoading(false);
                      return;
                    }

                    // ========== 构造强约束提示词 ==========
                    const systemPrompt = `你是一个建筑工程项目信息提取助手。你的任务是从提供的文档文本中准确提取结构化数据，或在无文档时基于项目名进行合理推断。

【输出格式要求 — 严格遵守】
必须输出 **纯 JSON**，**不要**包含 markdown 代码块标记、不要解释、不要前缀、不要注释，只输出 JSON 对象。
JSON 的键名和类型严格如下：
{
  "area": "string — 建筑面积，含具体数值和单位，例如：'约18000平方米'、'22,000㎡（含教学楼、食堂）'。如文档中有多个数字，写完整描述。若找不到则写 null",
  "investment": "string — 总投资/估算投资/概算金额，含具体数值和单位（万元/元/亿），例如：'约1.85亿元'、'总投资12800万元（含建安工程费）'。如找不到则写 null",
  "scale": "string — 建设规模，如学校：'36班完全小学，容纳学生约1620人'；如建筑：'地上12层地下2层'；如道路：'主干路全长3.2km双向六车道'。尽可能量化，若找不到则写 null",
  "pipeline": "string — 市政管线配套信息，如水电气暖、雨污分流、通信、综合管廊、红线宽度、道路等级等。若找不到则写 null",
  "structureType": "string — 主体结构形式，如框架结构、框架-剪力墙、剪力墙、钢结构、装配式钢筋混凝土、砖混等。若找不到则写 null",
  "landArea": "string — 用地面积/占地面积，含数值和单位，例如：'总用地面积35000㎡'、'占地3.5公顷'。若找不到则写 null",
  "floorHeight": "string — 层高，如'教学楼3.6m/综合楼3.9m/地下3.8m'。如只提及净高/层高，照原文输出。若找不到则写 null",
  "floors": "string — 层数，如'地上5层/地下1层'、'地上12层地下2层'。若找不到则写 null",
  "overview": "string — 100~200字的项目概况摘要，包含项目位置、建设单位、主要建设内容、建设目标/意义。若找不到则写 null"
}

【提取优先级与准确率规则】
1. **文档第一原则**：若提供了文档正文，**只从文档原文提取**，禁止脱离文档编造。文档中的数字和描述优先于任何常识推断。
2. **单位保留**：提取时保留原文单位（㎡ / 万元 / 亿元 / 公里等），不要换算。
3. **精确优先**：优先使用精确数字（如"18,500㎡"），只有找不到精确值时才用范围（"约18000-22000㎡"）。
4. **上下文补充**：如文档提及具体配套（教室/食堂/宿舍/管廊/雨污/充电桩等），一并写入对应字段，不要只写干巴巴数字。
5. **未找到字段**：确认文档中确实没有时才写 null，**不要用"XX平方米"占位格式**。
6. **金额关键词匹配**：注意识别以下关键词 — 总投资、估算投资、概算金额、工程总造价、合同金额、总造价、建设投资、建安费等。
7. **结构形式关键词**：框架、框剪、剪力墙、钢结构、装配式、砖混、木结构、钢筋混凝土、预应力等。
8. **层高/层数关键词**：建筑层数、地上X层、地下X层、层高、净高、建筑高度等。

最终只输出一个 JSON 对象，不要其他任何文本。`;

                    let userContent: string;
                    if (docContext) {
                      // 控制上下文长度（文档内容最多 15000 字符）,避免超长
                      const trimmedContext = docContext.length > 15000
                        ? docContext.slice(0, 15000) + `\n...【文档过长,仅展示前15000字,全文${docContext.length}字】`
                        : docContext;
                      userContent = `项目名称："${editName}"

【待提取的文档正文如下】:
${trimmedContext}

=== 请严格按照上方输出格式要求,从文档正文中提取 9 个字段的 JSON。只输出 JSON,不要任何其他内容。`;
                    } else {
                      userContent = `项目名称："${editName}"

⚠️ 未提供文档正文。请基于项目名称及该类项目的行业常识,合理推断填写字段,注意用"约XX"措辞,并在每个字段值中加上"（推断）"标识。
=== 请严格按照上方输出格式要求,输出 9 个字段的 JSON。只输出 JSON,不要任何其他内容。`;
                    }

                    // v5.7: 发送 AI 前记录文档摘要, 便于在浏览器控制台验证
                    const docHasArea = /\d+[,.\d]*\s*(?:平方米|㎡|m2|M2)/.test(docContext);
                    const docHasInvestment = /(?:投资|估算|概算|造价)\s*[:：]?\s*\d/.test(docContext);
                    const docHasScale = /(?:规模|班|层|人)/.test(docContext);
                    const docPreview = docContext.slice(0, 200).replace(/\n/g, '\\n');
                    console.log(`[AI 自动填写] 发送前验证: docLen=${docContext.length}, 含面积=${docHasArea}, 含投资=${docHasInvestment}, 含规模=${docHasScale}`);
                    console.log(`[AI 自动填写] 文档预览前200字: ${docPreview}...`);

                    const reply = await api.aiChat([
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: userContent }
                    ], '', { model: 'auto', temperature: docContext ? 0.2 : 0.6 });

                    // ========== 严格 JSON 解析 + 多层回退 ==========
                    // v5.6: 增加嵌套对象深度查找 + 中文键名映射 + 调试日志
                    const fieldMap: Record<string, keyof typeof editForm> = {
                      area: 'area', investment: 'investment', scale: 'scale',
                      pipeline: 'pipeline', structureType: 'structureType',
                      landArea: 'landArea', floorHeight: 'floorHeight',
                      floors: 'floors', overview: 'overview',
                    };
                    const fieldMapKeys = Object.keys(fieldMap);

                    // 中文→英文键名映射(AI偶尔返回中文键)
                    const cnKeyMap: Record<string, string> = {
                      '建筑面积': 'area', '总建筑面积': 'area', '面积': 'area',
                      '总投资': 'investment', '投资': 'investment', '概算': 'investment', '造价': 'investment', '估算投资': 'investment',
                      '建设规模': 'scale', '规模': 'scale',
                      '管线': 'pipeline', '市政配套': 'pipeline',
                      '结构': 'structureType', '结构形式': 'structureType',
                      '用地面积': 'landArea', '占地面积': 'landArea', '用地': 'landArea',
                      '层高': 'floorHeight', '净高': 'floorHeight',
                      '层数': 'floors', '楼层': 'floors',
                      '项目概况': 'overview', '概况': 'overview', '简介': 'overview', '概述': 'overview',
                    };

                    // 嵌套对象查找:在常见 wrapper 中递归搜索目标键
                    const unwrapNested = (obj: any): any => {
                      if (!obj || typeof obj !== 'object') return obj;
                      // 直接包含目标键
                      const keys = Object.keys(obj);
                      const hasTarget = fieldMapKeys.some(k => k in obj) || Object.keys(cnKeyMap).some(k => k in obj);
                      if (hasTarget && keys.length <= fieldMapKeys.length + 5) return obj;
                      // 常见 wrapper key
                      const wrappers = ['data', 'projectInfo', 'project_info', 'result', 'results', 'extracted', 'info', 'payload', 'project'];
                      for (const w of wrappers) {
                        if (w in obj && typeof obj[w] === 'object' && obj[w] !== null) {
                          const nested = unwrapNested(obj[w]);
                          if (nested && nested !== obj) return nested;
                        }
                      }
                      return obj;
                    };

                    let extracted: any = null;
                    const raw = (reply || '').trim();
                    console.log('[AI 自动填写] docContext length:', docContext.length, 'parsedDocs:', parsedDocs.length, 'raw reply length:', raw.length);
                    console.log('[AI 自动填写] raw reply:', raw.slice(0, 500));

                    // 1) 直接解析
                    try { extracted = JSON.parse(raw); } catch { /* noop */ }
                    // 2) 去除 ```json 包裹
                    if (!extracted) {
                      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                      try { extracted = JSON.parse(stripped); } catch { /* noop */ }
                    }
                    // 3) 提取首个 { ... } 块
                    if (!extracted) {
                      const m = raw.match(/\{[\s\S]*\}/);
                      if (m) try { extracted = JSON.parse(m[0]); } catch { /* noop */ }
                    }
                    // 4) 嵌套对象解包
                    if (extracted && typeof extracted === 'object') {
                      extracted = unwrapNested(extracted);
                    }
                    console.log('[AI 自动填写] extracted after unwrap:', JSON.stringify(extracted).slice(0, 500));

                    const form: any = { ...editForm };
                    let filledCount = 0;
                    // v5.7: 精确占位符检测 —— 只拒绝明确的无效值,不误杀有效内容
                    const placeholderPattern = /^(null|n\/a|none|无|未找到|未提供|待补充|未知|暂无|无数据|不适用)$/i;
                    const isMeaningful = (v: any): boolean => {
                      if (v === null || v === undefined) return false;
                      if (typeof v === 'string') {
                        const s = v.trim();
                        if (!s) return false;
                        // 仅拒绝明确的占位符(精确匹配),不做模糊包含匹配
                        if (placeholderPattern.test(s)) return false;
                        // 拒绝纯占位符格式如 "XX"、"xxx"、"-"
                        if (/^[x\-*#]{1,3}$/i.test(s)) return false;
                        if (s.length <= 1 && !/\d/.test(s)) return false;
                        return true;
                      }
                      if (typeof v === 'number' && !isNaN(v)) return true;
                      if (typeof v === 'boolean') return true;
                      return false;
                    };

                    if (extracted && typeof extracted === 'object') {
                      // 优先按英文键匹配
                      for (const [k, fieldKey] of Object.entries(fieldMap)) {
                        if (!isMeaningful((extracted as any)[k])) {
                          // 再尝试中文键名
                          const cnKey = Object.entries(cnKeyMap).find(([cn, en]) => en === k && isMeaningful((extracted as any)[cn]));
                          if (cnKey) {
                            (form as any)[fieldKey] = String((extracted as any)[cnKey[0]]).trim();
                            filledCount++;
                          }
                        } else {
                          (form as any)[fieldKey] = String((extracted as any)[k]).trim();
                          filledCount++;
                        }
                      }
                    } else {
                      // 5) 最后回退:按行解析(兼容旧版输出 / 自然语言格式)
                      const lines = raw.split('\n');
                      for (const line of lines) {
                        const cleaned = line.replace(/^[-*•]\s*/, '').replace(/\*?\*(.+?)\*?\*/g, '$1');
                        const cnMatch = cleaned.match(/^([^:：]+)[:：]\s*(.+)/);
                        if (cnMatch) {
                          const cn = cnMatch[1].trim();
                          const val = cnMatch[2].trim();
                          const enKey = cnKeyMap[cn];
                          if (enKey && isMeaningful(val)) {
                            (form as any)[fieldMap[enKey]] = val;
                            filledCount++;
                          }
                        } else {
                          if (cleaned.includes('面积') && !form.area) form.area = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                          else if (cleaned.includes('规模') && !form.scale) form.scale = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                          else if ((cleaned.includes('投资') || cleaned.includes('金额')) && !form.investment) form.investment = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                          else if ((cleaned.includes('管线') || cleaned.includes('市政')) && !form.pipeline) form.pipeline = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                          else if ((cleaned.includes('概况') || cleaned.includes('概述') || cleaned.includes('简介')) && !form.overview) form.overview = cleaned.split(/[：:]/).pop()?.trim() || cleaned;
                        }
                      }
                    }
                    console.log('[AI 自动填写] filledCount:', filledCount, 'form keys with values:', Object.entries(form).filter(([,v]) => v && String(v).trim()).map(([k,v]) => `${k}=${String(v).slice(0,30)}`).join(', '));
                    setEditForm(form);
                    toast(`AI 提取完成，共填充 ${filledCount} 个字段${filledCount === 0 ? '（未提取到有效内容，建议补充文档后重试）' : ''}`, filledCount > 2 ? 'success' : 'warning');
                  } catch (err: any) {
                    console.error('[AI 自动填写异常]', err);
                    toast(`AI填充失败: ${err?.message || '未知错误'}`, 'error');
                  }
                  finally { setAiLoading(false); }
                }} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 text-sm font-medium disabled:opacity-50">
                  {aiLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  AI 自动填写
                </button>
                <button onClick={async () => {
                  setAiLoading(true);
                  try {
                    // v5.6: 优化为 Markdown 结构化分段报告
                    const docContext = projectDocs.filter(d => !!d.parsedText).map((d, i) => `【文档${i+1}: ${d.fileName}】\n${d.parsedText!.slice(0, 6000)}`).join('\n\n');
                    const sysPrompt = `你是一位全过程工程咨询专家。请基于以下项目信息,生成一份专业、结构化、Markdown 格式的分析报告。

【输出格式 — 严格 Markdown,6 个章节,严禁省略】
# ${'$'}{项目名} 工程咨询分析报告

## 一、项目概况
- 项目位置/建设单位/主要建设内容/建设规模/投资额/结构形式/层数等(列点呈现,无数据写"待补充")

## 二、风险分析
**2.1 技术风险**
- (3-5条具体风险,每条含风险描述 + 影响等级[高/中/低] + 应对措施)

**2.2 管理风险**
- (3-5条,同上格式)

**2.3 外部风险**
- (政策/市场/环境/施工条件等 2-4条)

## 三、进度评估
- 关键节点识别(开工/基础/主体/装饰/竣工)
- 关键线路分析
- 进度风险与建议(3条)

## 四、成本优化建议
| 优化方向 | 具体建议 | 预期效益 |
|---------|---------|---------|
| 设计 | ... | ... |
| 招标 | ... | ... |
| 施工 | ... | ... |
(至少3行,每行具体可执行)

## 五、质量控制要点
- **设计阶段**:2-3条要点
- **施工阶段**:3-5条要点
- **验收阶段**:2-3条要点

## 六、结论与建议
(200字以内总结 + 3条核心建议)

【规则】
1. 若提供了文档正文,**优先引用文档原文数据**,不要编造。
2. 表格必须用 Markdown 语法(用 | 分隔)。
3. 每章节字数控制在 200-500 字,总字数 1500-3000 字。
4. 输出纯 Markdown,不要包裹在代码块中。`;

                    const userInfo = `项目名称:${editName}
项目概况:${editForm.overview || '待补充'}
建筑面积:${editForm.area || '待补充'}
建设规模:${editForm.scale || '待补充'}
投资额:${editForm.investment || '待补充'}
市政管线:${editForm.pipeline || '待补充'}
结构形式:${editForm.structureType || '待补充'}
用地面积:${editForm.landArea || '待补充'}
层高:${editForm.floorHeight || '待补充'}
层数:${editForm.floors || '待补充'}
${docContext ? `\n【项目文档正文】\n${docContext}` : '\n(未提供项目文档,请基于已有信息合理推断,在结论中标注"基于现有信息")'}`;

                    const reply = await api.aiChat([
                      { role: 'system', content: sysPrompt },
                      { role: 'user', content: userInfo }
                    ], '', { model: 'auto', temperature: 0.4 });
                    setEditForm(p => ({ ...p, aiReport: reply }));
                    toast('AI 分析报告已生成,可下载为 TXT/HTML/DOCX', 'success');
                  } catch (err: any) {
                    toast(`AI分析失败: ${err?.message || '未知错误'}`, 'error');
                  }
                  finally { setAiLoading(false); }
                }} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 text-sm font-medium disabled:opacity-50">
                  <Sparkles className="w-4 h-4" />
                  AI 分析报告
                </button>
                {editForm.aiReport && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => {
                      const blob = new Blob(['\uFEFF' + editForm.aiReport], { type: 'text/plain;charset=utf-8' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                      a.download = `${editName}_AI分析报告.txt`; a.click();
                    }} title="导出 TXT 纯文本"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs rounded-lg hover:bg-slate-100">
                      <Download className="w-3.5 h-3.5" /> TXT
                    </button>
                    <button onClick={() => {
                      const html = markdownToHtml(editForm.aiReport, editName);
                      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                      a.download = `${editName}_AI分析报告.html`; a.click();
                    }} title="导出 HTML 网页"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs rounded-lg hover:bg-slate-100">
                      <Download className="w-3.5 h-3.5" /> HTML
                    </button>
                    <button onClick={() => {
                      const html = markdownToHtml(editForm.aiReport, editName, true);
                      const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                      a.download = `${editName}_AI分析报告.doc`; a.click();
                    }} title="导出 DOCX (Word 兼容)"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs rounded-lg hover:bg-slate-100">
                      <Download className="w-3.5 h-3.5" /> DOCX
                    </button>
                  </div>
                )}
              </div>

              {/* 项目概况 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">项目概况</label>
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
                  { key: 'structureType', label: '结构形式', placeholder: '如 框架/框剪/钢结构' },
                  { key: 'landArea', label: '用地面积', placeholder: '如 35000㎡（占地）' },
                  { key: 'floorHeight', label: '层高', placeholder: '如 教学楼3.6m/办公楼3.3m' },
                  { key: 'floors', label: '层数', placeholder: '如 地上5层/地下1层' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
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
              <button onClick={() => setShowEditModal(false)} disabled={saveLoading}
                className="px-4 py-2 text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">取消</button>
              <button onClick={async () => {
                const trimmedName = editName.trim();
                if (!trimmedName) { toast('项目名称不能为空', 'warning'); return; }
                // v5.6: 保存前强制从后端拉取真实 projects 列表,避免 localStorage 缓存 stale
                // 原因:「六大中心小学」在后端 DB 存在(id=9,2026-07-08),但前端看板只显示 5 个(缓存陈旧没同步)
                //       → 用户看不到它却触发 UNIQUE 409,误以为系统 bug
                let latestProjects = projects;
                try {
                  // 直接尝试从后端刷新;失败会 throw,降级用 props.projects(离线模式兼容)
                  const remote = await api.fetchProjects();
                  if (Array.isArray(remote) && remote.length > 0) latestProjects = remote;
                } catch (_) { /* 离线/API 不可用 → 降级使用 props.projects */ }
                const isNameChanged = trimmedName !== editTarget.name;
                if (isNameChanged) {
                  // 使用后端真实 projects 列表判断重复,而不是 props 中陈旧缓存
                  // v5.6 FIX: 必须用 id 排除自身而不是 name。
                  //     之前用 p.name !== editTarget.name 有 3 个 BUG:
                  //     1) 如果后端已经偷偷把自己 UPDATE 成新名(409 前半段成功),那会把自己也判成 duplicate
                  //     2) 如果 editTarget.id 不在 latestProjects 中(404→create 的纯本地项目),那 filter 条件全通过漏检
                  //     3) 两条记录 name 相同 id 不同时漏判或误判
                  const duplicate = latestProjects.find(p => p.name === trimmedName && Number(p.id) !== Number(editTarget.id));
                  if (duplicate) {
                    const created = (duplicate as any).createdAt || (duplicate as any).created_at || '未知时间';
                    toast(`新名称「${trimmedName}」已被后端项目占用(创建于${created}),可能未在当前看板显示。建议改回原名称「${editTarget.name}」保存详情,或换用其他未使用的项目名称`, 'warning');
                    return;
                  }
                }
                // 合并新上传文档到已有文档
                const existingDocs = editTarget.details?.projectDocs || [];
                const newDocs = projectDocs.filter(d => !!d.data).map(d => ({
                  fileName: d.fileName, uploader: currentUser,
                  uploadTime: new Date().toLocaleString('zh-CN'), data: d.data,
                  parsedText: d.parsedText,
                }));
                const details = {
                  ...editForm,
                  // v5.6: 显式映射 custom → customFields,修复字段名不匹配导致无法持久化的 bug
                  customFields: editForm.custom,
                  aiReportTime: editForm.aiReport ? new Date().toLocaleString('zh-CN') : editTarget.details?.aiReportTime,
                  projectDocs: [...existingDocs, ...newDocs],
                };
                setSaveLoading(true);
                try {
                  // v5.6: await 后端结果,成功后再关对话框,确保用户操作时序正确
                  if (onSaveProject) {
                    const ok = await Promise.resolve(onSaveProject(editTarget.name, trimmedName, details));
                    if (ok !== false) setShowEditModal(false);
                  } else {
                    if (isNameChanged) onRenameProject(editTarget.name, trimmedName);
                    onUpdateProject(trimmedName, details);
                    setShowEditModal(false);
                  }
                } finally {
                  setSaveLoading(false);
                }
              }} disabled={saveLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-60 flex items-center gap-2">
                {saveLoading && <Loader className="w-4 h-4 animate-spin" />}
                {saveLoading ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* v5.7 迭代4: 项目成员管理对话框 — admin 可管理成员角色与敏感等级 */}
      {membersProject && (
        <ProjectMembersDialog
          projectId={membersProject.id}
          projectName={membersProject.name}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onClose={() => setMembersProject(null)}
        />
      )}
      {/* v5.6: 删除项目二次确认 Modal — 仅系统管理员可用;红色警告 + 强制输入 DELETE-{项目名} 防误触 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white">永久删除项目</h3>
                <p className="text-white/80 text-sm mt-1">此操作将同时清除后端数据库 20+ 张业务表 + 本地 localStorage/向量库/知识图谱,不可恢复</p>
              </div>
              <button onClick={() => { if (!deleteLoading) setDeleteTarget(null); }} disabled={deleteLoading}
                className="text-white/70 hover:text-white disabled:opacity-50 transition shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  即将删除的项目
                </div>
                <div className="text-red-900 font-bold text-lg break-all">「{deleteTarget.name}」</div>
                <div className="text-red-600 text-xs leading-relaxed">
                  删除后将永久丢失:<br />
                  • 项目概况、自定义字段、AI 分析报告<br />
                  • 所有上传文档、解析结果、指南工作进度/表单<br />
                  • WBS 目标层级、三大基线、知识图谱节点、向量库分区<br />
                  • 日报/现场问题/经验库/手机照片与进度、合同与干系人、审计日志<br />
                  <span className="font-semibold underline">此操作不可撤销,建议先在「备份/导出」中导出项目归档后再删除。</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  请输入 <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-red-700 font-bold">DELETE-{deleteTarget.name}</span> 以确认删除
                </label>
                <input type="text" value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !deleteLoading) doConfirmDelete(); }}
                  disabled={deleteLoading}
                  placeholder={`DELETE-${deleteTarget.name}`}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none text-gray-800 font-mono text-sm disabled:bg-gray-50 disabled:opacity-60" />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex gap-3 justify-end">
              <button onClick={() => { if (!deleteLoading) setDeleteTarget(null); }} disabled={deleteLoading}
                className="px-5 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">取消</button>
              <button onClick={doConfirmDelete}
                disabled={deleteLoading || deleteConfirmText.trim() !== `DELETE-${deleteTarget.name}`}
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-2">
                {deleteLoading && <Loader className="w-4 h-4 animate-spin" />}
                {deleteLoading ? '删除中…' : '确认永久删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectEntryPage;
