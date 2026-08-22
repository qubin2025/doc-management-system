import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';

interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  colorClass?: 'blue' | 'teal';
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  title,
  subtitle,
  icon,
  onBack,
  backLabel = '返回首页',
  actions,
  colorClass = 'blue',
}) => {
  const accent =
    colorClass === 'blue'
      ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30'
      : 'text-teal-600 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-900/30';

  return (
    <header
      className="backdrop-blur-md shadow-sm border-b sticky top-0 z-30"
      style={{
        backgroundColor: 'var(--header-bg)',
        borderColor: 'var(--header-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 h-[60px]">
        {/* 左侧：图标 + 标题 */}
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h1
              className="text-lg font-bold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-xs truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* 右侧：操作按钮 + 配色切换 + 返回 */}
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <ThemeSwitcher />
          <button
            onClick={onBack}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${accent}`}
            style={{ borderColor: 'var(--border-primary)' }}
            title={backLabel}
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel}
          </button>
        </div>
      </div>
    </header>
  );
};

export default ModuleHeader;
