import ConfirmDialog from './ConfirmDialog';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Users } from 'lucide-react';

interface Stakeholder { id: string; name: string; role: string; org: string; power: 'high'|'low'; interest: 'high'|'low'; influence: string; strategy: string; contact: string; }

interface Props { projectName: string; onBack: () => void; }

const StakeholderManager: React.FC<Props> = ({ projectName, onBack }) => {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(() => {
    try { const d = localStorage.getItem(`stakeholder-${projectName}`); return d ? JSON.parse(d) : []; } catch { return []; }
  });
  const [editing, setEditing] = useState<Stakeholder | null>(null);
  const [form, setForm] = useState<Partial<Stakeholder>>({});

  useEffect(() => { localStorage.setItem(`stakeholder-${projectName}`, JSON.stringify(stakeholders)); }, [stakeholders, projectName]);

  const handleSave = () => {
    if (!form.name) return;
    if (editing) {
      setStakeholders(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } as Stakeholder : s));
    } else {
      setStakeholders(prev => [...prev, { ...form, id: `sh-${Date.now()}` } as Stakeholder]);
    }
    setEditing(null); setForm({});
  };

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => { setStakeholders(prev => prev.filter(s => s.id !== id)); setConfirmDelete(null); };

  const highP = stakeholders.filter(s => s.power === 'high' && s.interest === 'high').length;
  const highI = stakeholders.filter(s => s.power === 'low' && s.interest === 'high').length;
  const lowP = stakeholders.filter(s => s.power === 'high' && s.interest === 'low').length;
  const lowI = stakeholders.filter(s => s.power === 'low' && s.interest === 'low').length;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg"><ArrowLeft size={20} /></button>
            <Users size={24} className="text-orange-400" /><div><h1 className="text-xl font-bold text-[var(--text-primary)]">干系人管理</h1><p className="text-sm text-[var(--text-muted)]">{projectName}</p></div>
          </div>
          <button onClick={() => { setEditing(null); setForm({ power: 'high', interest: 'high' }); }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm flex items-center gap-1"><Plus size={14} /> 添加干系人</button>
        </div>

        {/* 权力/利益矩阵 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-3">权力/利益矩阵 (2x2)</h3>
            <div className="grid grid-cols-2 gap-1 text-center h-48 text-xs">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex flex-col justify-center">
                <div className="text-2xl font-bold text-red-400">{highP}</div>
                <div className="text-red-400">高权力/高利益</div>
                <div className="text-[10px] text-[var(--text-muted)]">密切管理</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex flex-col justify-center">
                <div className="text-2xl font-bold text-amber-400">{lowP}</div>
                <div className="text-amber-400">高权力/低利益</div>
                <div className="text-[10px] text-[var(--text-muted)]">令其满意</div>
              </div>
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-2 flex flex-col justify-center">
                <div className="text-2xl font-bold text-sky-400">{highI}</div>
                <div className="text-sky-400">低权力/高利益</div>
                <div className="text-[10px] text-[var(--text-muted)]">随时告知</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 flex flex-col justify-center">
                <div className="text-2xl font-bold text-green-400">{lowI}</div>
                <div className="text-green-400">低权力/低利益</div>
                <div className="text-[10px] text-[var(--text-muted)]">监督</div>
              </div>
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-3">统计</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{stakeholders.length}</div><div className="text-xs text-[var(--text-muted)]">干系人总数</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-red-400">{highP}</div><div className="text-xs text-[var(--text-muted)]">需密切管理</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{stakeholders.filter(s => s.strategy).length}</div><div className="text-xs text-[var(--text-muted)]">已有策略</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{stakeholders.filter(s => s.contact).length}</div><div className="text-xs text-[var(--text-muted)]">有联系方式</div></div>
            </div>
          </div>
        </div>

        {/* 干系人列表 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          {stakeholders.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)]">
              <Users size={48} className="mx-auto mb-4 opacity-30" /><p>还没有干系人，点击右上角添加</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-[var(--bg-secondary)] text-left"><th className="px-4 py-2 text-xs text-[var(--text-muted)]">姓名</th><th className="px-4 py-2 text-xs">角色</th><th className="px-4 py-2 text-xs">组织</th><th className="px-4 py-2 text-xs">权力</th><th className="px-4 py-2 text-xs">利益</th><th className="px-4 py-2 text-xs">参与策略</th><th className="px-4 py-2 text-xs w-16">操作</th></tr></thead>
              <tbody>
                {stakeholders.map(s => (
                  <tr key={s.id} className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{s.role}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{s.org}</td>
                    <td className="px-4 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${s.power === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>{s.power === 'high' ? '高' : '低'}</span></td>
                    <td className="px-4 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${s.interest === 'high' ? 'bg-sky-500/10 text-sky-400' : 'bg-gray-500/10 text-gray-400'}`}>{s.interest === 'high' ? '高' : '低'}</span></td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{s.strategy}</td>
                    <td className="px-4 py-2"><div className="flex gap-1"><button onClick={() => { setEditing(s); setForm(s); }} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)]"><Edit2 size={12} /></button><button onClick={() => setConfirmDelete(s.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400"><Trash2 size={12} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 编辑弹窗 */}
        {(editing || form.name !== undefined) && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setEditing(null); setForm({}); }}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{editing ? '编辑干系人' : '添加干系人'}</h3>
              <div className="space-y-3">
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="姓名 *" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <input value={form.role || ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="角色" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <input value={form.org || ''} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} placeholder="所属组织" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.power || 'high'} onChange={e => setForm(f => ({ ...f, power: e.target.value as 'high'|'low' }))} className="bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm">
                    <option value="high">高权力</option><option value="low">低权力</option>
                  </select>
                  <select value={form.interest || 'high'} onChange={e => setForm(f => ({ ...f, interest: e.target.value as 'high'|'low' }))} className="bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm">
                    <option value="high">高利益</option><option value="low">低利益</option>
                  </select>
                </div>
                <input value={form.strategy || ''} onChange={e => setForm(f => ({ ...f, strategy: e.target.value }))} placeholder="参与策略" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                <input value={form.contact || ''} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="联系方式" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setEditing(null); setForm({}); }} className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-primary)]">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm">保存</button>
              </div>
            </div>
          </div>
        )}
        {confirmDelete && (
          <ConfirmDialog title="删除干系人" message="确定删除此干系人吗？"
            danger onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
        )}
      </div>
    </div>
  );
};

export default StakeholderManager;
