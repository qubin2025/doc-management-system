
import React, { useState, useRef } from 'react';
import { User, Node, Link, Role, RelationType } from '../types';
import { Plus, Trash2, Users, Link as LinkIcon, AlertCircle, CheckCircle2, Download, Upload, FileSpreadsheet, ShieldCheck, UserPlus, ArrowRightLeft, Edit2, X, Save, ChevronLeft, RotateCcw, Phone } from 'lucide-react';

interface AdminPanelProps {
  nodes: Node[];
  links: Link[];
  currentUser: User;
  allUsers: User[];
  onAddNode: (node: Omit<Node, 'id' | 'createdBy'>) => void;
  onUpdateNode: (id: string, updates: Partial<Node>) => void;
  onDeleteNode: (id: string) => void;
  onAddLink: (link: Omit<Link, 'id' | 'createdBy'>) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onAddUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  onDeleteUser: (id: string) => void;
  onTransferSA: (id: string) => void;
  onBack?: () => void;
  onReset?: () => void;
  t: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  nodes, links, currentUser, allUsers, 
  onAddNode, onUpdateNode, onDeleteNode, onAddLink, 
  onExport, onImport, onAddUser, onDeleteUser, onTransferSA, 
  onBack, onReset, t 
}) => {
  const [nodeForm, setNodeForm] = useState({ name: '', phone: '', category: 'Tech', organization: '', position: '', title: '', weight: 5, bio: '' });
  const [linkForm, setLinkForm] = useState({ source: '', target: '', type: 'Work_Partner' as RelationType, strength: 5 });
  const [userForm, setUserForm] = useState({ name: '', phone: '', role: 'COMPANY_LEADER' as Role });
  
  // Node inline editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeData, setEditingNodeData] = useState<Partial<Node>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const roleHierarchy: Record<Role, number> = {
    'SUPER_ADMIN': 0,
    'ADMIN': 1,
    'GROUP_LEADER': 2,
    'COMPANY_LEADER': 3
  };

  const availableRolesForCreation: Role[] = Object.keys(roleHierarchy).filter(
    r => roleHierarchy[r as Role] > roleHierarchy[currentUser.role]
  ) as Role[];

  const currentAdminCount = allUsers.filter(u => u.role === 'ADMIN').length;
  const canAddMoreAdmins = currentUser.role === 'SUPER_ADMIN' && currentAdminCount < 3;

  const handleNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeForm.name) return;
    onAddNode(nodeForm);
    setNodeForm({ name: '', phone: '', category: 'Tech', organization: '', position: '', title: '', weight: 5, bio: '' });
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.source || !linkForm.target || linkForm.source === linkForm.target) return;
    onAddLink(linkForm);
    setLinkForm({ ...linkForm, source: '', target: '' });
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.phone) return;
    if (userForm.role === 'ADMIN' && !canAddMoreAdmins) {
      alert(t.maxAdmins);
      return;
    }
    onAddUser(userForm);
    setUserForm({ name: '', phone: '', role: availableRolesForCreation[0] || 'COMPANY_LEADER' });
  };

  const canEditNode = (node: Node) => {
    return currentUser.role === 'SUPER_ADMIN' || node.createdBy === currentUser.id;
  };

  const canDeleteNode = (node: Node) => {
    return currentUser.role === 'SUPER_ADMIN' || node.createdBy === currentUser.id;
  };

  const startEditNode = (node: Node) => {
    setEditingNodeId(node.id);
    setEditingNodeData({
      name: node.name,
      phone: node.phone,
      category: node.category,
      organization: node.organization,
      position: node.position,
      title: node.title,
      weight: node.weight,
      bio: node.bio
    });
  };

  const saveNodeEdit = () => {
    if (editingNodeId) {
      onUpdateNode(editingNodeId, editingNodeData);
      setEditingNodeId(null);
    }
  };

  const canManageUser = (target: User) => {
    return roleHierarchy[target.role] > roleHierarchy[currentUser.role];
  };

  const canTransferSA = (target: User) => {
    return currentUser.role === 'SUPER_ADMIN' && target.id !== currentUser.id;
  };

  return (
    <div className="p-4 md:p-8 h-full max-w-6xl mx-auto space-y-6 md:space-y-10 bg-gray-900/20 backdrop-blur-sm">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800/30 pb-6 gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">{t.mgmtTitle}</h2>
            <p className="text-gray-400 text-sm mt-1">{t.mgmtDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto">
          {currentUser.role === 'SUPER_ADMIN' && onReset && (
            <button 
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs font-bold mr-2"
              title="Reset System State"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">REBOOT</span>
            </button>
          )}
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
               <ShieldCheck size={18} />
               <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{t.roles[currentUser.role]}</span>
             </div>
             <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase">Logged as {currentUser.name}</p>
          </div>
        </div>
      </header>

      {/* User Management Section */}
      <section className="bg-gray-900/30 backdrop-blur-md border border-gray-800/40 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
         <div className="p-6 md:p-8 border-b border-gray-800/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
                <Users className="text-indigo-400" /> {t.userMgmt}
              </h3>
              <p className="text-xs md:text-sm text-gray-400 mt-1">Manage personnel access hierarchy and authorization.</p>
            </div>
            
            {availableRolesForCreation.length > 0 && (
              <form onSubmit={handleUserSubmit} className="flex flex-wrap items-center gap-3">
                <input 
                  type="text" placeholder={t.name} value={userForm.name}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none w-full md:w-32"
                />
                <input 
                  type="tel" placeholder={t.phone} value={userForm.phone}
                  onChange={e => setUserForm({...userForm, phone: e.target.value})}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none w-full md:w-40"
                />
                <select 
                   value={userForm.role}
                   onChange={e => setUserForm({...userForm, role: e.target.value as Role})}
                   className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none flex-1 md:flex-none"
                >
                   {availableRolesForCreation.map(r => <option key={r} value={r}>{t.roles[r]}</option>)}
                </select>
                <button className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-xl transition-all ml-auto md:ml-0">
                  <UserPlus size={18} />
                </button>
              </form>
            )}
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-800/30 text-[10px] uppercase font-bold text-gray-500">
                <tr>
                  <th className="px-6 md:px-8 py-4">{t.name}</th>
                  <th className="px-6 md:px-8 py-4">{t.phone}</th>
                  <th className="px-6 md:px-8 py-4 hidden sm:table-cell">{t.role}</th>
                  <th className="px-6 md:px-8 py-4 text-right">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/20">
                {allUsers.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 md:px-8 py-4 font-bold text-sm text-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-800/50 border border-gray-700/30 flex items-center justify-center text-[10px]">{u.name[0]}</div>
                        {u.name}
                        <span className="sm:hidden text-[9px] uppercase tracking-tighter text-gray-500">{t.roles[u.role]}</span>
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-4 text-xs font-mono text-gray-400">{u.phone}</td>
                    <td className="px-6 md:px-8 py-4 hidden sm:table-cell">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                        u.role === 'SUPER_ADMIN' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                        u.role === 'ADMIN' ? 'border-indigo-500/30 text-indigo-400 bg-indigo-400/5' :
                        'border-gray-700 text-gray-500'
                      }`}>
                        {t.roles[u.role]}
                      </span>
                    </td>
                    <td className="px-6 md:px-8 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         {canTransferSA(u) && (
                           <button 
                             onClick={() => onTransferSA(u.id)}
                             title={t.transferSA}
                             className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                           >
                             <ArrowRightLeft size={16} />
                           </button>
                         )}
                         {canManageUser(u) && (
                           <button 
                             onClick={() => onDeleteUser(u.id)}
                             title={t.deleteUser}
                             className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                           >
                             <Trash2 size={16} />
                           </button>
                         )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      </section>

      {/* Data Import/Export Tools */}
      <section className="bg-gray-900/30 border border-gray-800/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800/30 pb-4 mb-4">
          <FileSpreadsheet className="text-indigo-400" />
          <h3 className="text-xl font-bold">{t.dataTools}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={onExport}
            className="flex items-center justify-center gap-2 bg-gray-800/40 hover:bg-gray-700/40 text-gray-200 py-3 rounded-xl border border-gray-700/40 transition-all font-semibold"
          >
            <Download size={18} className="text-indigo-400" />
            {t.exportBtn}
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-gray-800/40 hover:bg-gray-700/40 text-gray-200 py-3 rounded-xl border border-gray-700/40 transition-all font-semibold"
          >
            <Upload size={18} className="text-green-400" />
            {t.importBtn}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv,.txt"
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
        </div>
      </section>

      <div className="grid md:grid-cols-1 gap-6 md:gap-8">
        <div className="bg-gray-900/30 border border-gray-800/30 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-800/30 pb-4">
            <Plus className="text-indigo-400" />
            <h3 className="text-xl font-bold">{t.addPerson}</h3>
          </div>
          <form onSubmit={handleNodeSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.name}</label>
                <input 
                  type="text" 
                  value={nodeForm.name} 
                  onChange={e => setNodeForm({...nodeForm, name: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                  placeholder="e.g. Elon Musk"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.phoneLabel}</label>
                <input 
                  type="tel" 
                  value={nodeForm.phone} 
                  onChange={e => setNodeForm({...nodeForm, phone: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                  placeholder="Contact number"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.categoryLabel}</label>
                <select 
                  value={nodeForm.category}
                  onChange={e => setNodeForm({...nodeForm, category: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                >
                  {Object.entries(t.categories).map(([key, val]) => (
                    <option key={key} value={key}>{val as string}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.orgLabel}</label>
                <input 
                  type="text" 
                  value={nodeForm.organization} 
                  onChange={e => setNodeForm({...nodeForm, organization: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                  placeholder="e.g. Nexus Corp"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.posLabel}</label>
                <input 
                  type="text" 
                  value={nodeForm.position} 
                  onChange={e => setNodeForm({...nodeForm, position: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                  placeholder="e.g. Engineering"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.titleLabel}</label>
                <input 
                  type="text" 
                  value={nodeForm.title} 
                  onChange={e => setNodeForm({...nodeForm, title: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                  placeholder="e.g. Manager"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.weight} ({nodeForm.weight})</label>
                <input 
                  type="range" min="1" max="10" 
                  value={nodeForm.weight} 
                  onChange={e => setNodeForm({...nodeForm, weight: parseInt(e.target.value)})}
                  className="w-full accent-indigo-500 h-10"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">{t.bio}</label>
              <textarea 
                rows={2}
                value={nodeForm.bio}
                onChange={e => setNodeForm({...nodeForm, bio: e.target.value})}
                className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                placeholder="Brief biography..."
              />
            </div>
            <button className="w-full bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
              <Plus size={20} /> {t.createEntity}
            </button>
          </form>
        </div>

        <div className="bg-gray-900/30 border border-gray-800/30 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-800/30 pb-4">
            <LinkIcon className="text-green-400" />
            <h3 className="text-xl font-bold">{t.connectPeople}</h3>
          </div>
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.source}</label>
                <select 
                  value={linkForm.source}
                  onChange={e => setLinkForm({...linkForm, source: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                >
                  <option value="">Select...</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.target}</label>
                <select 
                  value={linkForm.target}
                  onChange={e => setLinkForm({...linkForm, target: e.target.value})}
                  className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                >
                  <option value="">Select...</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.relType}</label>
                <select 
                   value={linkForm.type}
                   onChange={e => setLinkForm({...linkForm, type: e.target.value as RelationType})}
                   className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100"
                >
                   {Object.entries(t.relationTypes).map(([key, val]) => (
                    <option key={key} value={key}>{val as string}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.strength} ({linkForm.strength})</label>
                <input 
                  type="range" min="1" max="10" 
                  value={linkForm.strength}
                  onChange={e => setLinkForm({...linkForm, strength: parseInt(e.target.value)})}
                  className="w-full accent-green-500"
                />
              </div>
            </div>
            <button className="w-full bg-green-600/80 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
              <CheckCircle2 size={20} /> {t.establishLink}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-gray-900/30 border border-gray-800/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-800/30">
          <h3 className="text-xl font-bold text-gray-100">{t.existingEntities}</h3>
          <p className="text-sm text-gray-400">{t.entitiesDesc}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-800/20 text-[12px] uppercase tracking-widest text-gray-500 font-bold">
              <tr>
                <th className="px-4 py-4 w-12 text-center">{t.serialNumber}</th>
                <th className="px-6 py-4">{t.name}</th>
                <th className="px-6 py-4">{t.phoneLabel}</th>
                <th className="px-6 py-4 hidden sm:table-cell">{t.orgLabel} / {t.titleLabel}</th>
                <th className="px-6 py-4 hidden md:table-cell">{t.categoryLabel}</th>
                <th className="px-6 py-4">{t.weight}</th>
                <th className="px-6 py-4 hidden lg:table-cell">{t.owner}</th>
                <th className="px-6 py-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/10">
              {nodes.map((node, index) => (
                <tr key={node.id} className="hover:bg-gray-800/10 transition-colors">
                  <td className="px-4 py-4 text-[12px] text-gray-600 font-bold text-center">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-200">
                    {editingNodeId === node.id ? (
                      <input 
                        type="text" 
                        value={editingNodeData.name} 
                        onChange={e => setEditingNodeData({...editingNodeData, name: e.target.value})}
                        className="bg-gray-800/50 border border-indigo-500/50 rounded px-2 py-1 outline-none text-indigo-400 font-bold w-full"
                      />
                    ) : node.name}
                  </td>
                  <td className="px-6 py-4">
                    {editingNodeId === node.id ? (
                      <input 
                        type="tel" 
                        value={editingNodeData.phone || ''} 
                        onChange={e => setEditingNodeData({...editingNodeData, phone: e.target.value})}
                        className="bg-gray-800/50 border border-indigo-500/50 rounded px-2 py-1 outline-none text-xs w-full text-gray-100"
                        placeholder="Phone"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Phone size={16} className="text-indigo-500" />
                        {node.phone || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    {editingNodeId === node.id ? (
                      <div className="space-y-1">
                        <input 
                          type="text" 
                          placeholder={t.orgLabel}
                          value={editingNodeData.organization} 
                          onChange={e => setEditingNodeData({...editingNodeData, organization: e.target.value})}
                          className="bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 outline-none text-xs w-full text-gray-100"
                        />
                        <input 
                          type="text" 
                          placeholder={t.titleLabel}
                          value={editingNodeData.title} 
                          onChange={e => setEditingNodeData({...editingNodeData, title: e.target.value})}
                          className="bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 outline-none text-xs w-full text-gray-100"
                        />
                      </div>
                    ) : (
                      <div className="text-xs">
                        <div className="text-gray-300 font-medium">{node.organization || '-'}</div>
                        <div className="text-gray-500 italic">{node.title || '-'}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    {editingNodeId === node.id ? (
                      <select 
                        value={editingNodeData.category}
                        onChange={e => setEditingNodeData({...editingNodeData, category: e.target.value})}
                        className="bg-gray-800/50 border border-indigo-500/50 rounded px-2 py-1 outline-none text-xs w-full text-gray-100"
                      >
                        {Object.entries(t.categories).map(([key, val]) => (
                          <option key={key} value={key}>{val as string}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-800/40 border border-gray-700/20 rounded-full text-[10px] text-gray-400 uppercase tracking-tighter">
                        {t.categories[node.category as keyof typeof t.categories] || node.category}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-base text-gray-400">
                    {editingNodeId === node.id ? (
                      <input 
                        type="number" min="1" max="10"
                        value={editingNodeData.weight} 
                        onChange={e => setEditingNodeData({...editingNodeData, weight: parseInt(e.target.value)})}
                        className="bg-gray-800/50 border border-indigo-500/50 rounded px-2 py-1 outline-none w-16 text-gray-100"
                      />
                    ) : node.weight}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-xs text-gray-500">
                    {allUsers.find(u => u.id === node.createdBy)?.name || node.createdBy}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 md:gap-2">
                      {canEditNode(node) && (
                        editingNodeId === node.id ? (
                          <>
                            <button 
                              onClick={saveNodeEdit}
                              className="p-1.5 md:p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                              title={t.saveChanges}
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              onClick={() => setEditingNodeId(null)}
                              className="p-1.5 md:p-2 text-gray-500 hover:bg-gray-500/10 rounded-lg transition-all"
                              title={t.cancel}
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => startEditNode(node)}
                            className="p-1.5 md:p-2 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                            title={t.editNode}
                          >
                            <Edit2 size={18} />
                          </button>
                        )
                      )}
                      
                      {canDeleteNode(node) && editingNodeId !== node.id && (
                        <button 
                          onClick={() => onDeleteNode(node.id)}
                          className="p-1.5 md:p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title={t.deleteUser}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      
                      {!canEditNode(node) && (
                        <AlertCircle size={18} className="text-gray-800 ml-auto" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
