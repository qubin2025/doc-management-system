import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Calculator } from 'lucide-react';

interface Props { onBack: () => void; }

interface CostItem { id: string; category: string; item: string; unit: string; quantity: number; unitPrice: number; total: number; date: string; }

const SK = 'cost-data';

const CATEGORIES = ['土建工程', '安装工程', '装饰工程', '市政工程', '设备采购', '咨询服务', '其他'];

const CostManager: React.FC<Props> = ({ onBack }) => {
  const [items, setItems] = useState<CostItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<CostItem>({ id: '', category: '土建工程', item: '', unit: 'm²', quantity: 0, unitPrice: 0, total: 0, date: new Date().toISOString().split('T')[0] });

  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem(SK) || '[]')); } catch {} }, []);
  const save = (s: CostItem[]) => { setItems(s); localStorage.setItem(SK, JSON.stringify(s)); };

  const add = () => {
    if (!form.item) return;
    save([...items, { ...form, id: Date.now().toString(), total: Math.round(form.quantity * form.unitPrice * 100) / 100 }]);
    setForm({ id: '', category: '土建工程', item: '', unit: 'm²', quantity: 0, unitPrice: 0, total: 0, date: new Date().toISOString().split('T')[0] });
    setShowAdd(false);
  };

  const del = (id: string) => save(items.filter(s => s.id !== id));

  const filtered = items.filter(i => !filter || i.category === filter);
  const totalCost = filtered.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center"><span className="text-white font-black text-[10px]">ZHJK</span></div>
            <h1 className="text-lg font-bold text-gray-800">造价数据</h1>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 text-sm"><Plus className="w-4 h-4" />添加条目</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 汇总 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">造价条目</div><div className="text-2xl font-black">{items.length}</div></div>
          <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-4"><div className="text-xs text-gray-500">合计总额</div><div className="text-2xl font-black text-cyan-600">{totalCost.toLocaleString()}</div><div className="text-xs text-gray-400">元</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">平均单价</div><div className="text-2xl font-black">{items.length > 0 ? Math.round(totalCost / items.length).toLocaleString() : '0'}</div><div className="text-xs text-gray-400">元/项</div></div>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilter('')} className={`px-3 py-1 text-xs rounded-full ${!filter ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600'}`}>全部</button>
          {CATEGORIES.map(c => <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1 text-xs rounded-full ${filter === c ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>)}
        </div>

        {/* 列表 */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-3">类别</th><th className="px-4 py-3">项目</th><th className="px-4 py-3">单位</th><th className="px-4 py-3 text-right">数量</th><th className="px-4 py-3 text-right">单价(元)</th><th className="px-4 py-3 text-right">合计(元)</th><th className="px-4 py-3">日期</th><th className="px-4 py-3 w-16"></th></tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">暂无造价数据，点击"添加条目"录入</td></tr>
              ) : filtered.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="px-2 py-0.5 text-[10px] bg-cyan-50 text-cyan-700 rounded">{i.category}</span></td>
                  <td className="px-4 py-3 font-medium text-gray-800">{i.item}</td>
                  <td className="px-4 py-3 text-gray-500">{i.unit}</td>
                  <td className="px-4 py-3 text-right">{i.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{i.unitPrice.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold">{i.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{i.date}</td>
                  <td className="px-4 py-3"><button onClick={() => del(i.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
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
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-cyan-500" />添加造价条目</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">类别</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">项目名称</label><input value={form.item} onChange={e => setForm(p => ({ ...p, item: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-xs text-gray-500 mb-1">单位</label><input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">数量</label><input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">单价(元)</label><input type="number" value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">日期</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm font-bold">合计: {Math.round(form.quantity * form.unitPrice * 100) / 100} 元</div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 border rounded-lg text-sm">取消</button>
              <button onClick={add} className="px-4 py-1.5 bg-cyan-500 text-white rounded-lg text-sm">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostManager;
