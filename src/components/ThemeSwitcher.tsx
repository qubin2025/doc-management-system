import React, { useState, useEffect } from 'react';
import { Sun, Moon, Sunrise } from 'lucide-react';
import { getTheme, setTheme, THEMES, type ThemeMode } from '../data/themeEngine';

const ThemeSwitcher: React.FC = () => {
  const [current, setCurrent] = useState<ThemeMode>(getTheme());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setCurrent(getTheme());
  }, []);

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    setCurrent(mode);
    setOpen(false);
  };

  const icon = current === 'light' ? <Sun size={16} /> :
               current === 'warm' ? <Sunrise size={16} /> :
               <Moon size={16} />;

  const iconColor = current === 'light' ? 'text-amber-500' :
                    current === 'warm' ? 'text-orange-500' :
                    'text-sky-400';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${iconColor} hover:bg-gray-100 dark:hover:bg-gray-800`}
        title="切换主题"
      >
        {icon}
        <span className="hidden sm:inline text-xs">{THEMES.find(t => t.id === current)?.icon}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 w-44"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
                  current === theme.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                style={{
                  color: current === theme.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                  backgroundColor: current === theme.id ? 'var(--accent-light)' : 'transparent',
                }}
              >
                <span className="text-lg">{theme.icon}</span>
                <div>
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{theme.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{theme.description}</div>
                </div>
                {current === theme.id && (
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSwitcher;
