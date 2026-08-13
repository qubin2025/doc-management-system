// 共享页眉组件 — 统一顶栏样式，替换 8 个文件中重复的 header 模式
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, onBack, backLabel = '返回', actions }) => (
  <header className="shrink-0 bg-slate-300/70 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <span className="text-sm">←</span> {backLabel}
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</h1>
          {subtitle && <span className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</span>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
