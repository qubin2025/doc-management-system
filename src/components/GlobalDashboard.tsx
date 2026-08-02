import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Search, X, Plus, MessageSquare,
  Image, FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Bell, Camera, Sun, Moon
} from 'lucide-react';
import { computeIndicators, ProjectIndicators } from '../data/indicatorEngine';
import { getTheme, setTheme, type ThemeMode } from '../data/themeEngine';
import { extractAllPhotos, extractRecentDocUpdates, extractProjectDeadlines, getProjectPhotoCount, getProjectDocCount, countNewThisMonth, countNewThisWeek, fetchMobilePhotoStats, fetchMobilePhotosPreview, ProjectInfo, MobilePhotoStat } from '../data/projectAggregator';
import { getUnreadCount, getAllNotifications, markRead, markAllRead, deleteNotification, MobileNotification } from '../data/mobileNotifications';

// ========== 类型 ==========
interface Props {
  onNavigate: (view: string, params?: any) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  standard?: string;
  projects: ProjectInfo[];
}

type SortKey = 'risk' | 'progress' | 'recent' | 'name';
type FilterStatus = 'all' | 'normal' | 'warning' | 'danger';

// ========== 工具函数 ==========
const barColor = (v: number): string => v >= 80 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500';
const statusBadge = (v: number): { label: string; cls: string } =>
  v >= 0.85 ? { label: '正常', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' } :
  v >= 0.6 ? { label: '关注', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' } :
  { label: '风险', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

// ========== 子组件：通知徽章 ==========
const NotificationBadge: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <button onClick={onClick} className="relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors
    bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500
    text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
    <Bell className="w-3.5 h-3.5" />
    <span>消息</span>
    {count > 0 && (
      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center
        bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none shadow-sm">
        {count > 99 ? '99+' : count}
      </span>
    )}
  </button>
);

// ========== 子组件：通知列表弹窗 ==========
const NotificationPanel: React.FC<{ onClose: () => void; onMarkAllRead: () => void }> = ({ onClose, onMarkAllRead }) => {
  const [notifs, setNotifs] = useState<MobileNotification[]>(() => getAllNotifications());

  const typeIcon = (t: string) => {
    if (t === 'alert') return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    if (t === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    return <Bell className="w-3.5 h-3.5 text-blue-500" />;
  };

  const typeLabel = (t: string) => t === 'alert' ? '警示' : t === 'warning' ? '提醒' : '要求';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col mt-0 ml-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200">现场消息</h3>
          <div className="flex items-center gap-2">
            <button onClick={onMarkAllRead} className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400">全部已读</button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><X className="w-4 h-4 text-gray-400" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500 py-12">
              <Bell className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">暂无消息</p>
            </div>
          ) : (
            notifs.map(n => (
              <div key={n.id} className={`px-4 py-3 border-b border-gray-50 dark:border-slate-800 ${n.read ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    {typeIcon(n.type)}
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{typeLabel(n.type)}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-slate-700 shrink-0">{formatTime(n.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 mb-1.5">{n.message}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-slate-700">{n.projectName || '全局'} · {n.fromUser}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!n.read && (
                      <button onClick={() => { markRead(n.id); setNotifs(getAllNotifications()); }}
                        className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400">标为已读</button>
                    )}
                    <button onClick={() => { deleteNotification(n.id); setNotifs(getAllNotifications()); }}
                      className="text-xs text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400">删除</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ========== 子组件：照片灯箱 ==========
const PhotoLightbox: React.FC<{ photos: { fileName: string; dataUrl?: string; projectName: string; uploadTime: string }[]; index: number; onClose: () => void }> = ({ photos, index, onClose }) => {
  const [idx, setIdx] = useState(index);
  const photo = photos[idx];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"><X className="w-6 h-6" /></button>
      {photos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)); }}
            className="absolute left-4 p-2 text-white/70 hover:text-white disabled:opacity-30" disabled={idx === 0}>
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => Math.min(photos.length - 1, i + 1)); }}
            className="absolute right-4 p-2 text-white/70 hover:text-white disabled:opacity-30" disabled={idx === photos.length - 1}>
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        {photo?.dataUrl ? (
          <img src={photo.dataUrl} alt={photo.fileName} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        ) : (
          <div className="w-[400px] h-[300px] flex items-center justify-center text-white/30">
            <Image className="w-24 h-24" />
          </div>
        )}
        <div className="mt-3 text-center">
          <p className="text-white text-sm font-medium">{photo?.fileName}</p>
          <p className="text-white/50 text-xs mt-1">{photo?.projectName} · {photo?.uploadTime ? formatTime(photo.uploadTime) : ''}</p>
        </div>
        <p className="text-white/30 text-xs mt-2">{idx + 1} / {photos.length}</p>
      </div>
    </div>
  );
};

// ========== 全局看板主组件 ==========
const GlobalDashboard: React.FC<Props> = ({ onNavigate, onLogout, isAdmin: _isAdmin, standard, projects }) => {
  const [indicators, setIndicators] = useState<Map<string, ProjectIndicators>>(new Map());
  const [photos, setPhotos] = useState<ReturnType<typeof extractAllPhotos>>([]);
  const [mobilePhotos, setMobilePhotos] = useState<ReturnType<typeof extractAllPhotos>>([]);
  const [mobileStats, setMobileStats] = useState<MobilePhotoStat[]>([]);
  const [docUpdates, setDocUpdates] = useState<ReturnType<typeof extractRecentDocUpdates>>([]);
  const [deadlines, setDeadlines] = useState<ReturnType<typeof extractProjectDeadlines>>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [notifPanel, setNotifPanel] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [showDeadlines, setShowDeadlines] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getTheme());
  const notifCount = useMemo(() => getUnreadCount(), [refreshing, notifPanel]);

  // 从props加载辅助数据（projects由App.tsx统一管理）
  const loadData = useCallback(() => {
    const map = new Map<string, ProjectIndicators>();
    for (const p of projects) { map.set(p.name, computeIndicators(p.name)); }
    setIndicators(map);
    setPhotos(extractAllPhotos(projects));
    setDocUpdates(extractRecentDocUpdates(projects));
    setDeadlines(extractProjectDeadlines(projects));
    fetchMobilePhotoStats(projects).then(setMobileStats).catch(() => {});
    fetchMobilePhotosPreview(12).then(setMobilePhotos).catch(() => {});
  }, [projects]);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = async () => {
    setRefreshing(true);
    loadData();
    await new Promise(r => setTimeout(r, 300));
    setRefreshing(false);
  };

  // 筛选和排序
  const filtered = useMemo(() => {
    let list = [...projects];

    // 搜索
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    // 状态筛选
    if (filterStatus !== 'all') {
      list = list.filter(p => {
        const ind = indicators.get(p.name);
        if (!ind) return false;
        const hasDanger = ind.alerts.some(a => a.level === 'danger');
        const hasWarning = ind.alerts.some(a => a.level === 'warning');
        if (filterStatus === 'danger') return hasDanger;
        if (filterStatus === 'warning') return hasWarning && !hasDanger;
        return !hasDanger && !hasWarning;
      });
    }

    // 排序
    list.sort((a, b) => {
      const ia = indicators.get(a.name);
      const ib = indicators.get(b.name);
      switch (sortKey) {
        case 'risk': {
          const riskA = ia ? ia.alerts.filter(x => x.level === 'danger').length * 10 + ia.alerts.filter(x => x.level === 'warning').length * 5 : 0;
          const riskB = ib ? ib.alerts.filter(x => x.level === 'danger').length * 10 + ib.alerts.filter(x => x.level === 'warning').length * 5 : 0;
          return riskB - riskA;
        }
        case 'progress': return (ib?.spi || 0) - (ia?.spi || 0);
        case 'recent': return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        case 'name': return a.name.localeCompare(b.name, 'zh-CN');
        default: return 0;
      }
    });
    return list;
  }, [projects, indicators, search, sortKey, filterStatus]);

  // 统计
  const stats = useMemo(() => {
    const dangerCount = Array.from(indicators.values()).filter(i => i.alerts.some(a => a.level === 'danger')).length;
    const activeCount = projects.length;
    const newCount = countNewThisMonth(projects);
    const weekNew = countNewThisWeek(projects);
    return { dangerCount, activeCount, newCount, weekNew };
  }, [projects, indicators]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
      {/* ===== 顶部导航 ===== */}
      <header className="shrink-0 bg-slate-300/70 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/zhjk-logo.png" alt="中航建科" className="h-8 w-auto" />
            <div>
              <h1 className="text-sm font-bold text-gray-800 dark:text-slate-200 leading-tight">中航建科 · 工程咨询管理平台</h1>
              <p className="text-xs text-gray-600 dark:text-slate-700">全局项目看板 依据《建设项目全过程工程咨询》——"十四五"热点培训教材</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBadge count={notifCount} onClick={() => setNotifPanel(true)} />
            <button onClick={refresh}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors
                ${refreshing ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' :
                'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-blue-300'}`}>
              {refreshing ? '刷新中...' : '刷新'}
            </button>
            {/* 主题切换 */}
            <button onClick={() => { const next = themeMode === 'dark' ? 'light' : 'dark'; setTheme(next); setThemeMode(next); }}
              title={themeMode === 'dark' ? '切换亮色主题' : '切换暗色主题'}
              className="p-1.5 rounded-lg transition-colors hover:scale-110"
              style={{ background: themeMode === 'dark' ? 'rgba(251,191,36,0.12)' : 'rgba(30,58,138,0.06)', border: themeMode === 'dark' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(30,58,138,0.12)' }}>
              {themeMode === 'dark'
                ? <Sun className="w-3.5 h-3.5 text-amber-400" />
                : <Moon className="w-3.5 h-3.5 text-indigo-500" />
              }
            </button>
            {onLogout && (
              <button onClick={onLogout}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-600
                  bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400
                  hover:text-red-500 hover:border-red-200 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors">
                退出
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-4 flex flex-col lg:flex-row gap-4">
        {/* ===== 左侧主内容区 ===== */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* KPI 统计栏 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <TrendingUp className="w-4 h-4 text-blue-500" />, label: '项目总数', value: stats.activeCount, sub: `本周+${stats.weekNew}`, color: 'blue' },
              { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: '运行正常', value: stats.activeCount - stats.dangerCount, sub: `占比${stats.activeCount > 0 ? Math.round((stats.activeCount - stats.dangerCount) / stats.activeCount * 100) : 0}%`, color: 'green' },
              { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: '需关注', value: stats.dangerCount, sub: stats.dangerCount > 0 ? '立即处理' : '暂无风险', color: 'red' },
              { icon: <Clock className="w-4 h-4 text-amber-500" />, label: '本月新增', value: stats.newCount, sub: `本周+${stats.weekNew}`, color: 'amber' },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  {card.icon}
                  <span className="text-xs text-gray-500 dark:text-slate-400">{card.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-gray-800 dark:text-slate-200">{card.value}</span>
                  <span className="text-xs text-gray-600 dark:text-slate-700">{card.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 快速操作栏 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onNavigate('project-entry')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5" /> 新建项目
            </button>
            <button onClick={() => onNavigate('ai-chat')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs hover:bg-purple-600 transition-colors shadow-sm">
              <MessageSquare className="w-3.5 h-3.5" /> AI 助手
            </button>
            <button onClick={() => onNavigate('mobile-photos')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 transition-colors shadow-sm">
              <Camera className="w-3.5 h-3.5" /> 手机端
            </button>
          </div>

          {/* 筛选栏 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索项目名称..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg
                  bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 placeholder:text-gray-400
                  focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg p-0.5">
              {(['all', 'normal', 'warning', 'danger'] as FilterStatus[]).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filterStatus === s
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                  {s === 'all' ? '全部' : s === 'normal' ? '正常' : s === 'warning' ? '关注' : '风险'}
                </button>
              ))}
            </div>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg
                bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 outline-none">
              <option value="risk">风险优先</option>
              <option value="progress">进度倒序</option>
              <option value="recent">最近活跃</option>
              <option value="name">名称排序</option>
            </select>
          </div>

          {/* 项目卡片网格 */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-500">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">{search ? '没有匹配的项目' : '暂无项目，点击"新建项目"开始'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(proj => {
                const ind = indicators.get(proj.name);
                const unread = getUnreadCount(proj.name);
                const localPhotoCount = getProjectPhotoCount(proj);
                const mobilePhotoCount = mobileStats.find(m => m.projectName === proj.name)?.count || 0;
                const projPhotoCount = localPhotoCount + mobilePhotoCount;
                const docCount = getProjectDocCount(proj);
                const spi = ind?.spi || 0;
                const status = statusBadge(spi);
                const dangerAlerts = ind?.alerts.filter(a => a.level === 'danger') || [];
                const warningAlerts = ind?.alerts.filter(a => a.level === 'warning') || [];
                const lastActive = proj.createdAt;

                return (
                  <div key={proj.name}
                    onClick={() => onNavigate('dashboard', { projectName: proj.name })}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm
                      hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer group">
                    {/* 项目名称行 */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{proj.name}</h3>
                        <span className="text-xs text-gray-600 dark:text-slate-700">
                          {proj.standard || standard || ''} · 创建于 {proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('zh-CN') : '未知'}
                        </span>
                      </div>
                      <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </div>

                    {/* 进度条 */}
                    <div className="mb-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-slate-400">综合进度</span>
                        <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{Math.round(spi * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor(spi * 100)}`} style={{ width: `${Math.min(spi * 100, 100)}%` }} />
                      </div>
                    </div>

                    {/* 预警标签 */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {dangerAlerts.map((a, ai) => (
                        <span key={ai} className="px-1.5 py-0.5 text-xs rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" title={a.message}>
                          ⚠ {a.type === 'cost' ? '成本' : a.type === 'schedule' ? '进度' : a.type === 'completeness' ? '资料' : '质量'}
                        </span>
                      ))}
                      {warningAlerts.map((a, ai) => (
                        <span key={ai} className="px-1.5 py-0.5 text-xs rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" title={a.message}>
                          {a.type === 'cost' ? '成本' : a.type === 'schedule' ? '进度' : a.type === 'completeness' ? '资料' : '质量'}
                        </span>
                      ))}
                      {dangerAlerts.length === 0 && warningAlerts.length === 0 && (
                        <span className="text-xs text-gray-600 dark:text-slate-700">无预警</span>
                      )}
                    </div>

                    {/* 底部信息行 */}
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Image className="w-3 h-3" /> {projPhotoCount}张
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {docCount}份
                        </span>
                        {unread > 0 && (
                          <span className="flex items-center gap-1 text-red-500 font-medium">
                            <Bell className="w-3 h-3" /> {unread}条
                          </span>
                        )}
                      </div>
                      <span>{lastActive ? formatTime(lastActive) : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== 右侧信息面板 ===== */}
        <aside className="w-full lg:w-[320px] shrink-0 space-y-4">
          {/* 最新现场照片 */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-slate-300">现场掠影</span>
              <button onClick={() => { setShowPhotos(true); setLightboxIdx(0); }}
                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400">查看全部</button>
            </div>
            {/* 合并 localStorage 和手机端照片 */}
            {(() => { const allPhotos = [...photos, ...mobilePhotos]; return allPhotos.length; })() === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-slate-500">
                <Camera className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">暂无现场照片</p>
                <p className="text-xs mt-0.5">通过手机APP拍摄上传</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {[...photos, ...mobilePhotos].slice(0, 6).map((p, i) => (
                  <div key={i} onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); setShowPhotos(true); }}
                    className="aspect-square rounded-lg bg-gray-100 dark:bg-slate-800 overflow-hidden cursor-pointer hover:ring-2 ring-blue-400 transition-all relative group">
                    {p.dataUrl ? (
                      <img src={p.dataUrl} alt={p.fileName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-600">
                        <Image className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] truncate">{p.projectName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 最近文档更新 */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm">
            <span className="text-sm font-medium text-gray-600 dark:text-slate-300 mb-2 block">文档动态</span>
            {docUpdates.length === 0 ? (
              <p className="text-xs text-gray-600 dark:text-slate-700 py-4 text-center">暂无最近更新</p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {docUpdates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-slate-800 last:border-0">
                    <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-slate-300 truncate">{d.fileName}</p>
                      <p className="text-xs text-gray-600 dark:text-slate-700">{d.projectName} · {formatTime(d.uploadTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 到期提醒 */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-slate-300">到期提醒</span>
              <button onClick={() => setShowDeadlines(!showDeadlines)}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                {showDeadlines ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            {showDeadlines && (
              deadlines.length === 0 ? (
                <p className="text-xs text-gray-600 dark:text-slate-700 py-3 text-center">暂无近期到期事项</p>
              ) : (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {deadlines.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-slate-800 last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.daysLeft < 0 ? 'bg-red-500' : d.daysLeft <= 3 ? 'bg-amber-500' : 'bg-green-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 dark:text-slate-300 truncate">{d.projectName} · {d.title}</p>
                        <p className={`text-xs ${d.daysLeft < 0 ? 'text-red-500 font-medium' : d.daysLeft <= 3 ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>
                          {d.daysLeft < 0 ? `已逾期${Math.abs(d.daysLeft)}天` : `剩余${d.daysLeft}天`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </aside>
      </div>

      {/* 多项目对比 */}
      {(() => {
        const allIndicators = Array.from(indicators.values());
        if (allIndicators.length <= 1) return null;
        const gaugeColor = (v: number, thresholds: [number, number] = [0.6, 0.85]): string =>
          v >= thresholds[1] ? 'text-green-500' : v >= thresholds[0] ? 'text-amber-500' : 'text-red-500';
        return (
          <div className="max-w-[1600px] mx-auto w-full px-4 pb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-4">多项目对比</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-slate-700 text-left text-xs text-gray-500 dark:text-slate-400 uppercase">
                      <th className="pb-2">项目</th><th className="pb-2 text-center">CPI</th><th className="pb-2 text-center">SPI</th><th className="pb-2 text-center">完整度</th><th className="pb-2 text-center">质量</th><th className="pb-2">风险</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIndicators.map(ind => (
                      <tr key={ind.projectName} className="border-b dark:border-slate-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="py-2 font-medium text-gray-700 dark:text-slate-300">{ind.projectName}</td>
                        <td className={`py-2 text-center font-bold ${ind.cpi > 1.05 ? 'text-red-500' : ind.cpi > 0.95 ? 'text-amber-500' : 'text-green-500'}`}>{ind.cpi}</td>
                        <td className={`py-2 text-center font-bold ${gaugeColor(ind.spi, [0.5, 0.8])}`}>{ind.spi}</td>
                        <td className={`py-2 text-center font-bold ${gaugeColor(ind.completeness / 100, [0.3, 0.6])}`}>{ind.completeness}%</td>
                        <td className="py-2 text-center font-bold text-gray-700 dark:text-slate-300">{ind.qualityScore || '-'}</td>
                        <td className="py-2">
                          {ind.alerts.filter(a => a.level === 'danger').length > 0 && <span className="text-xs text-red-500">危{ind.alerts.filter(a => a.level === 'danger').length}</span>}
                          {ind.alerts.filter(a => a.level === 'danger').length === 0 && <span className="text-xs text-green-500">正常</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      )()}

      {/* 通知面板 */}
      {notifPanel && (
        <NotificationPanel
          onClose={() => setNotifPanel(false)}
          onMarkAllRead={() => { markAllRead(); setRefreshing(r => !r); }} />
      )}

      {/* 照片灯箱 */}
      {showPhotos && (photos.length > 0 || mobilePhotos.length > 0) && (
        <PhotoLightbox photos={[...photos, ...mobilePhotos]} index={lightboxIdx} onClose={() => setShowPhotos(false)} />
      )}
    </div>
  );
};

export default GlobalDashboard;
