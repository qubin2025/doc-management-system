import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getTheme, setTheme, THEMES, type ThemeMode } from '../data/themeEngine';

/** 各主题的代表色（用于下拉菜单小圆点预览） */
const THEME_DOT_COLOR: Record<ThemeMode, string> = {
  light: '#d1d5db',
  warm: '#b86a35',
  dark: '#334155',
};

const ThemeSwitcher: React.FC = () => {
  const [current, setCurrent] = useState<ThemeMode>(getTheme());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getTheme());
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    setCurrent(mode);
    setOpen(false);
  };

  const currentName = THEMES.find(t => t.id === current)?.name || '亮色';

  return (
    <div className="relative" ref={containerRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        style={{ color: 'var(--text-secondary)' }}
        title="切换主题"
      >
        <span className="text-xs font-medium">{currentName}</span>
        <ChevronDown size={14} style={{ opacity: open ? 1 : 0.6, transition: 'opacity 0.15s' }} />
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-lg shadow-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-md)',
            width: '120px',
          }}
        >
          {THEMES.map(theme => {
            const isActive = current === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* 主题代表色小圆点 */}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border"
                  style={{
                    backgroundColor: THEME_DOT_COLOR[theme.id],
                    borderColor: 'var(--border-secondary)',
                  }}
                />
                {/* 主题名称 */}
                <span className="text-xs font-medium flex-1 text-left">{theme.name}</span>
                {/* 当前选中勾选 */}
                {isActive && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
