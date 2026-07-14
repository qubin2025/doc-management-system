import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Users, Briefcase, MessageSquare } from 'lucide-react';
import { toast } from './Toast';

interface TeamMember { id: string; name: string; role: string; dept: string; availability: string; }
interface RaciItem { id: string; task: string; responsible: string; accountable: string; consulted: string; informed: string; }

interface Props { projectName: string; onBack: () => void; }

const ResourceManager: React.FC<Props> = ({ projectName, onBack }) => {
  const [activeTab, setActiveTab] = useState<'team'|'raci'|'comm'>('team');
  const [members, setMembers] = useState<TeamMember[]>(() => {
    try { const d = localStorage.getItem(`resources-${projectName}`); return d ? JSON.parse(d) : []; } catch { return []; }
  });
  const [raciItems, setRaciItems] = useState<RaciItem[]>(() => {
    try { const d = localStorage.getItem(`raci-${projectName}`); return d ? JSON.parse(d) : []; } catch { return []; }
  });
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => { localStorage.setItem(`resources-${projectName}`, JSON.stringify(members)); }, [members, projectName]);
  useEffect(() => { localStorage.setItem(`raci-${projectName}`, JSON.stringify(raciItems)); }, [raciItems, projectName]);

  const handleSaveMember = () => {
    if (!form.name) return;
    if (editing?.id) {
      setMembers(prev => prev.map(m => m.id === editing.id ? { ...m, ...form } as TeamMember : m));
    } else {
      setMembers(prev => [...prev, { ...form, id: `tm-${Date.now()}` } as TeamMember]);
    }
    setEditing(null); setForm({}); toast('保存成功', 'success');
  };
  const handleSaveRaci = () => {
    if (!form.task) return;
    if (editing?.id) {
      setRaciItems(prev => prev.map(r => r.id === editing.id ? { ...r, ...form } as RaciItem : r));
    } else {
      setRaciItems(prev => [...prev, { ...form, id: `rc-${Date.now()}` } as RaciItem]);
    }
    setEditing(null); setForm({}); toast('保存成功', 'success');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg"><ArrowLeft size={20} /></button>
            <Briefcase size={24} className="text-blue-400" /><div><h1 className="text-xl font-bold text-[var(--text-primary)]">资源与沟通管理</h1><p className="text-sm text-[var(--text-muted)]">{projectName}</p></div>
          </div>
          <button onClick={() => { setEditing({}); setForm({}); }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm flex items-center gap-1"><Plus size={14} /> 添加{activeTab === 'team' ? '成员' : activeTab === 'raci' ? 'RACI' : '记录'}</button>
        </div>

        <div className="flex gap-2 mb-6">
          {(['team', 'raci', 'comm'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${activeTab === t ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
              {{ team: '团队', raci: 'RACI矩阵', comm: '沟通记录' }[t]}
            </button>
          ))}
        </div>

        {/* 团队 Tab */}
        {activeTab === 'team' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
            {members.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-muted)]"><Users size={48} className="mx-auto mb-4 opacity-30" /><p>还没有团队成员</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-[var(--bg-secondary)]"><th className="px-4 py-2 text-xs text-[var(--text-muted)]">姓名</th><th className="px-4 py-2 text-xs">角色</th><th className="px-4 py-2 text-xs">部门</th><th className="px-4 py-2 text-xs">可用性</th><th className="px-4 py-2 text-xs w-16">操作</th></tr></thead>
                <tbody>{members.map(m => (
                  <tr key={m.id} className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium text-xs">{m.name}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{m.role}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] text-xs">{m.dept}</td>
                    <td className="px-4 py-2 text-xs">{m.availability}</td>
                    <td className="px-4 py-2"><div className="flex gap-1"><button onClick={() => { setEditing(m); setForm(m as unknown as Record<string,string>); }} className="p-1"><Edit2 size={12} /></button><button onClick={() => setMembers(prev => prev.filter(x => x.id !== m.id))} className="p-1"><Trash2 size={12} className="text-red-400" /></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* RACI Tab */}
        {activeTab === 'raci' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-x-auto">
            {raciItems.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-muted)]"><p>还没有RACI条目，添加任务和责任分配</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-[var(--bg-secondary)]"><th className="px-4 py-2 text-xs">任务</th><th className="px-4 py-2 text-xs"><span className="text-red-400">R</span> 执行</th><th className="px-4 py-2 text-xs"><span className="text-amber-400">A</span> 负责</th><th className="px-4 py-2 text-xs"><span className="text-sky-400">C</span> 咨询</th><th className="px-4 py-2 text-xs"><span className="text-green-400">I</span> 知会</th><th className="px-4 py-2 text-xs w-16">操作</th></tr></thead>
                <tbody>{raciItems.map(r => (
                  <tr key={r.id} className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium text-xs">{r.task}</td>
                    <td className="px-4 py-2 text-red-400 text-xs">{r.responsible}</td>
                    <td className="px-4 py-2 text-amber-400 text-xs">{r.accountable}</td>
                    <td className="px-4 py-2 text-sky-400 text-xs">{r.consulted}</td>
                    <td className="px-4 py-2 text-green-400 text-xs">{r.informed}</td>
                    <td className="px-4 py-2"><div className="flex gap-1"><button onClick={() => { setEditing(r); setForm(r as unknown as Record<string,string>); }} className="p-1"><Edit2 size={12} /></button><button onClick={() => setRaciItems(prev => prev.filter(x => x.id !== r.id))} className="p-1"><Trash2 size={12} className="text-red-400" /></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* 沟通记录 Tab */}
        {activeTab === 'comm' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 text-center text-[var(--text-muted)]">
            <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
            <p>会议纪要、信息分发记录等功能</p>
            <p className="text-xs mt-1">通过工作模块中的附件功能上传会议纪要等文档</p>
          </div>
        )}

        {/* 通用编辑弹窗 */}
        {(editing !== null && Object.keys(form).length >= 0) && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setEditing(null); setForm({}); }}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{editing?.id ? '编辑' : '添加'}{activeTab === 'team' ? '成员' : 'RACI条目'}</h3>
              <div className="space-y-3">
                {activeTab === 'team' ? (
                  <>
                    <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="姓名 *" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.role || ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="角色" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.dept || ''} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))} placeholder="部门" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.availability || ''} onChange={e => setForm(f => ({ ...f, availability: e.target.value }))} placeholder="可用性(如: 全职/50%/按需)" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                  </>
                ) : (
                  <>
                    <input value={form.task || ''} onChange={e => setForm(f => ({ ...f, task: e.target.value }))} placeholder="任务/活动 *" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.responsible || ''} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="R-执行者" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.accountable || ''} onChange={e => setForm(f => ({ ...f, accountable: e.target.value }))} placeholder="A-负责人" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.consulted || ''} onChange={e => setForm(f => ({ ...f, consulted: e.target.value }))} placeholder="C-咨询方" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                    <input value={form.informed || ''} onChange={e => setForm(f => ({ ...f, informed: e.target.value }))} placeholder="I-知会方" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setEditing(null); setForm({}); }} className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm">取消</button>
                <button onClick={activeTab === 'team' ? handleSaveMember : handleSaveRaci} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm">保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceManager;
