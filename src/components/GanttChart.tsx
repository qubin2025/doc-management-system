import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, FileDown, ChevronRight, ChevronDown, Plus, Trash2, ZoomIn, ZoomOut, Maximize2, Printer, CornerDownRight, CornerUpLeft, Edit3, Download } from 'lucide-react';
import { computeCpm, parseScheduleFromRows, CpmResult, CpmTaskResult } from '../data/cpmEngine';
import { toast } from './Toast';
import * as XLSX from 'xlsx';

interface Props { onCpmUpdate?: (result: CpmResult) => void; initialResult?: CpmResult | null; }

type ContextMenu = { x: number; y: number; taskId: string } | null;

interface TaskRow extends CpmTaskResult { level: number; children: string[]; parentId?: string; }

const COL_DEFAULTS = [40, 24, 160, 48, 84, 84, 130, 130];

const GanttChart: React.FC<Props> = ({ onCpmUpdate, initialResult }) => {
  const [cpmResult, setCpmResult] = useState<CpmResult | null>(initialResult || null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [editedTasks, setEditedTasks] = useState<Record<string, Partial<TaskRow>>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [colWidths, setColWidths] = useState<number[]>(COL_DEFAULTS);
  const [resizing, setResizing] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showExport, setShowExport] = useState(false);
  const [exportScale, setExportScale] = useState(100);
  const [exportCols, setExportCols] = useState([true, true, true, true, true, true, true, true, false]); // +甘特图列
  const [fitPaper, setFitPaper] = useState(true);
  const [paperSize, setPaperSize] = useState('A3');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [exportFormat, setExportFormat] = useState('html');
  const [stitchMode, setStitchMode] = useState('single');
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayWidth = 24 * zoom;
  const rowH = 34;
  const colTotal = colWidths.reduce((a, b) => a + b, 0);
  const totalDays = cpmResult?.totalDuration || 100;

  // Build task rows with hierarchy
  const rows = useMemo((): TaskRow[] => {
    if (!cpmResult) return [];
    return cpmResult.tasks.map(t => {
      const edits = editedTasks[t.id] || {};
      return { ...t, ...edits, level: edits.level ?? 0, children: edits.children ?? [], parentId: edits.parentId } as TaskRow;
    });
  }, [cpmResult, editedTasks]);

  const successors = useMemo(() => {
    const map: Record<string, string[]> = {};
    rows.forEach(t => { map[t.id] = rows.filter(s => s.predecessors.includes(t.id)).map(s => s.name); });
    return map;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const result: TaskRow[] = [];
    const hidden = new Set<string>();
    // Mark children of collapsed parents as hidden
    for (const r of rows) {
      if (r.parentId && collapsed.has(r.parentId)) hidden.add(r.id);
      if (collapsed.has(r.id)) {
        for (const childId of (r.children || [])) hidden.add(childId);
      }
    }
    rows.forEach(r => { if (!hidden.has(r.id)) result.push(r); });
    return result;
  }, [rows, collapsed]);

  // Column resize
  useEffect(() => {
    if (resizing === null) return;
    const onMove = (e: MouseEvent) => {
      setColWidths(prev => {
        const n = [...prev];
        n[resizing] = Math.max(24, n[resizing] + e.movementX);
        return n;
      });
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing]);

  // Close menu
  useEffect(() => { const c = () => setContextMenu(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, []);

  const updateTask = (id: string, patch: Partial<TaskRow>) => {
    setEditedTasks(p => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }));
  };

  // Row operations
  const addRow = (afterId: string) => {
    const idx = rows.findIndex(r => r.id === afterId);
    if (idx < 0) return;
    const newId = 'new-' + Date.now();
    const base = rows[idx];
    const newTask: TaskRow = {
      ...base, id: newId, name: '新任务', duration: 5, es: base.ef, ef: base.ef + 5, ls: base.lf - 5, lf: base.lf,
      float: 0, critical: false, progress: 0, predecessors: [base.id], level: base.level, children: [], parentId: base.parentId,
    };
    setEditedTasks(p => ({ ...p, [newId]: newTask }));
    setSelectedRow(newId);
  };

  const deleteRow = (id: string) => {
    const r = rows.find(t => t.id === id);
    if (!r || rows.length <= 1) return;
    // Remove from predecessors of dependent tasks
    const updates: Record<string, Partial<TaskRow>> = {};
    rows.forEach(t => {
      if (t.predecessors.includes(id)) {
        updates[t.id] = { predecessors: t.predecessors.filter(p => p !== id) };
      }
    });
    setEditedTasks(p => {
      const n = { ...p, ...updates };
      delete n[id];
      return n;
    });
    setSelectedRow(null);
  };

  const promoteTask = (id: string) => {
    updateTask(id, { level: Math.max(0, (rows.find(r => r.id === id)?.level || 1) - 1) });
  };

  const demoteTask = (id: string) => {
    const r = rows.find(t => t.id === id);
    if (!r) return;
    const idx = rows.findIndex(t => t.id === id);
    if (idx > 0) {
      updateTask(rows[idx - 1].id, { children: [...(rows[idx - 1].children || []), id] });
      updateTask(id, { level: (r.level || 0) + 1, parentId: rows[idx - 1].id });
    }
  };

  // Right click → edit name
  const startEdit = (id: string, name: string) => {
    setEditingName(id); setEditValue(name);
  };
  const saveEdit = () => {
    if (editingName) { updateTask(editingName, { name: editValue }); setEditingName(null); }
  };

  const handleMenuAction = (action: string, taskId: string) => {
    setContextMenu(null);
    const task = rows.find(t => t.id === taskId);
    if (!task) return;
    switch (action) {
      case 'moveUp': updateTask(taskId, { es: Math.max(0, task.es - 1), ef: task.ef - 1, ls: task.ls - 1, lf: task.lf - 1 }); break;
      case 'moveDown': updateTask(taskId, { es: task.es + 1, ef: task.ef + 1, ls: task.ls + 1, lf: task.lf + 1 }); break;
      case 'extend': updateTask(taskId, { duration: task.duration + 1, ef: task.ef + 1, lf: task.lf + 1 }); break;
      case 'shrink': if (task.duration > 1) updateTask(taskId, { duration: task.duration - 1, ef: task.ef - 1, lf: task.lf - 1 }); break;
      case 'addAbove': { const idx = rows.findIndex(r => r.id === taskId); if (idx > 0) addRow(rows[idx - 1].id); break; }
      case 'addBelow': addRow(taskId); break;
      case 'delete': deleteRow(taskId); break;
      case 'promote': promoteTask(taskId); break;
      case 'demote': demoteTask(taskId); break;
      case 'rename': startEdit(taskId, task.name); break;
      case 'reset': setEditedTasks(p => { const n = { ...p }; delete n[taskId]; return n; }); break;
    }
  };

  const downloadTemplate = () => {
    const data = [
      ['序号', '任务名称', '工期(天)', '开始日期', '结束日期', '前置任务(逗号分隔)', '进度%'],
      [1, '施工准备', 5, '2025-03-01', '2025-03-06', '', 100],
      [2, '土方开挖', 10, '2025-03-06', '2025-03-16', '1', 100],
      [3, '基础垫层', 7, '2025-03-16', '2025-03-23', '2', 80],
      [4, '基础钢筋', 8, '2025-03-23', '2025-03-31', '3', 0],
      [5, '基础混凝土', 5, '2025-03-31', '2025-04-05', '4', 0],
      [6, '基础养护', 7, '2025-04-05', '2025-04-12', '5', 0],
      [7, '主体钢结构', 20, '2025-04-12', '2025-05-02', '6', 0],
      [8, '主体混凝土', 15, '2025-05-02', '2025-05-17', '7', 0],
      [9, '屋面工程', 10, '2025-05-17', '2025-05-27', '8', 0],
      [10, '装饰装修', 20, '2025-05-27', '2025-06-16', '8', 0],
      [11, '机电安装', 15, '2025-05-27', '2025-06-11', '8', 0],
      [12, '室外工程', 12, '2025-06-16', '2025-06-28', '10,11', 0],
      [13, '竣工验收', 5, '2025-06-28', '2025-07-03', '12', 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:6},{wch:18},{wch:10},{wch:12},{wch:12},{wch:18},{wch:8}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '施工计划');
    XLSX.writeFile(wb, '施工计划_样表.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const buf = await f.arrayBuffer(); const wb = XLSX.read(buf);
      const rows_raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
      const parsed = parseScheduleFromRows(rows_raw.slice(1));
      if (parsed.length === 0) { toast('未解析到有效数据', 'warning'); return; }
      const result = computeCpm(parsed);
      setCpmResult(result); setEditedTasks({}); setSelectedRow(null);
      if (onCpmUpdate) onCpmUpdate(result);
      toast(`导入${parsed.length}个任务，总工期${result.totalDuration}天`, 'success');
    } catch { toast('导入失败', 'error'); }
    e.target.value = '';
  };

  const fitAll = () => { if (scrollRef.current) scrollRef.current.scrollTo({ left: 0, top: 0 }); setZoom(0.5); };
  const zoomIn = () => setZoom(z => Math.min(3, +(z * 1.2).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.2, +(z / 1.2).toFixed(2)));
  const printView = () => window.print();

  const handleExport = () => {
    const colNames = ['WBS', '任务名称', '用时', '开始', '结束', '前置任务', '后续任务', '甘特图'];
    const selected = colNames.filter((_, i) => exportCols[i]);
    const colIdx = exportCols.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const hasGantt = exportCols[8]; // 是否导出甘特图列
    const scaleInfo = fitPaper ? '自适应纸张' : exportScale + '%';
    const dateStr = new Date().toISOString().split('T')[0];
    const baseName = '施工计划甘特图_' + dateStr;
    const ganttTotalDays = totalDays;
    const ganttScale = fitPaper ? Math.min(3, 800 / ganttTotalDays) : exportScale / 100;

    if (exportFormat === 'xlsx') {
      const header = selected;
      const data = [header, ...rows.map(t => colIdx.map(i => {
        if (i === 0) return t.id; if (i === 1) return t.name; if (i === 2) return t.duration + '天';
        if (i === 3) return new Date(2025, 2, 1 + t.es).toLocaleDateString('zh-CN');
        if (i === 4) return new Date(2025, 2, 1 + t.ef).toLocaleDateString('zh-CN');
        if (i === 5) return t.predecessors.join(',') || '-';
        if (i === 6) return (successors[t.id] || []).join(',') || '-';
        if (i === 8) return '▋'.repeat(Math.max(1, Math.round(t.duration * ganttScale))) + ' ' + t.name.slice(0, 8);
        return '';
      }))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '甘特图');
      XLSX.writeFile(wb, baseName + '.xlsx');
      toast('已导出XLSX', 'success');
    } else if (exportFormat === 'docx' || exportFormat === 'html') {
      const ganttBarWidth = Math.max(200, ganttTotalDays * ganttScale + 20);
      const makeGanttBar = (t: typeof rows[0]) => {
        const left = t.es * ganttScale;
        const width = Math.max(2, t.duration * ganttScale);
        const color = t.critical ? '#ef4444' : (t.progress || 0) === 100 ? '#22c55e' : '#3b82f6';
        const label = width > 25 ? `<span style="font-size:8px;color:#fff;padding:0 4px;overflow:hidden;white-space:nowrap">${t.name.slice(0, 10)}</span>` : '';
        return `<div style="position:relative;height:20px;width:${ganttBarWidth}px"><div style="position:absolute;left:${left}px;top:3px;width:${width}px;height:14px;background:${color};border-radius:3px;display:flex;align-items:center">${label}</div></div>`;
      };
      const tableRows = rows.map(t => `<tr>${colIdx.map(i =>
        i === 8
          ? `<td style="min-width:${ganttBarWidth}px;overflow:visible">${makeGanttBar(t)}</td>`
          : `<td>${i===0?t.id:i===1?t.name:i===2?t.duration+'天':i===3?new Date(2025,2,1+t.es).toLocaleDateString('zh-CN'):i===4?new Date(2025,2,1+t.ef).toLocaleDateString('zh-CN'):i===5?t.predecessors.join(',')||'-':i===6?(successors[t.id]||[]).join(',')||'-':''}</td>`
      ).join('')}</tr>`).join('\n');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>施工计划甘特图</title>
<style>body{font-family:'Microsoft YaHei';font-size:12px;padding:20px}h1{text-align:center;font-size:16px}
table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:4px 6px;border:1px solid #ccc;text-align:left;vertical-align:middle}
th{background:#f5f5f5}.gantt-td{overflow:visible!important}@page{size:${paperSize} ${orientation};margin:10mm}
@media print{body{padding:0}}</style></head><body>
<h1>施工计划甘特图</h1><p>导出:${new Date().toLocaleString('zh-CN')} | 纸张:${paperSize} ${orientation==='landscape'?'横向':'纵向'} | 比例:${scaleInfo}${hasGantt ? ' | 甘特图自动缩放' : ''}</p>
<table><thead><tr>${selected.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
      const ext = exportFormat === 'docx' ? '.doc' : '.html';
      const mime = exportFormat === 'docx' ? 'application/msword' : 'text/html;charset=utf-8';
      const blob = new Blob(['\uFEFF' + html], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = baseName + ext; a.click();
      URL.revokeObjectURL(url);
      toast('已导出: ' + baseName + ext, 'success');
    } else {
      window.print();
    }
    setShowExport(false);
  };

  const toolbar = [
    { icon: <Plus className="w-3.5 h-3.5" />, label: '在选中行下方添加', action: () => selectedRow && addRow(selectedRow) },
    { icon: <Trash2 className="w-3.5 h-3.5" />, label: '删除选中行', action: () => selectedRow && deleteRow(selectedRow) },
    { icon: <CornerUpLeft className="w-3.5 h-3.5" />, label: '升级为父任务', action: () => selectedRow && promoteTask(selectedRow) },
    { icon: <CornerDownRight className="w-3.5 h-3.5" />, label: '降级为子任务', action: () => selectedRow && demoteTask(selectedRow) },
    { icon: <Edit3 className="w-3.5 h-3.5" />, label: '编辑名称(F2)', action: () => selectedRow && startEdit(selectedRow, rows.find(r => r.id === selectedRow)?.name || '') },
    { type: 'sep' },
    { icon: <ZoomOut className="w-3.5 h-3.5" />, label: '缩小', action: zoomOut },
    { icon: <ZoomIn className="w-3.5 h-3.5" />, label: '放大', action: zoomIn },
    { icon: <Maximize2 className="w-3.5 h-3.5" />, label: '全图预览', action: fitAll },
    { icon: <Printer className="w-3.5 h-3.5" />, label: '打印', action: printView },
    { icon: <Download className="w-3.5 h-3.5" />, label: '导出', action: () => setShowExport(true) },
  ];

  // F2 edit shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && selectedRow) startEdit(selectedRow, rows.find(r => r.id === selectedRow)?.name || ''); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [selectedRow]);

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <label className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer text-sm" title="导入xlsx格式施工计划表">
          <Upload className="w-4 h-4" />导入
          <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleImport} />
        </label>
        <button onClick={downloadTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 border text-sm" title="下载施工计划样表模板">
          <FileDown className="w-4 h-4" />样表
        </button>
        <span className="w-px h-5 bg-gray-200" />
        {toolbar.filter(t => 'action' in t).map((t, i) => (
          t.type === 'sep' ? <span key={i} className="w-px h-5 bg-gray-200" /> :
          <button key={i} onClick={(t as any).action} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors" title={(t as any).label}>
            {(t as any).icon}
          </button>
        ))}
        {cpmResult && <span className="text-xs text-gray-400 ml-auto">WBS{rows.length} | 总工期<b>{cpmResult.totalDuration}天</b> | 关键<b className="text-red-500">{cpmResult.criticalPath.length}</b> | 选中:{selectedRow || '-'}</span>}
      </div>

      {!cpmResult ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <Upload className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">导入 xlsx 计划表以生成甘特图</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* 表头 — 列宽对齐 */}
          <div className="flex border-b bg-gray-50 text-[11px] font-semibold text-gray-700 sticky top-0 z-10 print:text-black">
            {['WBS', '', '任务名称', '用时', '开始', '结束', '前置任务', '后续任务'].map((h, i) => (
              <div key={i} className="relative px-2 py-2 border-r shrink-0 overflow-hidden flex items-center" style={{ width: colWidths[i] }}>
                {h}
                <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300" onMouseDown={e => { e.preventDefault(); setResizing(i); }} />
              </div>
            ))}
            <div className="flex-1 px-2 py-2">甘特图 (右键菜单 | 拖拽列宽 | H回中 | F2编辑)</div>
          </div>

          <div ref={scrollRef} className="overflow-auto print:overflow-visible" style={{ maxHeight: '65vh' }}>
            <div className="flex" style={{ minWidth: colTotal + totalDays * dayWidth + 200 }}>
              {/* 左侧表格 */}
              <div className="shrink-0 bg-white" style={{ width: colTotal }}>
                {visibleRows.map((t, i) => (
                  <div key={t.id}
                    className={`flex border-b text-[11px] cursor-pointer ${selectedRow === t.id ? 'bg-blue-50 ring-1 ring-blue-300' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${t.critical ? 'border-l-2 border-l-red-400' : ''}`}
                    style={{ height: rowH, minHeight: rowH }}
                    onClick={() => setSelectedRow(t.id)}
                    onDoubleClick={() => startEdit(t.id, t.name)}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, taskId: t.id }); }}>
                    <div style={{ width: colWidths[0] }} className="px-2 py-2 border-r text-gray-400 truncate flex items-center">{t.id}</div>
                    <div style={{ width: colWidths[1] }} className="py-2 text-center border-r flex items-center justify-center">
                      <button onClick={e => { e.stopPropagation(); setCollapsed(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }}
                        className="text-gray-400 hover:text-gray-600">{collapsed.has(t.id) ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
                    </div>
                    <div style={{ width: colWidths[2], paddingLeft: t.level * 16 + 6 }} className="py-2 border-r flex items-center">
                      {editingName === t.id ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingName(null); }}
                          className="w-full px-1 py-0.5 border border-blue-400 rounded text-[11px]" autoFocus onClick={e => e.stopPropagation()} />
                      ) : (
                        <span className="truncate font-medium" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>{t.name}</span>
                      )}
                    </div>
                    <div style={{ width: colWidths[3] }} className="px-2 py-2 border-r text-center flex items-center justify-center">{t.duration}天</div>
                    <div style={{ width: colWidths[4], wordBreak: 'break-all' }} className="px-2 py-2 border-r text-gray-500 flex items-center text-[10px]">
                      {new Date(2025, 2, 1 + t.es).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ width: colWidths[5], wordBreak: 'break-all' }} className="px-2 py-2 border-r text-gray-500 flex items-center text-[10px]">
                      {new Date(2025, 2, 1 + t.ef).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ width: colWidths[6], wordBreak: 'break-all', whiteSpace: 'normal' }} className="px-1.5 py-2 border-r text-gray-400 text-[10px] flex items-center">
                      {t.predecessors.map(p => rows.find(x => x.id === p)?.name?.slice(0, 6) || p).join(', ') || '-'}
                    </div>
                    <div style={{ width: colWidths[7], wordBreak: 'break-all', whiteSpace: 'normal' }} className="px-1.5 py-2 text-gray-400 text-[10px] flex items-center">
                      {(successors[t.id] || []).map((s: string) => s.slice(0, 6)).join(', ') || '-'}
                    </div>
                  </div>
                ))}
              </div>

              {/* 右侧甘特条 */}
              <div className="flex-1 relative bg-white">
                {Array.from({ length: totalDays }).map((_, d) => (
                  <div key={d} className="absolute top-0 border-r border-gray-100" style={{ left: d * dayWidth, height: visibleRows.length * rowH, width: dayWidth }}>
                    {d % 7 === 0 && <div className="text-[9px] text-gray-300 pl-1">{d}d</div>}
                  </div>
                ))}
                {visibleRows.map((t, ri) => (
                  <div key={t.id} className="absolute group" style={{ top: ri * rowH, height: rowH }}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, taskId: t.id }); }}>
                    <div className={`absolute rounded top-2 h-5 flex items-center px-1.5 text-[9px] text-white font-medium cursor-grab active:cursor-grabbing hover:shadow-md ${t.critical ? 'bg-red-500' : (t.progress || 0) === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ left: t.es * dayWidth, width: Math.max(18, t.duration * dayWidth) }}
                      title={`${t.name}\nES:${t.es} EF:${t.ef} LS:${t.ls} LF:${t.lf} 浮时:${t.float} ${t.critical ? '★关键' : ''}`}>
                      {t.duration * dayWidth > 30 && <span className="truncate">{t.name.slice(0, 10)}</span>}
                      {(t.progress || 0) > 0 && <div className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-l" style={{ width: `${t.progress || 0}%` }} />}
                    </div>
                    {t.predecessors.map(pId => {
                      const pred = rows.find(x => x.id === pId);
                      if (!pred) return null;
                      const predRi = visibleRows.findIndex(v => v.id === pred.id);
                      if (predRi < 0) return null;
                      const x1 = pred.ef * dayWidth, x2 = t.es * dayWidth;
                      const y1 = predRi * rowH + rowH / 2, y2 = ri * rowH + rowH / 2;
                      const crit = t.critical && pred.critical;
                      return (
                        <svg key={`${pId}-${t.id}`} className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                          <path d={`M${x1},${y1 - ri * rowH} C${(x1+x2)/2},${y1 - ri * rowH} ${(x1+x2)/2},${y2 - ri * rowH} ${x2},${y2 - ri * rowH}`}
                            stroke={crit ? '#ef4444' : '#94a3b8'} strokeWidth={crit ? 2 : 1} fill="none" markerEnd="url(#arrowH)" />
                        </svg>
                      );
                    })}
                  </div>
                ))}
                <svg width="0" height="0"><defs><marker id="arrowH" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" /></marker></defs></svg>
              </div>
            </div>
          </div>

          {/* 右键菜单 */}
          {contextMenu && (
            <div className="fixed bg-white border rounded-lg shadow-xl z-[9999] py-1 text-xs" style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className="px-3 py-1 text-[10px] text-gray-400 border-b">编辑: {rows.find(r => r.id === contextMenu.taskId)?.name?.slice(0, 15)}</div>
              {[
                ['✏ 重命名', 'rename'], ['─ 上移', 'moveUp'], ['─ 下移', 'moveDown'],
                ['→ 延长', 'extend'], ['← 缩短', 'shrink'],
                ['＋ 上方插入', 'addAbove'], ['＋ 下方插入', 'addBelow'], ['✕ 删除此行', 'delete'],
                ['▲ 升级(父任务)', 'promote'], ['▼ 降级(子任务)', 'demote'],
                ['↺ 重置', 'reset'],
              ].map(([l, a]) => (
                <button key={a} onClick={() => handleMenuAction(a, contextMenu.taskId)}
                  className="block w-full text-left px-3 py-1.5 hover:bg-gray-100">{l}</button>
              ))}
            </div>
          )}

          {/* 打印样式 */}
          <style>{`@media print{body *{visibility:hidden}.gantt-print *{visibility:visible}.gantt-print{position:absolute;left:0;top:0;width:100%}}`}</style>
        </div>
      )}

      {/* 导出对话框 */}
      {showExport && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999]" onClick={() => setShowExport(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">导出甘特图</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* 纸张大小 */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">纸张大小</p>
                <select value={paperSize} onChange={e => setPaperSize(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {['A4', 'A3', 'A2', 'A1', 'A0', 'Letter', 'Legal', 'Tabloid'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* 方向 */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">方向</p>
                <div className="flex gap-2">
                  <button onClick={() => setOrientation('portrait')} className={`flex-1 px-3 py-2 text-xs rounded-lg border ${orientation === 'portrait' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white'}`}>📄 竖向</button>
                  <button onClick={() => setOrientation('landscape')} className={`flex-1 px-3 py-2 text-xs rounded-lg border ${orientation === 'landscape' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white'}`}>📰 横向</button>
                </div>
              </div>

              {/* 导出格式 */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">导出格式</p>
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="html">HTML 网页</option>
                  <option value="docx">Word (.doc)</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="pdf">PDF 打印</option>
                </select>
              </div>

              {/* 拼接方式 */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">拼接方式</p>
                <select value={stitchMode} onChange={e => setStitchMode(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="single">单页（自动缩放）</option>
                  <option value="horizontal">水平拼接</option>
                  <option value="grid">网格拼接</option>
                </select>
              </div>
            </div>

            {/* 导出列 */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">导出列</p>
              <div className="flex flex-wrap gap-2">
                {['WBS', '任务名称', '用时', '开始', '结束', '前置任务', '后续任务', '甘特图'].map((c, i) => (
                  <label key={c} className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={exportCols[i]} onChange={e => setExportCols(p => { const n = [...p]; n[i] = e.target.checked; return n; })} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            {/* 导出比例 */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">导出比例</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setFitPaper(true); }} className={`px-3 py-1.5 text-xs rounded-lg border ${fitPaper ? 'bg-blue-500 text-white border-blue-500' : 'bg-white'}`}>自动适应纸张</button>
                {[100, 120].map(p => (
                  <button key={p} onClick={() => { setFitPaper(false); setExportScale(p); }}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${!fitPaper && exportScale === p ? 'bg-blue-500 text-white border-blue-500' : 'bg-white'}`}>{p}%</button>
                ))}
                <button onClick={() => { setFitPaper(false); setExportScale(s => Math.max(10, s - 10)); }} className="px-2 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-100">−10%</button>
                <span className="text-xs font-bold min-w-[3rem] text-center">{fitPaper ? '自动' : exportScale + '%'}</span>
                <button onClick={() => { setFitPaper(false); setExportScale(s => s + 10); }} className="px-2 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-100">+10%</button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button onClick={() => setShowExport(false)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleExport} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1"><Download className="w-4 h-4" />导出{exportFormat.toUpperCase()}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttChart;
