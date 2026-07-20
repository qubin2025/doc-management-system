import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Search, X, Filter, ChevronRight, Shield, Edit3, Plus, Trash2, Upload, Save, Undo2, User, Download } from 'lucide-react';
import * as documentParser from '../data/documentParser';

interface Props { onBack: () => void; }

interface RegDoc {
  id: string; title: string; category: string; publishDate: string; department: string; status: '现行有效' | '已废止' | '即将实施'; fileNo: string;
  content?: string;
  attachments?: { name: string; uploadTime: string; uploader: string; content?: string }[];
}

const DEFAULT_DATA: RegDoc[] = [
  { id: '1', title: '北京市土地储备和一级开发管理暂行办法', category: '地方规章', publishDate: '2023-06-01', department: '北京市规划和自然资源委员会', status: '现行有效', fileNo: '京政发〔2023〕15号' },
  { id: '2', title: '土地储备管理办法', category: '部门规章', publishDate: '2023-01-10', department: '自然资源部', status: '现行有效', fileNo: '自然资源部令第5号' },
  { id: '3', title: '北京市土地储备资金管理办法', category: '资金管理', publishDate: '2022-09-15', department: '北京市财政局', status: '现行有效', fileNo: '京财建〔2022〕28号' },
  { id: '4', title: '国有土地上房屋征收与补偿条例', category: '行政法规', publishDate: '2011-01-21', department: '国务院', status: '现行有效', fileNo: '国务院令第590号' },
  { id: '5', title: '土地储备项目成本核算规范', category: '技术规范', publishDate: '2024-03-20', department: '自然资源部', status: '现行有效', fileNo: '自然资发〔2024〕8号' },
  { id: '6', title: '北京市土地储备项目档案管理办法', category: '档案管理', publishDate: '2023-11-05', department: '北京市土地储备中心', status: '现行有效', fileNo: '京土储〔2023〕42号' },
  { id: '7', title: '关于进一步加强土地储备和一级开发管理的通知', category: '通知公告', publishDate: '2024-01-15', department: '北京市规自委', status: '现行有效', fileNo: '京规自发〔2024〕3号' },
  { id: '8', title: '土地储备监测监管系统数据标准', category: '技术规范', publishDate: '2022-06-30', department: '自然资源部', status: '现行有效', fileNo: 'TD/T 1050-2022' },
  { id: '9', title: '北京市征地补偿安置办法', category: '地方规章', publishDate: '2021-05-20', department: '北京市人民政府', status: '现行有效', fileNo: '北京市人民政府令第148号' },
  { id: '10', title: '土地储备项目验收管理办法（试行）', category: '管理办法', publishDate: '2023-08-01', department: '自然资源部', status: '即将实施', fileNo: '自然资办发〔2023〕21号' },
  { id: '11', title: '市政基础设施工程资料管理规程 DB11/T 808-2020', category: '地方标准', publishDate: '2020-05-01', department: '北京市住建委', status: '现行有效', fileNo: 'DB11/T 808-2020' },
  { id: '12', title: '建筑工程资料管理规程 DB11/T 695-2025', category: '地方标准', publishDate: '2025-01-01', department: '北京市住建委', status: '即将实施', fileNo: 'DB11/T 695-2025' },
  { id: '13', title: '土地储备项目移交工作规程', category: '工作规程', publishDate: '2024-02-10', department: '北京市土地储备中心', status: '现行有效', fileNo: '京土储办〔2024〕6号' },
  { id: '14', title: '关于规范土地储备项目前期开发成本核算的通知', category: '通知公告', publishDate: '2023-05-12', department: '北京市财政局', status: '现行有效', fileNo: '京财综〔2023〕11号' },
];
const CATEGORIES = ['全部', '行政法规', '部门规章', '地方规章', '管理办法', '技术规范', '地方标准', '工作规程', '档案管理', '资金管理', '通知公告'];
const SK = 'regulations-library-data';
const isAdmin = () => { try { const a = JSON.parse(localStorage.getItem('doc-system-auth') || '{}'); return a.user?.role === 'admin'; } catch { return false; } };

