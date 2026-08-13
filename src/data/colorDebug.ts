/**
 * 颜色调试工具 — 记录颜色配置与变更历史，方便排查字体显示问题
 *
 * 使用方式：
 *   import { logColorConfig } from '../data/colorDebug';
 *   useEffect(() => { logColorConfig('组件名', themeMode); }, [themeMode]);
 *
 * 仅在开发模式 (import.meta.env.DEV) 下输出日志，生产环境零开销。
 */

import { getTheme } from './themeEngine';

// ========== 颜色层级配置 ==========

export interface ColorLevelConfig {
  /** 当前亮色模式类名 */
  light: string;
  /** 当前暗色模式类名 */
  dark: string;
  /** 完整 Tailwind 类名 */
  className: string;
  /** 变更历史：从最早到当前 */
  readonly history: readonly string[];
  /** 用途说明 */
  usage: string;
}

export const COLOR_CONFIG = {
  primary: {
    light: 'slate-800',
    dark: 'slate-200',
    className: 'text-slate-800 dark:text-slate-200',
    history: [
      'gray-800/slate-200 (原始)',
      'slate-900/slate-100 (调亮-过亮)',
      'slate-800/slate-200 (降亮-当前)',
    ],
    usage: '主文本/标题/数字',
  },
  secondary: {
    light: 'slate-600',
    dark: 'slate-400',
    className: 'text-slate-600 dark:text-slate-400',
    history: [
      'gray-600/slate-700 (原始)',
      'slate-700/slate-300 (调亮-过亮)',
      'slate-600/slate-400 (降亮-当前)',
    ],
    usage: '次要文本/副标题/标签',
  },
  tertiary: {
    light: 'slate-500',
    dark: 'slate-400',
    className: 'text-slate-500 dark:text-slate-400',
    history: [
      'gray-600/slate-700 (原始)',
      'slate-600/slate-300 (调亮-过亮)',
      'slate-500/slate-400 (降亮-当前)',
    ],
    usage: '辅助文本/时间戳/底部信息',
  },
  muted: {
    light: 'slate-500',
    dark: 'slate-400',
    className: 'text-slate-500 dark:text-slate-400',
    history: [
      'gray-500/slate-400 (原始)',
      'slate-500/slate-400 (统一-当前)',
    ],
    usage: '次级信息/表头/空状态',
  },
  placeholder: {
    light: 'slate-400',
    dark: 'slate-500',
    className: 'text-slate-400 dark:text-slate-500',
    history: [
      'gray-400/slate-500 (原始)',
      'slate-400/slate-500 (统一-当前)',
    ],
    usage: '图标/占位符',
  },
} as const;

export type ColorLevel = keyof typeof COLOR_CONFIG;
export type ThemeMode = 'light' | 'warm' | 'dark';

// ========== 日志函数 ==========

const LOG_PREFIX = '%c[ColorDebug]';
const LOG_STYLE = 'color:#3b82f6;font-weight:bold';

/**
 * 记录组件的颜色配置（开发模式专用）
 * @param componentName 组件名称
 * @param themeMode 当前主题模式
 * @param levels 使用的颜色层级（默认全部）
 */
export function logColorConfig(
  componentName: string,
  themeMode?: ThemeMode,
  levels: ColorLevel[] = ['primary', 'secondary', 'tertiary', 'muted', 'placeholder']
): void {
  if (!import.meta.env.DEV) return;

  const mode = themeMode ?? getTheme();
  console.group(`${LOG_PREFIX} ${componentName}`, LOG_STYLE, `| theme: ${mode}`);
  console.log('%c当前生效颜色配置:', 'font-weight:bold');
  levels.forEach(level => {
    const cfg = COLOR_CONFIG[level];
    console.log(`  ${level} (${cfg.usage}):`, {
      className: cfg.className,
      light: `text-${cfg.light}`,
      dark: `dark:text-${cfg.dark}`,
    });
  });
  console.log('%c变更历史:', 'font-weight:bold');
  levels.forEach(level => {
    const cfg = COLOR_CONFIG[level];
    console.log(`  ${level}:`, cfg.history);
  });
  console.groupEnd();
}

/**
 * 记录单个元素的颜色应用（开发模式专用）
 * @param componentName 组件名称
 * @param elementDesc 元素描述
 * @param level 颜色层级
 */
export function logColorApplied(
  componentName: string,
  elementDesc: string,
  level: ColorLevel
): void {
  if (!import.meta.env.DEV) return;
  const cfg = COLOR_CONFIG[level];
  console.log(LOG_PREFIX, LOG_STYLE, `${componentName} | "${elementDesc}" → ${cfg.className}`);
}

/**
 * 获取颜色层级配置
 */
export function getColorConfig(level: ColorLevel): ColorLevelConfig {
  return COLOR_CONFIG[level];
}

/**
 * 获取颜色类名
 */
export function getColorClass(level: ColorLevel): string {
  return COLOR_CONFIG[level].className;
}
