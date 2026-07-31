import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, BookOpen } from 'lucide-react';
import { MobileProject } from '../types';

interface KnowledgeItem { id: string; title: string; category: string; description: string; }
interface Props { project: MobileProject; onBack: () => void; }

const MobileKnowledge: React.FC<Props> = ({ project, onBack }) => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('doc-system-token') ||
      JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
    fetch('/api/kg', { headers: { Authorization: `Bearer ${token || ''}` } })
      .then(r => r.json()).then(d => {
        if (d.nodes) {
          const mapped = d.nodes.map((n: any) => ({
            id: n.id, title: n.label,
            category: (n.props?.category || n.type || '').toString(),
            description: n.props?.description || n.props?.standard || '',
          }));
          setItems(mapped);
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = search ? items.filter(i =>
    i.title.includes(search) || i.description.includes(search) || i.category.includes(search)
  ) : items;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-1"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <BookOpen className="w-5 h-5 text-indigo-500" />
        <h1 className="text-sm font-semibold text-slate-800">规范速查</h1>
      </header>
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索标准/规范... "
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
        </div>
      </div>
      <div className="flex-1 px-4 pb-6 overflow-y-auto">
        {loading ? <p className="text-slate-400 text-sm text-center py-8">加载中…</p> :
          filtered.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">{search ? '无匹配结果' : '暂无知识数据'}</p> :
            <div className="space-y-2">
              {filtered.map(item => (
                <div key={item.id} className="bg-white rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600">{item.category}</span>
                  </div>
                  <h3 className="text-sm font-medium text-slate-800">{item.title}</h3>
                  {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
};

export default MobileKnowledge;