const RegulationsLibrary: React.FC<Props> = ({ onBack }) => {
  const [items, setItems] = useState<RegDoc[]>(() => { try { const s = localStorage.getItem(SK); if (s) return JSON.parse(s); } catch {} return DEFAULT_DATA; });
  const [search, setSearch] = useState(''); const [catFilter, setCatFilter] = useState('全部'); const [statusFilter, setStatusFilter] = useState('全部');
  const [selectedDoc, setSelectedDoc] = useState<RegDoc | null>(null);
  const [editDoc, setEditDoc] = useState<RegDoc | null>(null);
  const [undoStack, setUndoStack] = useState<RegDoc[][]>([]);
  const admin = isAdmin();

  useEffect(() => { localStorage.setItem(SK, JSON.stringify(items)); }, [items]);
  const pushHistory = () => setUndoStack(p => [...p.slice(-20), JSON.parse(JSON.stringify(items))]);
  const undo = () => { if (undoStack.length === 0) return; setItems(undoStack[undoStack.length - 1]); setUndoStack(p => p.slice(0, -1)); };
  const saveEdit = () => { if (!editDoc) return; pushHistory(); setItems(p => p.map(it => it.id === editDoc.id ? editDoc : it)); setEditDoc(null); };
  const addDoc = () => { pushHistory(); const d: RegDoc = { id: Date.now().toString(), title: '新制度文件', category: '管理办法', publishDate: new Date().toISOString().split('T')[0], department: '', status: '现行有效', fileNo: '', attachments: [] }; setItems(p => [d, ...p]); };
  const deleteDoc = (id: string) => { if (!confirm('确认删除？')) return; pushHistory(); setItems(p => p.filter(it => it.id !== id)); if (selectedDoc?.id === id) setSelectedDoc(null); };

  const filtered = useMemo(() => items.filter(d => {
    if (catFilter !== '全部' && d.category !== catFilter) return false;
    if (statusFilter !== '全部' && d.status !== statusFilter) return false;
    if (search && !d.title.includes(search) && !d.fileNo.includes(search) && !d.department.includes(search)) return false;
    return true;
  }), [items, search, catFilter, statusFilter]);

  if (selectedDoc) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b sticky top-0 z-30"><div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => setSelectedDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1"><h1 className="text-lg font-bold">{selectedDoc.title}</h1><p className="text-xs text-gray-400">{selectedDoc.fileNo} · {selectedDoc.department} · {selectedDoc.publishDate}</p></div>
          {admin && (<div className="flex gap-1"><button onClick={() => { setEditDoc(selectedDoc); setSelectedDoc(null); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit3 className="w-4 h-4" /></button><button onClick={() => deleteDoc(selectedDoc.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div>)}
        </div></header>
        <div className="max-w-4xl mx-auto px-4 py-8"><div className="bg-white rounded-xl border p-8 min-h-[400px] text-sm leading-relaxed">
          <div className="flex justify-between mb-6 pb-4 border-b text-sm"><span>发布机构: <b>{selectedDoc.department}</b></span><span>发布日期: <b>{selectedDoc.publishDate}</b></span><span className={`px-2 py-0.5 rounded-full text-sm font-bold ${selectedDoc.status === '现行有效' ? 'bg-green-100 text-green-700' : selectedDoc.status === '已废止' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{selectedDoc.status}</span></div>
          <h2 className="text-xl font-bold text-center mb-8">{selectedDoc.title}</h2>
          {(() => {
            const attachment = selectedDoc.attachments?.find(a => a.content);
            if (selectedDoc.content) {
              return <div className="text-sm leading-8 whitespace-pre-wrap text-gray-700">{selectedDoc.content}</div>;
            }
            if (attachment) {
              return <div className="text-sm leading-8 whitespace-pre-wrap text-gray-700">{attachment.content}</div>;
            }
            return (
            <p className="text-center text-gray-400">暂无正文内容，请上传制度文档附件自动提取全文</p>
          );})()}
          {selectedDoc.attachments && selectedDoc.attachments.length > 0 && (<div className="mt-6 pt-4 border-t"><p className="text-xs font-bold text-gray-500 mb-2">附件 ({selectedDoc.attachments.length})</p>{selectedDoc.attachments.map((a,i) => <div key={i} className="flex items-center justify-between text-xs text-gray-500 py-1"><span>{a.name} · {a.uploader} · {a.uploadTime}</span><button className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"><Download className="w-3 h-3" />下载</button></div>)}</div>)}
        </div></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-teal-600 flex items-center justify-center rounded-lg"><Shield className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-lg font-bold text-gray-800">制度规范库</h1><p className="text-[10px] text-gray-400">土储中心制度与规范文件{!admin && ' · 仅管理员可编辑'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex items-center gap-1"><User className="w-3.5 h-3.5" />{admin ? '管理员' : '访客'}</span>
            {admin && (<>
              <button onClick={addDoc} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"><Plus className="w-3 h-3" />新增</button>
              {undoStack.length > 0 && <button onClick={undo} className="px-2 py-1 text-xs bg-amber-50 text-amber-600 rounded hover:bg-amber-100 flex items-center gap-1"><Undo2 className="w-3 h-3" />撤销</button>}
            </>)}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="w-44 shrink-0"><div className="bg-white rounded-xl border p-4 sticky top-20"><h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Filter className="w-4 h-4" />分类</h3><div className="space-y-1">{CATEGORIES.map(c => <button key={c} onClick={() => setCatFilter(c)} className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg ${catFilter === c ? 'bg-teal-50 text-teal-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>{c}</button>)}</div></div></aside>
          <main className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索标题/文号/机构..." className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />{search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}</div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white"><option value="全部">全部状态</option><option value="现行有效">✓ 现行有效</option><option value="即将实施">即将实施</option><option value="已废止">已废止</option></select>
            </div>
            <div className="bg-white rounded-xl border">
              <div className="px-4 py-3 border-b bg-gray-50 text-sm text-gray-500">共 {filtered.length} 条</div>
              {filtered.map(d => (
                <div key={d.id} className="px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedDoc(d)}>
                      <h3 className="text-sm font-bold text-gray-800 hover:text-teal-600 mb-1">{d.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400"><span>{d.fileNo}</span><span>{d.department}</span><span>{d.publishDate}</span></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-sm font-bold ${d.status === '现行有效' ? 'bg-green-100 text-green-700' : d.status === '已废止' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{d.status}</span>
                      {admin && (<div className="flex gap-1 ml-2"><button onClick={(e) => { e.stopPropagation(); setEditDoc(d); }} className="p-1 text-blue-400 hover:text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button><button onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>

      {editDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setEditDoc(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">编辑: {editDoc.title.slice(0, 20)}</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">文件名称</label><input value={editDoc.title} onChange={e => setEditDoc(p => ({ ...p!, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">分类</label><select value={editDoc.category} onChange={e => setEditDoc(p => ({ ...p!, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white">{CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs text-gray-500 mb-1">文号</label><input value={editDoc.fileNo} onChange={e => setEditDoc(p => ({ ...p!, fileNo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" /></div><div><label className="block text-xs text-gray-500 mb-1">颁布单位</label><input value={editDoc.department} onChange={e => setEditDoc(p => ({ ...p!, department: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">生效时间</label><input value={editDoc.publishDate} onChange={e => setEditDoc(p => ({ ...p!, publishDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" /></div><div><label className="block text-xs text-gray-500 mb-1">状态</label><select value={editDoc.status} onChange={e => setEditDoc(p => ({ ...p!, status: e.target.value as any }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white"><option value="现行有效">现行有效</option><option value="已废止">已废止</option><option value="即将实施">即将实施</option></select></div></div>
              <div><label className="block text-xs text-gray-500 mb-1">附件</label>{(editDoc.attachments || []).map((a, i) => <div key={i} className="text-xs text-gray-500 py-1">{a.name} · {a.uploader} · {a.uploadTime}</div>)}<label className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer text-xs"><Upload className="w-3 h-3" />上传附件<input type="file" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { let text = ''; try { text = await documentParser.parseDocument(f); } catch {} const att = { name: f.name, uploadTime: new Date().toLocaleString('zh-CN'), uploader: '管理员', content: text }; setEditDoc(p => ({ ...p!, attachments: [...(p!.attachments || []), att], content: p?.content || text })); } }} /></label></div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t"><button onClick={() => setEditDoc(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white">取消</button><button onClick={saveEdit} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" />保存</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulationsLibrary;
