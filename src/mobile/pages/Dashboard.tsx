// 手机端图标主界面 — 4 列 App 风格图标网格 + 名称可选显示
import React, { useEffect, useState } from 'react';
import { Camera, Upload, Shield, Image, Settings2, ArrowLeft, Eye, EyeOff, TrendingUp, FileText, BookOpen } from 'lucide-react';
import { UserInfo } from '../../types';
import { MobileProject, WatermarkTemplate } from '../types';
import { checkNotices, uploadPhoto, PhotoMeta } from '../data/mobileApi';
import { getQueueCount, getQueue, removeFromQueue, markFailed, onReconnect, clearStale } from '../lib/offlineQueue';
import InstallBanner from '../components/InstallBanner';

interface Props {
  user: UserInfo;
  project: MobileProject;
  template: WatermarkTemplate;
  onNavigate: (view: string) => void;
  onBackToProjects: () => void;
}

interface AppIcon {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  badge?: number;
}

const Dashboard: React.FC<Props> = ({ user, project, template, onNavigate, onBackToProjects }) => {
  const [urgentCount, setUrgentCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [showLabels, setShowLabels] = useState(() => {
    try { return localStorage.getItem('mobile-show-labels') !== '0'; } catch { return true; }
  });

  const toggleLabels = () => {
    const next = !showLabels;
    setShowLabels(next);
    try { localStorage.setItem('mobile-show-labels', next ? '1' : '0'); } catch {}
  };

  useEffect(() => {
    checkNotices().then(d => setUrgentCount(d.urgentCount)).catch(() => {});
    getQueueCount().then(setQueueCount);
    clearStale();
  }, []);

  const processQueue = async () => {
    const items = await getQueue();
    if (items.length === 0) return;
    for (const item of items) {
      if (item.status === 'uploading') continue;
      try {
        const meta: PhotoMeta = {
          projectId: item.projectId, location: item.location,
          latitude: item.latitude, longitude: item.longitude,
          poi: item.poi, address: item.address,
          watermarkData: item.watermarkData ? JSON.parse(item.watermarkData) : undefined,
        };
        await uploadPhoto(item.blob, item.fileName, meta);
        if (item.id) await removeFromQueue(item.id);
      } catch (e: unknown) {
        if (item.id) await markFailed(item.id, (e as Error).message || '上传失败');
      }
    }
    setQueueCount(await getQueueCount());
  };

  useEffect(() => { const cleanup = onReconnect(processQueue); return cleanup; }, []);

  const icons: AppIcon[] = [
    { id: 'camera',    label: '水印拍照', icon: <Camera className="w-7 h-7" />,      color: 'bg-blue-500' },
    { id: 'upload',    label: '文件上传', icon: <Upload className="w-7 h-7" />,       color: 'bg-emerald-500', badge: queueCount },
    { id: 'safety-check', label: '安全检查', icon: <Shield className="w-7 h-7" />,  color: 'bg-amber-500', badge: urgentCount },
    { id: 'gallery',   label: '照片浏览', icon: <Image className="w-7 h-7" />,       color: 'bg-purple-500' },
    { id: 'progress',  label: '进度管理', icon: <TrendingUp className="w-7 h-7" />,  color: 'bg-sky-500' },
    { id: 'daily-report', label: '项目日报', icon: <FileText className="w-7 h-7" />,  color: 'bg-orange-500' },
    { id: 'knowledge',  label: '规范速查', icon: <BookOpen className="w-7 h-7" />,   color: 'bg-indigo-500' },
    { id: 'templates', label: '水印模板', icon: <Settings2 className="w-7 h-7" />,   color: 'bg-slate-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif" }}>
      {/* 顶栏：返回徽章 + Logo + 项目名 */}
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-10">
        <img src="/zhjk-logo.png" alt="中航建科" className="w-8 h-8 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-800 truncate">{project.name}</h1>
          <p className="text-xs text-slate-400 truncate">{user.displayName || user.username}</p>
        </div>
        <button onClick={toggleLabels} className="p-2 text-slate-400 active:bg-slate-100 rounded-lg" title={showLabels ? '隐藏名称' : '显示名称'}>
          {showLabels ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button onClick={onBackToProjects}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium active:bg-blue-100 shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回
        </button>
      </header>

      {/* 模板提示 */}
      <div className="px-4 pt-3">
        <p className="text-xs text-slate-400">模板：<span className="text-slate-600 font-medium">{template.name}</span></p>
      </div>

      {/* 4 列图标网格 — 图标直接撑满按钮 */}
      <main className="flex-1 p-3">
        <div className="grid grid-cols-4 gap-3">
          {icons.map(app => (
            <button
              key={app.id}
              onClick={() => onNavigate(app.id)}
              className="aspect-square rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center gap-1 active:scale-95 active:bg-blue-50 transition-all relative"
            >
              <div className={`w-12 h-12 rounded-2xl ${app.color} flex items-center justify-center text-white`}>
                {app.icon}
              </div>
              {showLabels && (
                <span className="text-xs text-slate-600 font-medium leading-tight">{app.label}</span>
              )}
              {app.badge != null && app.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {app.badge > 99 ? '99+' : app.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </main>

      <div className="text-center pb-6">
        <p className="text-xs text-slate-300">中航建科 · 工程咨询手机端</p>
      </div>

      <InstallBanner />
    </div>
  );
};

export default Dashboard;
