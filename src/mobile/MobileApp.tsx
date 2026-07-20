// 移动端根组件 — useState 假路由：login / projects / camera / templates
import React, { useEffect, useState } from 'react';
import { getMe, logout, getAuthToken } from '../data/api';
import { UserInfo } from '../types';
import { MobileProject, WatermarkTemplate } from './types';
import { getActiveTemplate } from './lib/templates';
import MobileLogin from './pages/MobileLogin';
import ProjectPicker from './pages/ProjectPicker';
import CameraPage from './pages/CameraPage';
import TemplateEditor from './components/TemplateEditor';

type MobileView = 'login' | 'projects' | 'camera' | 'templates';

const MobileApp: React.FC = () => {
  const [view, setView] = useState<MobileView>('login');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [project, setProject] = useState<MobileProject | null>(null);
  const [template, setTemplate] = useState<WatermarkTemplate>(() => getActiveTemplate());
  const [booting, setBooting] = useState(true);

  // 启动恢复会话
  useEffect(() => {
    (async () => {
      if (getAuthToken()) {
        const me = await getMe();
        if (me) {
          setUser(me.user);
          setView('projects');
        }
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

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">加载中…</div>
      </div>
    );
  }

  if (view === 'login' || !user) {
    return <MobileLogin onLogin={handleLogin} />;
  }

  if (view === 'projects') {
    return (
      <ProjectPicker
        user={user}
        onSelect={p => { setProject(p); setView('camera'); }}
        onLogout={handleLogout}
      />
    );
  }

  if (view === 'templates') {
    return (
      <TemplateEditor
        template={template}
        onChange={t => setTemplate(t)}
        onBack={() => setView('camera')}
      />
    );
  }

  // camera（默认）
  if (!project) {
    setView('projects');
    return null;
  }
  return (
    <CameraPage
      user={user}
      project={project}
      template={template}
      onBack={() => setView('projects')}
      onOpenTemplates={() => setView('templates')}
    />
  );
};

export default MobileApp;
