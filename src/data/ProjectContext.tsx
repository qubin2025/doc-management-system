/**
 * ProjectContext — 统一跨组件状态管理 (v5.1 P1)
 * 替代 30+ 组件的 prop drilling，按"改旧做新"原则渐进迁移
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { StandardType, AuthState } from '../types';

interface ProjectContextValue {
  currentProject: string;
  standard: StandardType;
  isAdmin: boolean;
  auth: AuthState | null;
  setCurrentProject: (name: string) => void;
  setStandard: (std: StandardType) => void;
  setAuth: (a: AuthState | null) => void;
  onNavigate: (view: string, params?: Record<string, unknown>) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  children,
  initialProject = '',
  initialStandard = 'DB11/T695-2025' as StandardType,
  initialAuth = null as AuthState | null,
  onNavigate = () => {},
}: {
  children: ReactNode;
  initialProject?: string;
  initialStandard?: StandardType;
  initialAuth?: AuthState | null;
  onNavigate?: (view: string, params?: Record<string, unknown>) => void;
}) {
  const [currentProject, setCurrentProject] = useState(initialProject);
  const [standard, setStandard] = useState<StandardType>(initialStandard);
  const [auth, setAuth] = useState<AuthState | null>(initialAuth);

  const isAdmin = auth?.user?.role === 'admin';

  const value: ProjectContextValue = {
    currentProject, standard, isAdmin, auth,
    setCurrentProject: useCallback((name: string) => setCurrentProject(name), []),
    setStandard: useCallback((std: StandardType) => setStandard(std), []),
    setAuth: useCallback((a: AuthState | null) => setAuth(a), []),
    onNavigate,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

/** 获取项目上下文 — 未在 Provider 内时返回 null */
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject() must be used within <ProjectProvider>');
  }
  return ctx;
}

export { ProjectContext };
