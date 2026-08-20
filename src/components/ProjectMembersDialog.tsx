import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Shield, Loader2 } from 'lucide-react';
import * as api from '../data/api';
import { toast } from './Toast';

interface Props {
  projectId: number;
  projectName: string;
  isAdmin: boolean;
  currentUser: string;
  onClose: () => void;
}

const ROLES = [
  { value: 'admin', label: '项目管理员', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', desc: '可管理成员+全部敏感等级' },
  { value: 'manager', label: '项目经理', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', desc: '可访问内部数据' },
  { value: 'member', label: '项目成员', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', desc: '仅公开数据' },
  { value: 'viewer', label: '只读访客', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300', desc: '只读公开数据' },
] as const;

const SENSITIVITY = [
  { value: 0, label: '公开', color: 'text-emerald-600' },
  { value: 1, label: '内部', color: 'text-amber-600' },
  { value: 2, label: '机密', color: 'text-rose-600' },
];

const ProjectMembersDialog: React.FC<Props> = ({ projectId, projectName, isAdmin, currentUser, onClose }) => {
  const [members, setMembers] = useState<api.ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'member' | 'viewer'>('member');
  const [newSensitivity, setNewSensitivity] = useState<0 | 1 | 2>(0);
  const [submitting, setSubmitting] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const list = await api.fetchProjectMembers(projectId);
      setMembers(list);
    } catch (e: any) {
      toast('加载成员失败: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleAdd = async () => {
    if (!newUsername.trim()) {
      toast('请输入用户名', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.addProjectMember(projectId, {
        username: newUsername.trim(),
        role: newRole,
        sensitivity: newSensitivity,
      });
      if (r.success) {
        toast(`已添加成员 ${newUsername.trim()}`, 'success');
        setNewUsername('');
        setNewRole('member');
        setNewSensitivity(0);
        setShowAddForm(false);
        await loadMembers();
      } else {
        toast(r.error || '添加失败', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (username: string, role: string) => {
    const r = await api.updateProjectMember(projectId, username, { role });
    if (r.success) {
      toast(`已更新 ${username} 的角色`, 'success');
      await loadMembers();
    } else {
      toast(r.error || '更新失败', 'error');
    }
  };

  const handleUpdateSensitivity = async (username: string, sensitivity: number) => {
    const r = await api.updateProjectMember(projectId, username, { sensitivity });
    if (r.success) {
      toast(`已更新 ${username} 的敏感等级`, 'success');
      await loadMembers();
    } else {
      toast(r.error || '更新失败', 'error');
    }
  };

  const handleRemove = async (username: string) => {
    if (!confirm(`确认从项目「${projectName}」移除成员 ${username}？\n移除后该用户将无法访问此项目的知识库。`)) return;
    const r = await api.removeProjectMember(projectId, username);
    if (r.success) {
      toast(`已移除成员 ${username}`, 'success');
      await loadMembers();
    } else {
      toast(r.error || '移除失败', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-sky-500" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
              项目成员管理 · <span className="text-sky-600 dark:text-sky-400">{projectName}</span>
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 成员列表 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="animate-spin mr-2" size={20} /> 加载中...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">暂无成员数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-slate-700">
                  <th className="py-2 px-2 font-medium">用户名</th>
                  <th className="py-2 px-2 font-medium">显示名</th>
                  <th className="py-2 px-2 font-medium">角色</th>
                  <th className="py-2 px-2 font-medium">敏感等级</th>
                  <th className="py-2 px-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const roleDef = ROLES.find(r => r.value === m.role) || ROLES[2];
                  const sensDef = SENSITIVITY[m.sensitivity] || SENSITIVITY[0];
                  const isSelf = m.username === currentUser;
                  return (
                    <tr key={m.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-2 text-gray-800 dark:text-gray-200">
                        {m.username}
                        {isSelf && <span className="ml-1 text-xs text-sky-500">(我)</span>}
                      </td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{m.displayName || '-'}</td>
                      <td className="py-2 px-2">
                        {isAdmin && !isSelf ? (
                          <select
                            value={m.role}
                            onChange={e => handleUpdateRole(m.username, e.target.value)}
                            className={`text-xs px-2 py-0.5 rounded border-0 ${roleDef.color} cursor-pointer`}
                          >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded ${roleDef.color}`}>{roleDef.label}</span>
                        )}
                      </td>
                      <td className={`py-2 px-2 text-xs font-medium ${sensDef.color}`}>
                        {isAdmin && !isSelf ? (
                          <select
                            value={m.sensitivity}
                            onChange={e => handleUpdateSensitivity(m.username, Number(e.target.value))}
                            className={`px-2 py-0.5 rounded border-0 ${sensDef.color} bg-transparent cursor-pointer`}
                          >
                            {SENSITIVITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        ) : (
                          sensDef.label
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {isAdmin && !isSelf ? (
                          <button
                            onClick={() => handleRemove(m.username)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                            title="移除成员"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 添加成员表单 */}
        {isAdmin && showAddForm && (
          <div className="px-5 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">用户名</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="用户名"
                  className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">角色</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">敏感等级</label>
                <select
                  value={newSensitivity}
                  onChange={e => setNewSensitivity(Number(e.target.value) as 0 | 1 | 2)}
                  className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100"
                >
                  {SENSITIVITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={submitting}
                  className="flex-1 text-sm px-3 py-1.5 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50"
                >
                  {submitting ? '添加中...' : '添加'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-sm px-3 py-1.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <div className="text-xs text-gray-500">
            共 {members.length} 位成员 · 角色: <span className="text-gray-700 dark:text-gray-300">{isAdmin ? '管理员' : '成员'}</span>
          </div>
          <div className="flex gap-2">
            {isAdmin && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 text-sm px-3 py-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                <UserPlus size={14} /> 添加成员
              </button>
            )}
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectMembersDialog;
