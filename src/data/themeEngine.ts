/**
 * 主题引擎 — 白色/暖色/暗色三种主题管理
 * localStorage持久化 + HTML data-theme属性切换
 */

export type ThemeMode = 'light' | 'warm' | 'dark';

export interface ThemeConfig {
  id: ThemeMode;
  name: string;
  icon: string; // emoji
  description: string;
}

export const THEMES: ThemeConfig[] = [
  { id: 'light', name: '亮色', icon: '☀️', description: '清爽明亮的白色主题' },
  { id: 'warm', name: '暖色', icon: '🌅', description: '温馨护眼的暖色调' },
  { id: 'dark', name: '暗色', icon: '🌙', description: '专业深色暗黑主题' },
];

const THEME_KEY = 'app-theme-preference';

/** 获取当前主题 */
export function getTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'warm' || stored === 'dark') return stored;
  } catch {}
  // 默认暗色（匹配P0/P1新组件风格）
  return 'dark';
}

/** 设置并应用主题 */
export function setTheme(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
  // 派发自定义事件，供需要响应主题变化的组件监听
  try {
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode } }));
  } catch {}
}

/** 应用主题到DOM */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  // 同时设置class用于Tailwind dark:变体
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/** 初始化主题（在main.tsx中调用） */
export function initTheme(): ThemeMode {
  const mode = getTheme();
  applyTheme(mode);
  return mode;
}
