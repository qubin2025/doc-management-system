import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Upload, Search, X, FileText, Check, Download, Package, Database } from 'lucide-react';
import { landReserveArchive, LandReserveItem } from '../data/landReserveArchive';
import { toast } from './Toast';
import ModuleHeader from './ModuleHeader';

interface Props { onBack: () => void; }
const SK = 'land-reserve-data';

const LandReserveArchive: React.FC<Props> = ({ onBack }) => {
  const [items, setItems] = useState<LandReserveItem[]>(() => {
    try { const s = localStorage.getItem(SK); if (s) return JSON.parse(s); } catch {}
    return landReserveArchive;
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [editDialog, setEditDialog] = useState<{idx: number} | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{idx: number} | null>(null);
  const [undoStack, setUndoStack] = useState<LandReserveItem[][]>([]);
  const composingRef = React.useRef(false);

  useEffect(() => { localStorage.setItem(SK, JSON.stringify(items)); }, [items]);

  const renumber = () => setItems(prev => { let s = 0; return prev.map(it => ({ ...it, seq: ++s })); });

  const categories = useMemo(() => {
    const cats = new Map<string, LandReserveItem[]>();
    items.forEach(it => {
      if (!cats.has(it.category)) cats.set(it.category, []);
      cats.get(it.category)!.push(it);
    });
    return cats;
  }, [items]);

  const toggleCat = (cat: string) => setCollapsed(p => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  const pushHistory = () => setUndoStack(p => [...p.slice(-20), JSON.parse(JSON.stringify(items))]);
  const undo = () => {
    if (undoStack.length === 0) { toast('没有可撤销的操作', 'info'); return; }
    setItems(undoStack[undoStack.length - 1]);
    setUndoStack(p => p.slice(0, -1));
    toast('已撤销', 'success');
  };

  const updateItem = (idx: number, field: string, value: any) => {
    pushHistory();
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleUpload = (idx: number, file: File) => {
    pushHistory();
    const it = items[idx];
    let ver = 'V1.0';
    if (it.fileName === file.name) {
      const curVer = parseFloat((it.version || '1.0').replace('V', ''));
      ver = 'V' + (curVer + 0.1).toFixed(1);
    }
    setItems(p => p.map((x, i) => i === idx ? { ...x, fileName: file.name, uploadDate: new Date().toLocaleDateString('zh-CN'), version: ver, uploader: x.uploader || '管理员' } : x));
    toast(`已关联: ${file.name} (${ver})`, 'success');
  };

  const addRow = (afterIdx: number) => {
    pushHistory();
    const base = items[afterIdx];
    const newItem: LandReserveItem = { category: base?.category || '', seq: 0, abbr: '', fileName: '', docNo: '', unit: '', processDate: '', uploadDate: '', uploader: '', version: '', original: false, scanned: false, copies: 1, remark: '' };
    setItems(p => { const n = [...p]; n.splice(afterIdx + 1, 0, newItem); return n; });
    setTimeout(renumber, 0);
  };

  const deleteRow = (idx: number) => setDeleteDialog({ idx });
  const confirmDelete = (mode: 'all' | 'keep-abbr') => {
    const idx = deleteDialog!.idx;
    if (mode === 'all') setItems(p => p.filter((_, i) => i !== idx));
    else setItems(p => p.map((it, i) => i === idx ? { ...it, fileName: '', docNo: '', unit: '', processDate: '', uploadDate: '', original: false, scanned: false, copies: 1, remark: '' } : it));
    setDeleteDialog(null); setTimeout(renumber, 0);
  };

  const openDialog = (idx: number) => setEditDialog({ idx });

  const filtered = useMemo(() => {
    if (!search) return categories;
    const kw = search.toLowerCase();
    const filtered = new Map<string, LandReserveItem[]>();
    items.filter(it => it.abbr.includes(kw) || it.fileName.toLowerCase().includes(kw) || it.category.includes(kw) || it.docNo.includes(kw)).forEach(it => {
      if (!filtered.has(it.category)) filtered.set(it.category, []);
      filtered.get(it.category)!.push(it);
    });
    return filtered;
  }, [items, search, categories]);

  // Stats
  const totalFiles = items.filter(it => it.fileName).length;
  const totalChecked = items.filter(it => it.original || it.scanned).length;

  // Display-only cell values (click to open dialog)
  const Val = ({ value, center }: { value: any; center?: boolean }) => (
    <div className={`text-xs px-1 py-0.5 min-h-[20px] ${center ? 'text-center' : ''}`}>{value || '-'}</div>
  );
  const ChkVal = ({ value }: { value: boolean }) => (
    <div className="flex justify-center">
      <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${value ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200'}`}>
        {value && <Check className="w-3 h-3" />}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <ModuleHeader
        title="土储中心归档移交资料"
        onBack={onBack}
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={renumber} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">重编号</button>
            {undoStack.length > 0 && <button onClick={undo} className="px-3 py-1.5 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100">↩ 撤销({undoStack.length})</button>}
            <button onClick={() => {
              const csv = '分类,序号,文件简称,文件名称,原编字号,编制/审批单位,办理日期,上传日期,原件,扫描件,份数,备注\n' +
                items.map(it => [it.category, it.seq, it.abbr, it.fileName, it.docNo, it.unit, it.processDate, it.uploadDate, it.uploader, it.version, it.original?'是':'否', it.scanned?'是':'否', it.copies, it.remark].join(',')).join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '土储中心归档资料.csv'; a.click();
              toast('CSV已导出', 'success');
            }} className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 flex items-center gap-1"><Download className="w-3.5 h-3.5" />导出CSV</button>
            <button onClick={async () => {
              const JSZip = (await import('jszip')).default;
              const zip = new JSZip();
              const csv = '分类,序号,文件简称,文件名称,原编字号,编制/审批单位,办理日期,上传日期,原件,扫描件,份数,备注\n' +
                items.map(it => [it.category, it.seq, it.abbr, it.fileName, it.docNo, it.unit, it.processDate, it.uploadDate, it.uploader, it.version, it.original?'是':'否', it.scanned?'是':'否', it.copies, it.remark].join(',')).join('\n');
              zip.file('土储中心归档资料.csv', '\uFEFF' + csv);
              const blob = await zip.generateAsync({ type: 'blob' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '土储中心归档资料_打包.zip'; a.click();
              toast('打包下载完成', 'success');
            }} className="px-3 py-1.5 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 flex items-center gap-1"><Package className="w-3.5 h-3.5" />打包下载</button>
            <button onClick={() => {
              localStorage.setItem('land-reserve-backup-' + new Date().toISOString().split('T')[0], JSON.stringify(items));
              toast('备份已保存', 'success');
            }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 flex items-center gap-1"><Database className="w-3.5 h-3.5" />备份</button>
          </div>
        }
      />

      <div className="max-w-full mx-auto px-4 py-4">
        {/* ===== 统计栏 ===== */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-black text-blue-600">{items.length}</div>
            <div className="text-xs text-gray-500">归档条目</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-black text-green-600">{totalFiles}</div>
            <div className="text-xs text-gray-500">已关联文件</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-black text-purple-600">{totalChecked}</div>
            <div className="text-xs text-gray-500">已有原件/扫描件</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-black text-gray-400">{categories.size}</div>
            <div className="text-xs text-gray-500">分类数</div>
          </div>
        </div>

        {/* ===== 搜索栏 ===== */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索分类/简称/文件名/编号..." className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <span className="text-xs text-gray-400">{search ? `找到 ${Array.from(filtered.values()).flat().length} 项` : `共 ${items.length} 项`}</span>
        </div>

        {/* ===== 表格 ===== */}
        <div className="bg-white rounded-xl border" style={{ height: 'calc(100vh - 330px)', overflowY: 'auto' }}>
            <table className="w-full text-xs table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '2%' }}></th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-700 border-r border-gray-200" style={{ width: '5%' }}>分类</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '3%' }}>序号</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-700 border-r border-gray-200" style={{ width: '6%' }}>文件简称</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-700 border-r border-gray-200" style={{ width: '18%' }}>文件名称</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-700 border-r border-gray-200" style={{ width: '10%' }}>原编字号</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-700 border-r border-gray-200" style={{ width: '11%' }}>编制/审批单位</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '6%' }}>办理日期</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '6%' }}>上传日期</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '3%' }}>原件</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '3%' }}>扫描件</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '3%' }}>份数</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-700 border-r border-gray-200" style={{ width: '8%' }}>备注</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700 border-r border-gray-200" style={{ width: '4%' }}>上传</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-700" style={{ width: '5%' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(filtered.entries()).map(([cat, catItems]) => {
                  const isCollapsed = collapsed.has(cat);
                  return (
                    <React.Fragment key={cat}>
                      <tr className="bg-blue-50 cursor-pointer hover:bg-blue-100 border-b" onClick={() => toggleCat(cat)}>
                        <td className="px-2 py-2 text-center">
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-blue-500 inline" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-500 inline" />}
                        </td>
                        <td className="px-2 py-2 font-bold text-blue-700" colSpan={14}>
                          <FileText className="w-3.5 h-3.5 inline mr-1 text-blue-500" />{cat} ({catItems.length}项)
                          <span className="text-[10px] font-normal text-blue-400 ml-2">{isCollapsed ? '点击展开' : '点击收起'}</span>
                        </td>
                      </tr>
                      {!isCollapsed && catItems.map((it) => {
                        const globalIdx = items.indexOf(it);
                        return (
                          <tr key={globalIdx} className={`border-b border-gray-200 ${globalIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30`}>
                            <td className="border-r border-gray-100 px-1 py-1.5"></td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-gray-400 text-[10px]"></td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center text-gray-500">{it.seq}</td>
                            <td className="border-r border-gray-100 px-1 py-1.5 cursor-pointer hover:bg-blue-50" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }} onClick={() => openDialog(globalIdx)}>
                              <Val value={it.abbr} />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-gray-700 cursor-pointer hover:bg-blue-50" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }} onClick={() => openDialog(globalIdx)}>
                              {it.fileName || <span className="text-gray-300 italic">点击编辑</span>}
                              {it.fileName && <div className="text-xs text-gray-500 mt-0.5">{it.uploadDate}{it.version ? ` · ${it.version}` : ''}{it.uploader ? ` · ${it.uploader}` : ''}</div>}
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 cursor-pointer hover:bg-blue-50" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }} onClick={() => openDialog(globalIdx)}>
                              <Val value={it.docNo} />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 cursor-pointer hover:bg-blue-50" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }} onClick={() => openDialog(globalIdx)}>
                              <Val value={it.unit} />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center cursor-pointer hover:bg-blue-50" onClick={() => openDialog(globalIdx)}>
                              <Val value={it.processDate} center />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center text-gray-500 text-xs">
                              {it.uploadDate || '-'}
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center" onClick={() => openDialog(globalIdx)}>
                              <ChkVal value={it.original} />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center" onClick={() => openDialog(globalIdx)}>
                              <ChkVal value={it.scanned} />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center cursor-pointer hover:bg-blue-50" onClick={() => openDialog(globalIdx)}>
                              <Val value={it.copies} center />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 cursor-pointer hover:bg-blue-50" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }} onClick={() => openDialog(globalIdx)}>
                              <Val value={it.remark} />
                            </td>
                            <td className="border-r border-gray-100 px-1 py-1.5 text-center">
                              <button onClick={(e) => { e.stopPropagation(); openDialog(globalIdx); }} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600" title="编辑/上传">
                                <Upload className="w-3 h-3" />
                              </button>
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => addRow(globalIdx)} className="w-5 h-5 flex items-center justify-center rounded border border-green-300 bg-green-50 text-green-600 hover:bg-green-100 font-bold text-sm" title="插入">+</button>
                                <button onClick={() => deleteRow(globalIdx)} className="w-5 h-5 flex items-center justify-center rounded border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 font-bold text-sm" title="删除">×</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
        </div>
      </div>

      {/* ===== 编辑/上传对话框 ===== */}
      {editDialog !== null && (() => {
        const idx = editDialog.idx;
        const it = items[idx];
        return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setEditDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                <span className="text-blue-600 font-mono text-sm">{it.category} | 序号{it.seq}</span>
              </h3>
              <button onClick={() => setEditDialog(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {/* 文件简称 */}
              <div><label className="block text-xs text-gray-500 mb-1">文件简称</label>
                <input value={it.abbr} onChange={e => updateItem(idx, 'abbr', e.target.value)} onCompositionStart={() => composingRef.current = true} onCompositionEnd={(e: any) => { composingRef.current = false; updateItem(idx, 'abbr', e.target.value); }}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              {/* 上传文件 */}
              <div><label className="block text-xs text-gray-500 mb-1">上传文件</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <input type="file" className="hidden" id="land-file" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(idx, f); }} />
                  <label htmlFor="land-file" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-600">{it.fileName || '点击选择文件'}</p>
                  </label>
                </div>
              </div>
              {/* 原编字号 + 办理日期 */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">原编字号</label>
                  <input value={it.docNo} onChange={e => updateItem(idx, 'docNo', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div><label className="block text-xs text-gray-500 mb-1">办理日期</label>
                  <input value={it.processDate} onChange={e => updateItem(idx, 'processDate', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              {/* 编制/审批单位 */}
              <div><label className="block text-xs text-gray-500 mb-1">编制/审批单位</label>
                <input value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              {/* 原件/扫描件/份数 */}
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">原件</label>
                  <button onClick={() => updateItem(idx, 'original', !it.original)}
                    className={`w-full py-2 rounded-lg border-2 text-sm font-bold transition-colors ${it.original ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-400 hover:border-blue-400'}`}>
                    {it.original ? '✓ 是' : '否'}
                  </button>
                </div>
                <div><label className="block text-xs text-gray-500 mb-1">扫描件</label>
                  <button onClick={() => updateItem(idx, 'scanned', !it.scanned)}
                    className={`w-full py-2 rounded-lg border-2 text-sm font-bold transition-colors ${it.scanned ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-400 hover:border-blue-400'}`}>
                    {it.scanned ? '✓ 是' : '否'}
                  </button>
                </div>
                <div><label className="block text-xs text-gray-500 mb-1">份数</label>
                  <input type="number" value={it.copies} onChange={e => updateItem(idx, 'copies', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-center" />
                </div>
              </div>
              {/* 备注 */}
              <div><label className="block text-xs text-gray-500 mb-1">备注</label>
                <input value={it.remark} onChange={e => updateItem(idx, 'remark', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              {/* 上传人 + 版本号 */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">上传人</label>
                  <input value={it.uploader || ''} onChange={e => updateItem(idx, 'uploader', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="默认管理员" />
                </div>
                <div className="text-xs text-gray-500">
                  <label className="block mb-1">上传日期/版本</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">{it.uploadDate || '未上传'}{it.version ? ` · ${it.version}` : ''}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button onClick={() => setEditDialog(null)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={() => { setEditDialog(null); toast('已保存', 'success'); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">完成</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ===== 删除确认对话框 ===== */}
      {deleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setDeleteDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">确认删除</h3>
            <p className="text-sm text-gray-500 mb-4">"{items[deleteDialog.idx]?.abbr || '未命名'}"</p>
            <button onClick={() => confirmDelete('all')} className="w-full px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm mb-2">🗑 删除整行 — 全部信息</button>
            <button onClick={() => confirmDelete('keep-abbr')} className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 text-sm">📝 保留文件简称 — 仅清空其他</button>
            <button onClick={() => setDeleteDialog(null)} className="w-full mt-3 px-4 py-2 border rounded-lg text-sm text-gray-500">取消</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandReserveArchive;
