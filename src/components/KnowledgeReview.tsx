import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Eye, BookOpen } from 'lucide-react';
import { toast } from './Toast';

interface KnowledgeEntry {
  id: string; project_name: string; category: string; title: string;
  description: string; patterns: string; metrics: string;
  reference_count: number; created_at: string; status: 'pending' | 'approved' | 'rejected';
}

const STATUS_LABELS: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };

const KnowledgeReview: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<KnowledgeEntry | null>(null);

  const token = () => {
    const a = localStorage.getItem('doc-system-auth');
    return a ? `Bearer ${JSON.parse(a)?.token || ''}` : '';
  };

  const fetchEntries = async () => {
    const r = await fetch('/api/experience/list?limit=200', { headers: { Authorization: token() } });
    if (r.ok) {
      const d = await r.json();
      setEntries((d.items || []).map((e: any) => ({ ...e, status: e.status || 'pending' })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleApprove = async (id: string) => {
    const r = await fetch(`/api/experience/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token() },
      body: JSON.stringify({ status: 'approved' }),
    });
    if (r.ok) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'approved' as const } : e));
      toast('已通过审核', 'success');
    }
  };

  const handleReject = async (id: string) => {
    const r = await fetch(`/api/experience/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token() },
      body: JSON.stringify({ status: 'rejected' }),
    });
    if (r.ok) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'rejected' as const } : e));
      toast('已驳回', 'success');
    }
  };

  const filtered = entries.filter(e => filter === 'all' || e.status === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <BookOpen className="w-5 h-5 text-purple-600" />
            <h1 className="text-lg font-bold text-gray-800">知识审核工作台</h1>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 text-xs rounded-md ${filter === s ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                {STATUS_LABELS[s] || '全部'} ({s === 'all' ? entries.length : entries.filter(e => e.status === s).length})
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? <p className="text-gray-400 text-sm text-center py-8">加载中…</p> :
          filtered.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">无{STATUS_LABELS[filter] || ''}条目</p> :
            <div className="space-y-3">
              {filtered.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status]}`}>{STATUS_LABELS[entry.status]}</span>
                        <span className="text-xs text-gray-400">{entry.category}</span>
                      </div>
                      <h3 className="font-semibold text-gray-800">{entry.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">{entry.project_name} · {entry.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{entry.description}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreview(entry)} className="px-3 py-1.5 text-xs bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center gap-1">
                      <Eye size={12} />查看
                    </button>
                    {entry.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(entry.id)} className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 flex items-center gap-1">
                          <CheckCircle2 size={12} />通过
                        </button>
                        <button onClick={() => handleReject(entry.id)} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1">
                          <XCircle size={12} />驳回
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 mb-2">{preview.title}</h2>
            <p className="text-xs text-gray-400 mb-3">{preview.project_name} · {preview.category} · {preview.created_at?.slice(0, 10)}</p>
            <p className="text-sm text-gray-600 mb-4">{preview.description}</p>
            {preview.patterns && preview.patterns !== '[]' && (
              <div className="mb-3"><h4 className="text-xs font-semibold text-gray-500 mb-1">模式</h4>
                <pre className="text-xs bg-gray-50 rounded p-2 max-h-40 overflow-y-auto">{JSON.stringify(JSON.parse(preview.patterns || '[]'), null, 2)}</pre>
              </div>
            )}
            <button onClick={() => setPreview(null)} className="w-full py-2 text-sm border rounded-lg mt-2">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeReview;
