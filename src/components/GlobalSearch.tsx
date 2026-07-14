import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Target, FileText, Users, AlertTriangle, History, Briefcase, ArrowRight } from 'lucide-react';

interface SearchResult {
  id: string; title: string; subtitle: string; category: string; module: string; icon: React.ReactNode;
}

interface Props { projectName: string; onNavigate: (view: string, params?: Record<string, string>) => void; }

const GlobalSearch: React.FC<Props> = ({ projectName, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 搜索逻辑
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    // 搜索目标
    try {
      const obj = localStorage.getItem(`project-objectives-${projectName}`);
      if (obj) {
        JSON.parse(obj).forEach((o: any) => {
          if (o.title?.toLowerCase().includes(q)) items.push({
            id: o.id, title: o.title, subtitle: `${o.level} · ${Math.round(o.progress * 100)}%`, category: '目标', module: 'target-manager',
            icon: <Target size={14} className="text-sky-400" />,
          });
        });
      }
    } catch {}

    // 搜索指南工作项
    for (let ch = 1; ch <= 4; ch++) {
      try {
        const key = `guide-chapter-ch${ch}-modules`;
        const raw = localStorage.getItem(key);
        if (raw) {
          JSON.parse(raw).forEach((sm: any) => {
            (sm.workItems || []).forEach((wi: any) => {
              if (wi.name?.toLowerCase().includes(q) || wi.id?.toLowerCase().includes(q)) {
                items.push({
                  id: wi.id, title: `${wi.id} ${wi.name}`, subtitle: `${sm.name}`, category: '工作项', module: 'guide-chapter',
                  icon: <FileText size={14} className="text-blue-400" />,
                });
              }
            });
          });
        }
      } catch {}
    }

    // 搜索干系人
    try {
      const sh = localStorage.getItem(`stakeholder-${projectName}`);
      if (sh) {
        JSON.parse(sh).forEach((s: any) => {
          if (s.name?.toLowerCase().includes(q) || s.role?.toLowerCase().includes(q)) items.push({
            id: s.id, title: s.name, subtitle: s.role, category: '干系人', module: 'stakeholder',
            icon: <Users size={14} className="text-orange-400" />,
          });
        });
      }
    } catch {}

    // 搜索风险
    try {
      const rk = localStorage.getItem(`risk-${projectName}`);
      if (rk) {
        JSON.parse(rk).forEach((r: any) => {
          if (r.name?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)) items.push({
            id: r.id, title: r.name, subtitle: `风险评分: ${r.score}`, category: '风险', module: 'risk',
            icon: <AlertTriangle size={14} className="text-red-400" />,
          });
        });
      }
    } catch {}

    // 搜索资源
    try {
      const rs = localStorage.getItem(`resources-${projectName}`);
      if (rs) {
        JSON.parse(rs).forEach((r: any) => {
          if (r.name?.toLowerCase().includes(q) || r.role?.toLowerCase().includes(q)) items.push({
            id: r.id, title: r.name, subtitle: r.role, category: '资源', module: 'resource',
            icon: <Briefcase size={14} className="text-blue-400" />,
          });
        });
      }
    } catch {}

    // 搜索基线
    try {
      const bl = localStorage.getItem(`tailoring-config-${projectName}`);
      if (bl) {
        const cfg = JSON.parse(bl);
        if (cfg.result?.recommendations) {
          cfg.result.recommendations.forEach((r: string, i: number) => {
            if (r.toLowerCase().includes(q)) items.push({
              id: `rec-${i}`, title: r.slice(0, 60), subtitle: '裁剪建议', category: '基线/配置', module: 'tailoring-engine',
              icon: <History size={14} className="text-teal-400" />,
            });
          });
        }
      }
    } catch {}

    setResults(items.slice(0, 30));
  }, [query, projectName]);

  const handleSelect = (r: SearchResult) => {
    setOpen(false); setQuery('');
    if (r.module === 'guide-chapter') {
      const chId = r.id.split('.')[0];
      const chapterMap: Record<string, string> = { '1': 'ch1', '2': 'ch2', '3': 'ch3', '4': 'ch4' };
      onNavigate(r.module, { chapterId: chapterMap[chId] || 'ch1' });
    } else {
      onNavigate(r.module);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
      <Search size={14} /> <span className="hidden sm:inline text-xs">搜索 Ctrl+K</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]">
          <Search size={18} className="text-[var(--text-muted)]" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="搜索工作项、目标、干系人、风险..." autoFocus
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          <span className="text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">ESC</span>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded"><X size={16} /></button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {query && results.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-sm">未找到匹配结果</div>
          ) : results.map(r => (
            <button key={`${r.category}-${r.id}`} onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 hover:bg-[var(--bg-hover)] flex items-center gap-3 transition-colors border-b border-[var(--border-primary)]/50 last:border-b-0">
              <div className="w-8 h-8 rounded bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">{r.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] font-medium truncate">{r.title}</div>
                <div className="text-xs text-[var(--text-muted)]">{r.subtitle}</div>
              </div>
              <span className="text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[var(--text-muted)] flex-shrink-0">{r.category}</span>
              <ArrowRight size={12} className="text-[var(--text-muted)] flex-shrink-0" />
            </button>
          ))}
        </div>

        {!query && (
          <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
            输入关键字搜索项目中的工作项、目标、干系人、风险等
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;
