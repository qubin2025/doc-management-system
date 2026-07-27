// 共享卡片组件 — 统一白色/暗色卡片样式，替换重复的 Tailwind 模式
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingMap = { sm: 'p-3', md: 'p-4', lg: 'p-6' };

const Card: React.FC<CardProps> = ({ children, className = '', onClick, padding = 'md' }) => (
  <div
    className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${paddingMap[padding]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

export default Card;
