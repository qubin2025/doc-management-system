import React from 'react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * 面包屑导航组件
 * - 最后一项为当前页面，不可点击，普通文本
 * - 前面层级为可点击链接/按钮
 * - 分隔符使用 "/"
 * - 跟随三套主题配色（CSS变量）
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="面包屑导航" className="flex items-center gap-1.5 text-xs flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {isLast ? (
              <span
                className="font-medium truncate max-w-[200px]"
                style={{ color: 'var(--text-muted)' }}
                title={item.label}
              >
                {item.label}
              </span>
            ) : (
              <button
                onClick={item.onClick}
                className="hover:underline transition-colors truncate max-w-[160px]"
                style={{ color: 'var(--text-secondary)' }}
                title={item.label}
              >
                {item.label}
              </button>
            )}
            {!isLast && (
              <span style={{ color: 'var(--text-muted)' }} className="shrink-0">
                /
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
