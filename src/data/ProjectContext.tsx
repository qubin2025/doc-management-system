/**
 * ProjectContext — 混合模式状态管理 (v5.1)
 * - Provider 模式: 顶层 <ProjectProvider> 包裹，React Context 传递
 * - 独立模式: 无 Provider 时自动使用模块级单例状态
 * 按"改旧做新"原则渐进迁移: 新组件直接 useProject(), 旧组件触及即迁
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { StandardType, AuthState } from '../types';

interface ProjectContextValue {
  currentProject: string;
  standard: StandardType;
  isAdmin: boolean;
  auth: AuthState | null;
  setCurrentProject: (name: string) => void;
  setStandard: (std: StandardType) => void;
  setAuth: (a: AuthState | null) => void;
}

// 模块级单例（无 Provider 时使用）
let _globalProject = '';
let _globalStandard: StandardType = 'DB11/T695-2025';
let _globalAuth: AuthState | null = null;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach(fn => fn()); }

/** 模块级 setter — App.tsx 直接调用同步全局状态 */
export function setGlobalProject(name: string) { _globalProject = name; notify(); }
export function setGlobalStandard(std: StandardType) { _globalStandard = std; notify(); }
export function setGlobalAuth(a: AuthState | null) { _globalAuth = a; notify(); }
export function getGlobalProject() { return _globalProject; }

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  children,
  initialProject = _globalProject,
  initialStandard = _globalStandard,
  initialAuth = _globalAuth,
}: {
  children: ReactNode;
  initialProject?: string;
  initialStandard?: StandardType;
  initialAuth?: AuthState | null;
}) {
  const [currentProject, setCurrentProject] = useState(initialProject);
  const [standard, setStandard] = useState<StandardType>(initialStandard);
  const [auth, setAuth] = useState<AuthState | null>(initialAuth);

  // Provider 内修改同时同步全局状态
  const wrapSetProject = useCallback((name: string) => { setCurrentProject(name); setGlobalProject(name); }, []);
  const wrapSetStandard = useCallback((std: StandardType) => { setStandard(std); setGlobalStandard(std); }, []);
  const wrapSetAuth = useCallback((a: AuthState | null) => { setAuth(a); setGlobalAuth(a); }, []);

  const isAdmin = auth?.user?.role === 'admin';

  return (
    <ProjectContext.Provider value={{
      currentProject, standard, isAdmin, auth,
      setCurrentProject: wrapSetProject,
      setStandard: wrapSetStandard,
      setAuth: wrapSetAuth,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

/** 获取项目上下文 — Provider 内用 Context，否则用模块级单例 */
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);

  // Provider 模式
  if (ctx) return ctx;

  // 独立模式 — 模块级单例 + 订阅重渲染
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1);
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);

  return {
    currentProject: _globalProject,
    standard: _globalStandard,
    isAdmin: _globalAuth?.user?.role === 'admin',
    auth: _globalAuth,
    setCurrentProject: setGlobalProject,
    setStandard: setGlobalStandard,
    setAuth: setGlobalAuth,
  };
}
