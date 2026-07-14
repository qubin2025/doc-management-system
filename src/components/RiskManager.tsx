import ConfirmDialog from './ConfirmDialog';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';

interface RiskItem { id: string; name: string; category: string; probability: number; impact: number; score: number; response: string; owner: string; status: 'open'|'mitigated'|'closed'; }

interface Props { projectName: string; onBack: () => void; }

const RiskManager: React.FC<Props> = ({ projectName, onBack }) => {
  const [risks, setRisks] = useState<RiskItem[]>(() => {
    try { const d = localStorage.getItem(`risk-${projectName}`); return d ? JSON.parse(d) : []; } catch { return []; }
  });
  const [editing, setEditing] = useState<RiskItem | null>(null);
  const [form, setForm] = useState<Partial<RiskItem>>({ probability: 3, impact: 3, status: 'open' });

  useEffect(() => { localStorage.setItem(`risk-${projectName}`, JSON.stringify(risks)); }, [risks, projectName]);

  const handleSave = () => {
    if (!form.name) return;
    const score = (form.probability || 3) * (form.impact || 3);
    if (editing) {
      setRisks(prev => prev.map(r => r.id === editing.id ? { ...r, ...form, score } as RiskItem : r));
    } else {
      setRisks(prev => [...prev, { ...form, id: `rk-${Date.now()}`, score } as RiskItem]);
    }
    setEditing(null); setForm({ probability: 3, impact: 3, status: 'open' });
  };

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const handleDelete = (id: string) => { setRisks(prev => prev.filter(r => r.id !== id)); setConfirmDelete(null); };

  const highRisks = risks.filter(r => r.score >= 15);
  const medRisks = risks.filter(r => r.score >= 8 && r.score < 15);
  const lowRisks = risks.filter(r => r.score < 8);
  const riskLevel = (s: number) => s >= 15 ? { color: 'bg-red-500/10 text-red-400', label: '高' } : s >= 8 ? { color: 'bg-amber-500/10 text-amber-400', label: '中' } : { color: 'bg-green-500/10 text-green-400', label: '低' };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg"><ArrowLeft size={20} /></button>
            <AlertTriangle size={24} className="text-red-400" /><div><h1 className="text-xl font-bold text-[var(--text-primary)]">风险管理</h1><p className="text-sm text-[var(--text-muted)]">{projectName}</p></div>
          </div>
          <button onClick={() => { setEditing(null); setForm({ probability: 3, impact: 3, status: 'open' }); }}
            className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm flex items-center gap-1"><Plus size={14} /> 添加风险</button>
        </div>

        {/* 统计 + 热力图 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 col-span-1 space-y-4">
            <div className="text-center"><div className="text-3xl font-bold text-[var(--text-primary)]">{risks.length}</div><div className="text-xs text-[var(--text-muted)]">风险总数</div></div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="text-lg font-bold text-red-400">{highRisks.length}</div><div className="text-[10px] text-[var(--text-muted)]">高风险</div></div>
              <div><div className="text-lg font-bold text-amber-400">{medRisks.length}</div><div className="text-[10px] text-[var(--text-muted)]">中风险</div></div>
              <div><div className="text-lg font-bold text-green-400">{lowRisks.length}</div><div className="text-[10px] text-[var(--text-muted)]">低风险</div></div>
            </div>
          </div>
          {/* 5x5热力图 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 col-span-2">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-2">概率×影响矩阵 (5×5)</h3>
            <div className="grid grid-cols-5 gap-0.5 text-center text-[10px]">
              {[5,4,3,2,1].map(impact =>
                [1,2,3,4,5].map(prob => {
                  const s = prob * impact;
                  const count = risks.filter(r => r.probability === prob && r.impact === impact).length;
                  const bg = s >= 15 ? 'bg-red-500/30' : s >= 8 ? 'bg-amber-500/30' : 'bg-green-500/20';
                  return <div key={`${impact}-${prob}`} className={`${bg} rounded p-2 min-h-[40px] flex flex-col justify-center`}>
                    {count > 0 ? <span className="font-bold text-[var(--text-primary)]">{count}</span> : <span className="text-[var(--text-muted)]">-</span>}
                  </div>;
                })
              )}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]"><span>概率→</span><span>←影响</span></div>
          </div>
        </div>

        {/* 风险列表 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          {risks.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)]"><AlertTriangle size={48} className="mx-auto mb-4 opacity-30" /><p>还没有风险条目</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-[var(--bg-secondary)] text-left"><th className="px-4 py-2 text-xs text-[var(--text-muted)]">风险名称</th><th className="px-4 py-2 text-xs">类别</th><th className="px-4 py-2 text-xs">概率</th><th className="px-4 py-2 text-xs">影响</th><th className="px-4 py-2 text-xs">评分</th><th className="px-4 py-2 text-xs">级别</th><th className="px-4 py-2 text-xs">应对措施</th><th className="px-4 py-2 text-xs">负责人</th><th className="px-4 py-2 text-xs w-16">操作</th></tr></thead>
              <tbody>
                {risks.map(r => { const lv = riskLevel(r.score); return (
                  <tr key={r.id} className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium text-xs">{r.name}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{r.category}</td>
                    <td className="px-4 py-2 text-xs">{r.probability}</td>
                    <td className="px-4 py-2 text-xs">{r.impact}</td>
                    <td className="px-4 py-2 text-xs font-bold">{r.score}</td>
                    <td className="px-4 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${lv.color}`}>{lv.label}</span></td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs max-w-[120px] truncate">{r.response}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{r.owner}</td>
                    <td className="px-4 py-2"><div className="flex gap-1"><button onClick={() => { setEditing(r); setForm(r); }} className="p-1"><Edit2 size={12} /></button><button onClick={() => setConfirmDelete(r.id)} className="p-1"><Trash2 size={12} className="text-red-400" /></button></div></td>
                  </tr>
                );})}
              </tbody>
            </table>
          )}
        </div>

        {/* 编辑弹窗 */}
        {(editing || form.name !== undefined) && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setEditing(null); setForm({ probability: 3, impact: 3 }); }}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{editing ? '编辑风险' : '添加风险'}</h3>
              <div className="space-y-3">
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="风险名称 *" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <input value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="类别(技术/管理/外部/组织)" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-[var(--text-muted)]">概率(1-5)</label><input type="number" min={1} max={5} value={form.probability || 3} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-[var(--text-muted)]">影响(1-5)</label><input type="number" min={1} max={5} value={form.impact || 3} onChange={e => setForm(f => ({ ...f, impact: Number(e.target.value) }))} className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <input value={form.response || ''} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} placeholder="应对措施" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <input value={form.owner || ''} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="负责人" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setEditing(null); setForm({ probability: 3, impact: 3 }); }} className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm">保存</button>
              </div>
            </div>
          </div>
        )}
        {confirmDelete && (
          <ConfirmDialog title="删除风险" message="确定删除此风险条目吗？"
            danger onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
        )}
      </div>
    </div>
  );
};

export default RiskManager;
