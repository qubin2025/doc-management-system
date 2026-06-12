import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Star, Search } from 'lucide-react';

interface Props { onBack: () => void; }

interface Supplier { id: string; name: string; category: string; contact: string; phone: string; rating: number; status: '已审核' | '待审核' | '黑名单'; remark: string; }

const SK = 'supplier-data';

const SupplierManager: React.FC<Props> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Supplier>({ id: '', name: '', category: '', contact: '', phone: '', rating: 3, status: '待审核', remark: '' });

  useEffect(() => { try { setSuppliers(JSON.parse(localStorage.getItem(SK) || '[]')); } catch {} }, []);
  const save = (s: Supplier[]) => { setSuppliers(s); localStorage.setItem(SK, JSON.stringify(s)); };

  const add = () => {
    if (!form.name) return;
    save([...suppliers, { ...form, id: Date.now().toString() }]);
    setForm({ id: '', name: '', category: '', contact: '', phone: '', rating: 3, status: '待审核', remark: '' });
    setShowAdd(false);
  };

  const del = (id: string) => save(suppliers.filter(s => s.id !== id));
  const toggleStatus = (id: string) => save(suppliers.map(s => s.id === id ? { ...s, status: s.status === '已审核' ? '待审核' as const : '已审核' as const } : s));

  const filtered = suppliers.filter(s => s.name.includes(search) || s.category.includes(search) || s.contact.includes(search));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center"><span className="text-white font-black text-[10px]">ZHJK</span></div>
            <h1 className="text-lg font-bold text-gray-800">供应商库</h1>
            <span className="text-sm text-gray-400">{suppliers.length}家</span>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm"><Plus className="w-4 h-4" />添加</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">总供应商</div><div className="text-2xl font-black">{suppliers.length}</div></div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4"><div className="text-xs text-gray-500">已审核</div><div className="text-2xl font-black text-green-600">{suppliers.filter(s => s.status === '已审核').length}</div></div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><div className="text-xs text-gray-500">待审核</div><div className="text-2xl font-black text-amber-600">{suppliers.filter(s => s.status === '待审核').length}</div></div>
        </div>

        {/* 搜索 */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索供应商名称/类别/联系人..." className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" />
        </div>

        {/* 列表 */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-3">供应商</th><th className="px-4 py-3">类别</th><th className="px-4 py-3">联系人</th><th className="px-4 py-3">电话</th><th className="px-4 py-3 text-center">评分</th><th className="px-4 py-3 text-center">状态</th><th className="px-4 py-3 w-16"></th></tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">暂无供应商，点击"添加"录入</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.category || '-'}</td>
                  <td className="px-4 py-3">{s.contact || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1,2,3,4,5].map(st => <Star key={st} className={`w-3.5 h-3.5 ${st <= s.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleStatus(s.id)} className={`px-2 py-0.5 text-[10px] rounded-full ${s.status === '已审核' ? 'bg-green-100 text-green-700' : s.status === '黑名单' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</button>
                  </td>
                  <td className="px-4 py-3"><button onClick={() => del(s.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">添加供应商</h3>
            <div className="space-y-3">
              {[{ label: '名称', key: 'name' }, { label: '类别', key: 'category' }, { label: '联系人', key: 'contact' }, { label: '电话', key: 'phone' }, { label: '备注', key: 'remark' }].map(f => (
                <div key={f.key}><label className="block text-xs text-gray-500 mb-1">{f.label}</label><input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              ))}
              <div><label className="block text-xs text-gray-500 mb-1">评分</label>
                <select value={form.rating} onChange={e => setForm(p => ({ ...p, rating: parseInt(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {[1,2,3,4,5].map(r => <option key={r} value={r}>{'⭐'.repeat(r)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 border rounded-lg text-sm">取消</button>
              <button onClick={add} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManager;
