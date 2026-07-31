// 移动端根组件 — 主路由：login → projects → dashboard → 7 子页面
import React, { useEffect, useState } from 'react';
import { getMe, logout, getAuthToken } from '../data/api';
import { UserInfo } from '../types';
import { MobileProject, WatermarkTemplate } from './types';
import { getActiveTemplate } from './lib/templates';
import MobileLogin from './pages/MobileLogin';
import ProjectPicker from './pages/ProjectPicker';
import Dashboard from './pages/Dashboard';
import CameraPage from './pages/CameraPage';
import MobileDailyReport from './pages/MobileDailyReport';
import MobileProgress from './pages/MobileProgress';
import MobileUpload from './pages/MobileUpload';
import MobilePhotoGallery from './pages/MobilePhotoGallery';
import SafetyCheck from './pages/SafetyCheck';
import TemplateEditor from './components/TemplateEditor';

type MobileView = 'login' | 'projects' | 'dashboard' | 'camera' | 'daily-report' | 'progress' | 'upload' | 'gallery' | 'safety-check' | 'templates';

const MobileApp: React.FC = () => {
  const [view, setView] = useState<MobileView>('login');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [project, setProject] = useState<MobileProject | null>(null);
  const [template, setTemplate] = useState<WatermarkTemplate>(() => getActiveTemplate());
  const [booting, setBooting] = useState(true);

  // 启动生命周期: 后台静默检测会话 → 不卸载登录表单 → 浮层loading覆盖
  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const me = await getMe();
          if (me) { setUser(me.user); setView('projects'); }
        } catch { /* 网络不通, 留在登录页 */ }
      }
      setBooting(false);
    })();
  }, []);

  const handleLogin = (u: UserInfo) => {
    setUser(u);
    setView('projects');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setProject(null);
    setView('login');
  };

  // 登录表单始终渲染 — booting阶段仅叠加浮层loading, 不卸载表单
  if (view === 'login' || !user) {
    return (
      <>
        <style>{'@keyframes mobile-spin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ position: 'relative' }}>
          <MobileLogin onLogin={handleLogin} />
          {booting && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(30,58,138,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100,
            }}>
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <div style={{
                  width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'mobile-spin 0.8s linear infinite', margin: '0 auto 12px',
                }} />
                <div style={{ fontSize: 14 }}>正在恢复会话…</div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (view === 'projects') {
    return <ProjectPicker user={user} onSelect={p => { setProject(p); setView('dashboard'); }} onLogout={handleLogout} />;
  }

  if (!project) {
    setView('projects');
    return null;
  }

  switch (view) {
    case 'dashboard':
      return <Dashboard user={user} project={project} template={template} onNavigate={v => setView(v as MobileView)} onBackToProjects={() => setView('projects')} />;
    case 'camera':
      return <CameraPage user={user} project={project} template={template} onBack={() => setView('dashboard')} onOpenTemplates={() => setView('templates')} />;
    case 'daily-report':
      return <MobileDailyReport project={project} onBack={() => setView('dashboard')} />;
    case 'progress':
      return <MobileProgress project={project} onBack={() => setView('dashboard')} />;
    case 'upload':
      return <MobileUpload project={project} onBack={() => setView('dashboard')} />;
    case 'gallery':
      return <MobilePhotoGallery project={project} onBack={() => setView('dashboard')} />;
    case 'safety-check':
      return <SafetyCheck project={project} onBack={() => setView('dashboard')} />;
    case 'templates':
      return <TemplateEditor template={template} onChange={t => setTemplate(t)} onBack={() => setView('dashboard')} />;
    default:
      return <Dashboard user={user} project={project} template={template} onNavigate={v => setView(v as MobileView)} onBackToProjects={() => setView('projects')} />;
  }
};

export default MobileApp;
