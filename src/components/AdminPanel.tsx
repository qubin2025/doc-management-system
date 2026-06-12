import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, X, Shield } from 'lucide-react';
import * as api from '../data/api';
import { toast } from './Toast';

interface User { id: number; username: string; display_name: string; role: string; permissions: string; is_active: number; created_at: string; }

interface Props { onBack: () => void; }

const ROLES = ['admin', 'project_manager', 'construction_unit', 'viewer'];
const PERM_KEYS = ['can_upload', 'can_download', 'can_use_ai'];

const AdminPanel: React.FC<Props> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'viewer', permissions: { can_upload: true, can_download: true, can_use_ai: false } });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try { setUsers(await api.fetchUsers()); } catch { toast('加载用户列表失败', 'error'); }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.username || !form.password) { toast('请填写用户名和密码', 'warning'); return; }
    try {
      await api.createUser({ username: form.username, password: form.password, displayName: form.displayName, role: form.role, permissions: form.permissions });
      toast('用户已创建', 'success');
      setShowAdd(false);
      setForm({ username: '', password: '', displayName: '', role: 'viewer', permissions: { can_upload: true, can_download: true, can_use_ai: false } });
      loadUsers();
    } catch (e: any) { toast('创建失败: ' + (e.message || ''), 'error'); }
  };

  const handleUpdate = async (id: number) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    try {
      const perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      await api.updateUser(id, { username: user.username, displayName: user.display_name, role: user.role, permissions: perms, isActive: !!user.is_active });
      toast('已更新', 'success');
      setEditingId(null);
      loadUsers();
    } catch (e: any) { toast('更新失败: ' + (e.message || ''), 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该用户？')) return;
    try { await api.deleteUser(id); toast('已删除', 'success'); loadUsers(); }
    catch (e: any) { toast('删除失败: ' + (e.message || ''), 'error'); }
  };

  const updateField = (id: number, field: string, value: any) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center"><span className="text-white font-black text-[10px]">ZHJK</span></div>
            <h1 className="text-lg font-bold text-gray-800">系统管理</h1>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"><Plus className="w-4 h-4" />添加用户</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">总用户</div><div className="text-2xl font-black">{users.length}</div></div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4"><div className="text-xs text-gray-500">活跃</div><div className="text-2xl font-black text-green-600">{users.filter(u => u.is_active).length}</div></div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4"><div className="text-xs text-gray-500">管理员</div><div className="text-2xl font-black text-red-600">{users.filter(u => u.role === 'admin').length}</div></div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">加载中...</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr><th className="px-4 py-3">用户名</th><th className="px-4 py-3">显示名</th><th className="px-4 py-3">角色</th><th className="px-4 py-3">权限</th><th className="px-4 py-3 text-center">状态</th><th className="px-4 py-3 text-center">创建时间</th><th className="px-4 py-3 w-32 text-center">操作</th></tr>
              </thead>
              <tbody className="divide-y">
                {users.map(u => {
                  const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || {});
                  const isEditing = editingId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {isEditing ? <input value={u.username} onChange={e => updateField(u.id, 'username', e.target.value)} className="w-24 px-2 py-1 border rounded text-xs" /> : u.username}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? <input value={u.display_name || ''} onChange={e => updateField(u.id, 'display_name', e.target.value)} className="w-20 px-2 py-1 border rounded text-xs" /> : (u.display_name || '-')}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select value={u.role} onChange={e => updateField(u.id, 'role', e.target.value)} className="px-2 py-1 border rounded text-xs">
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : <span className={`px-2 py-0.5 text-[10px] rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'project_manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            {PERM_KEYS.map(k => (
                              <label key={k} className="flex items-center gap-1 text-[10px]">
                                <input type="checkbox" checked={perms[k]} onChange={e => updateField(u.id, 'permissions', JSON.stringify({ ...perms, [k]: e.target.checked }))} />
                                {k.replace('can_', '')}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-1 text-[10px] text-gray-500">
                            {PERM_KEYS.map(k => perms[k] ? <span key={k} className="px-1 py-0.5 bg-gray-100 rounded">{k.replace('can_', '')}</span> : null)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <button onClick={() => updateField(u.id, 'is_active', u.is_active ? 0 : 1)} className={`px-2 py-0.5 text-[10px] rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.is_active ? '已激活' : '已禁用'}
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 text-[10px] rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? '已激活' : '已禁用'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 text-center">{u.created_at?.split('T')[0] || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <button onClick={() => handleUpdate(u.id)} className="p-1 text-green-500 hover:text-green-700" title="保存"><Save className="w-3.5 h-3.5" /></button>
                          ) : (
                            <button onClick={() => setEditingId(u.id)} className="p-1 text-blue-400 hover:text-blue-600" title="编辑"><Shield className="w-3.5 h-3.5" /></button>
                          )}
                          {isEditing && <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => handleDelete(u.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 添加用户弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-blue-500" />添加用户</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">用户名 *</label><input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">密码 *</label><input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">显示名称</label><input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">角色</label><select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">权限</label>
                <div className="flex gap-3">
                  {PERM_KEYS.map(k => (
                    <label key={k} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={(form.permissions as any)[k]} onChange={e => setForm(p => ({ ...p, permissions: { ...p.permissions, [k]: e.target.checked } }))} />
                      {k.replace('can_', '')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
