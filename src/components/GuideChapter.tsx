import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ClipboardCheck, FileSearch, HardHat, CheckCircle2,
  CheckSquare, FileText, GitBranch, Plus, Upload,
  X, Clock, Paperclip, ListChecks, Edit3, Trash2, ZoomIn, ZoomOut, Maximize2, Sparkles, Lightbulb, Loader, Undo2, Save, Download, BookOpen
} from 'lucide-react';
import { GuideChapter as GuideChapterType, GuideSubModule, GuideWorkItem, GuideLink, GuideSubTask } from '../types';
import * as api from '../data/api';
import LogicDiagram from './LogicDiagram';
import { toast } from './Toast';
import { parseDocument } from '../data/documentParser';
import { saveModules, loadModules } from '../data/imageStore';

interface GuideChapterProps { chapter: GuideChapterType; onBack: () => void; }

const iconMap: Record<string, React.ReactNode> = {
  ClipboardCheck: <ClipboardCheck className="w-8 h-8 text-blue-600" />,
  FileSearch: <FileSearch className="w-8 h-8 text-amber-600" />,
  HardHat: <HardHat className="w-8 h-8 text-emerald-600" />,
  CheckCircle2: <CheckCircle2 className="w-8 h-8 text-indigo-600" />,
};

const colorMap: Record<string, { bg: string; border: string; text: string; light: string; hover: string }> = {
  blue:    { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-700', light: 'bg-blue-50', hover: 'hover:bg-blue-600' },
  amber:   { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-700', light: 'bg-amber-50', hover: 'hover:bg-amber-600' },
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', hover: 'hover:bg-emerald-600' },
  indigo:  { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-700', light: 'bg-indigo-50', hover: 'hover:bg-indigo-600' },
};

const GuideChapter: React.FC<GuideChapterProps> = ({ chapter: initialChapter, onBack }) => {
  const colors = colorMap[initialChapter.color] || colorMap.blue;
  const STORAGE_KEY = `guide-chapter-${initialChapter.id}`;
  const LINKS_KEY = `guide-item-links-${initialChapter.id}`;

  // 子模块（异步从localStorage+IndexedDB加载）
  const [subModules, setSubModules] = useState<GuideSubModule[]>(() =>
    JSON.parse(JSON.stringify(initialChapter.subModules))
  );
  const [modulesLoaded, setModulesLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const saved = await loadModules(`${STORAGE_KEY}-modules`);
      if (saved) setSubModules(saved);
      setModulesLoaded(true);
    })();
  }, []);

  // 勾选（选中=蓝色计划，完成=绿色）
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { return new Set(JSON.parse(saved)); } catch {} }
    return new Set();
  });
  const [completedItems, setCompletedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-done`);
    if (saved) { try { return new Set(JSON.parse(saved)); } catch {} }
    return new Set();
  });

  // 工作项间连线
  const [links, setLinks] = useState<GuideLink[]>(() => {
    const saved = localStorage.getItem(LINKS_KEY);
    if (saved) { try { return JSON.parse(saved); } catch {} }
    const smLinks = initialChapter.links;
    const defaultLinks: GuideLink[] = [];
    smLinks.forEach(sl => {
      const fromSm = initialChapter.subModules.find(s => s.id === sl.from);
      const toSm = initialChapter.subModules.find(s => s.id === sl.to);
      if (fromSm?.workItems[0] && toSm?.workItems[0]) {
        defaultLinks.push({ from: fromSm.workItems[0].id, to: toSm.workItems[0].id, label: sl.label, isCustom: false });
      }
    });
    return defaultLinks;
  });

  const [activeTab, setActiveTab] = useState<'modules' | 'forms' | 'logic'>('modules');
  const [editMode, setEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());

  // 编辑子模块名称
  const [editingSmId, setEditingSmId] = useState('');
  const [editingSmName, setEditingSmName] = useState('');

  const handleSaveSmName = () => {
    if (!editingSmName.trim()) return;
    pushUndoHistory();
    setSubModules(prev => prev.map(s => s.id === editingSmId ? { ...s, name: editingSmName.trim() } : s));
    setEditingSmId('');
  };

  // 添加/编辑工作项弹窗
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemTargetSmId, setAddItemTargetSmId] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: '', duration: '', attachmentFormat: '', predecessors: [] as string[], successors: [] as string[], subTasks: [] as GuideSubTask[], flowImage: '' as string, guideNotes: '' as string });

  // 附件上传状态
  const [pendingAttachments, setPendingAttachments] = useState<{ fileName: string; data: string; size: number }[]>([]);
  const [showAIDecompose, setShowAIDecompose] = useState(false);
  const [decomposeTarget, setDecomposeTarget] = useState<{ smId: string; wiId: string; wiName: string } | null>(null);
  const [decomposeDesc, setDecomposeDesc] = useState('');
  const [decomposeFile, setDecomposeFile] = useState<File | null>(null);
  const [decomposeFileText, setDecomposeFileText] = useState('');
  const [decomposing, setDecomposing] = useState(false);
  const [showFlowZoom, setShowFlowZoom] = useState(false);

  // 表单编辑弹窗
  const [formEditModal, setFormEditModal] = useState<{ code: string; name: string } | null>(null);
  const [formEditContent, setFormEditContent] = useState('');
  const [aiFillLoading, setAiFillLoading] = useState(false);

  // 撤销历史（最多5步）
  const [undoStack, setUndoStack] = useState<GuideSubModule[][]>([]);
  const pushUndoHistory = () => { setUndoStack(prev => [JSON.parse(JSON.stringify(subModules)), ...prev].slice(0, 5)); };
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setSubModules(undoStack[0]);
    setUndoStack(s => s.slice(1));
  };

  // 持久化
  // 持久化：优先完整存储，超额时自动将flowImage迁至IndexedDB
  useEffect(() => {
    if (!modulesLoaded) return;
    saveModules(subModules, `${STORAGE_KEY}-modules`);
  }, [subModules, modulesLoaded]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedItems])); }, [checkedItems]);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}-done`, JSON.stringify([...completedItems])); }, [completedItems]);
  useEffect(() => { localStorage.setItem(LINKS_KEY, JSON.stringify(links)); }, [links]);

  // 保存某子模块为模版
  const handleSaveTemplate = (smId: string) => {
    pushUndoHistory();
    const sm = subModules.find(s => s.id === smId);
    if (!sm) return;
    const key = `sm-template-${initialChapter.id}-${smId}`;
    localStorage.setItem(key, JSON.stringify({ name: sm.name, workItems: sm.workItems }));
    alert(`子模块"${sm.name}"已保存为模版`);
  };

  // 勾选（选中→蓝色计划 / 完成→绿色）
  const toggleItem = (itemId: string) => {
    setCheckedItems(prev => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
    if (checkedItems.has(itemId)) {
      setCompletedItems(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  };
  const toggleComplete = (itemId: string) => {
    if (!checkedItems.has(itemId)) return;
    setCompletedItems(prev => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  };
  const toggleAllInSubModule = (smId: string) => {
    const sm = subModules.find(s => s.id === smId);
    if (!sm) return;
    const allChecked = sm.workItems.every(wi => checkedItems.has(wi.id));
    setCheckedItems(prev => {
      const n = new Set(prev);
      sm.workItems.forEach(wi => allChecked ? n.delete(wi.id) : n.add(wi.id));
      return n;
    });
    if (allChecked) {
      setCompletedItems(prev => { const n = new Set(prev); sm.workItems.forEach(wi => n.delete(wi.id)); return n; });
    }
  };

  const totalItems = subModules.reduce((s, sm) => s + sm.workItems.length, 0);
  const checkedCount = checkedItems.size;

  // ===== 添加/编辑工作项 =====
  const openAddItem = (smId: string) => {
    setEditItemId(null);
    setAddItemTargetSmId(smId);
    setNewItemForm({ name: '', duration: '', attachmentFormat: '', predecessors: [], successors: [], subTasks: [], flowImage: '', guideNotes: '' });
    setPendingAttachments([]);
    setShowAddItemModal(true);
  };
  const openEditItem = (smId: string, wi: GuideWorkItem) => {
    setEditItemId(wi.id);
    setAddItemTargetSmId(smId);
    // 从现有的links中提取前置于后置
    const preds = links.filter(l => l.to === wi.id).map(l => l.from);
    const succs = links.filter(l => l.from === wi.id).map(l => l.to);
    setNewItemForm({
      name: wi.name, duration: wi.duration || '', attachmentFormat: wi.attachmentFormat || '',
      predecessors: preds, successors: succs,
      subTasks: wi.subTasks || [],
      flowImage: wi.flowImage || '',
      guideNotes: (wi as any).guideNotes || ''
    });
    // 加载已有附件（显示信息，不含 base64 数据）
    setPendingAttachments((wi.attachments || []).map(a => ({ fileName: a.fileName, data: '', size: 0 })));
    setShowAddItemModal(true);
  };
  // 附件上传处理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_SIZE) { alert(`文件"${f.name}"超过10MB限制，已跳过`); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        setPendingAttachments(prev => [...prev, { fileName: f.name, data: reader.result as string, size: f.size }]);
      };
      reader.readAsDataURL(f);
    }
    e.target.value = ''; // 允许重复选择同名文件
  };
  const handleRemovePendingAttachment = (idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddWorkItem = () => {
    if (!newItemForm.name.trim()) return;
    const sm = subModules.find(s => s.id === addItemTargetSmId);
    if (!sm) return;

    // 处理附件：新上传的文件生成版本号
    const now = new Date().toLocaleString('zh-CN');
    const existingAttachments = (() => {
      if (!editItemId) return [];
      const sm = subModules.find(s => s.id === addItemTargetSmId);
      return sm?.workItems.find(wi => wi.id === editItemId)?.attachments || [];
    })();
    const nextVersion = existingAttachments.length + 1;
    const newAttachments = pendingAttachments
      .filter(a => a.data) // 仅保留有数据的新文件
      .map((a, i) => ({
        fileName: a.fileName,
        version: `V${nextVersion + i}`,
        uploadTime: now,
        data: a.data,
      }));
    const mergedAttachments = [...existingAttachments, ...newAttachments];

    pushUndoHistory();
    const newLinks: GuideLink[] = [];
    const wiId = editItemId || `${addItemTargetSmId}.${Date.now()}`;
    // 前置于后置链接(适用于新增和编辑两种模式)
    newItemForm.predecessors.forEach(predWiId => {
      const wi = subModules.flatMap(s => s.workItems).find(w => w.id === predWiId);
      if (wi) newLinks.push({ from: predWiId, to: wiId, label: `${predWiId}→${wiId}`, isCustom: true });
    });
    newItemForm.successors.forEach(succWiId => {
      const wi = subModules.flatMap(s => s.workItems).find(w => w.id === succWiId);
      if (wi) newLinks.push({ from: wiId, to: succWiId, label: `${wiId}→${succWiId}`, isCustom: true });
    });

    if (editItemId) {
      setSubModules(prev => prev.map(s => s.id === addItemTargetSmId ? {
        ...s, workItems: s.workItems.map(wi => wi.id === editItemId ? {
          ...wi, name: newItemForm.name.trim(),
          duration: newItemForm.duration || undefined,
          attachmentFormat: newItemForm.attachmentFormat || undefined,
          attachments: mergedAttachments,
          subTasks: newItemForm.subTasks,
          flowImage: newItemForm.flowImage || undefined,
          guideNotes: newItemForm.guideNotes as any,
        } : wi)
      } : s));
      // 重建链接
      setLinks(prev => [...prev.filter(l => l.from !== editItemId && l.to !== editItemId), ...newLinks]);
    } else {
      const newItem: GuideWorkItem = {
        id: wiId, name: newItemForm.name.trim(), checked: false,
        duration: newItemForm.duration || undefined,
        attachmentFormat: newItemForm.attachmentFormat || undefined,
        isCustom: true,
        attachments: mergedAttachments,
        subTasks: newItemForm.subTasks,
        flowImage: newItemForm.flowImage || undefined,
        guideNotes: newItemForm.guideNotes as any,
      };
      setSubModules(prev => prev.map(s => s.id === addItemTargetSmId ? { ...s, workItems: [...s.workItems, newItem] } : s));
      if (newLinks.length > 0) setLinks(prev => [...prev, ...newLinks]);
    }
    setShowAddItemModal(false);
  };

  // AI拆解工作流程 → 子任务
  const handleAIDecompose = async () => {
    if (!decomposeTarget || (!decomposeDesc.trim() && !decomposeFileText && !decomposeFile)) return;
    setDecomposing(true);
    try {
      const isImage = decomposeFile?.type?.startsWith('image/');
      let reply: string;

      // 优先级：图片视觉理解 > 文档文字 > 手动描述
      if (isImage) {
        const b64 = await fileToDataUri(decomposeFile!);
        const aiPrompt = `分析这张流程图，拆解为子任务。
要求：
1. 识别图中泳道，每个泳道代表一个责任方/办理单位
2. 每个子任务归属到对应泳道，swimlane字段标注责任方
3. 理解箭头方向、分支、并行/串行关系
4. 只输出JSON：[{"name":"子任务名","swimlane":"责任方","plannedDuration":2,"actualDuration":0}]` + (decomposeDesc.trim() ? `\n参考：${decomposeDesc}` : '');
        reply = await api.visionChat(b64, aiPrompt);
      } else if (decomposeFileText.trim()) {
        const aiPrompt = (decomposeDesc.trim() ? `补充说明：${decomposeDesc}\n\n` : '')
          + `根据以下文档内容拆解工作流程为子任务（3-8项）：
${decomposeFileText.slice(0, 8000)}
---
每项子任务只需name、plannedDuration、actualDuration。
只输出JSON数组：[{"name":"任务名","plannedDuration":2,"actualDuration":0}]`;
        reply = await api.aiChat([{ role: 'user', content: aiPrompt }], '', { model: 'auto' });
      } else {
        const aiPrompt = `将以下工作流程拆解为子任务（3-8项），直接输出JSON：[{"name":"任务名","plannedDuration":2,"actualDuration":0}]
流程：${decomposeDesc}`;
        reply = await api.aiChat([{ role: 'user', content: aiPrompt }], '', { model: 'auto' });
      }
      // 提取JSON数组(处理markdown包裹+额外文本)
      let json = reply.replace(/```json\n?|\n?```/g, '').trim();
      const arrStart = json.indexOf('[');
      const arrEnd = json.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) json = json.slice(arrStart, arrEnd + 1);

      let tasks: GuideSubTask[] = [];
      try {
        tasks = JSON.parse(json).map((t: any, i: number) => ({
          id: `${decomposeTarget.wiId}.s${i + 1}`,
          name: t.name || t.title || '',
          swimlane: t.swimlane || '',
          plannedDuration: typeof t.plannedDuration === 'number' ? t.plannedDuration : (parseInt(t.plannedDuration) || parseInt(t.duration) || 0),
          actualDuration: typeof t.actualDuration === 'number' ? t.actualDuration : (parseInt(t.actualDuration) || 0),
          checked: false,
          isCustom: true,
        }));
      } catch {
        // JSON解析失败: 按换行拆分作为fallback子任务
        const lines = reply.split('\n').filter(l => l.match(/^\d+[\.\)、]|[A-Z]\.|第.*步/) && l.length > 3);
        if (lines.length === 0) lines.push(...reply.split('\n').filter(l => l.trim().length > 5).slice(0, 8));
        tasks = lines.map((l, i) => ({
          id: `${decomposeTarget.wiId}.s${i + 1}`,
          name: l.replace(/^[\d\.\)、\s]+/, '').slice(0, 50),
          swimlane: '',
          plannedDuration: 0,
          actualDuration: 0,
          checked: false,
          isCustom: true,
        }));
      }

      if (tasks.length === 0) throw new Error('未能解析出子任务，AI返回格式异常');
      if (!decomposeTarget) return;

      // 如果是已有工作项(非'new'),更新subModules
      if (decomposeTarget.wiId !== 'new') {
        setSubModules(prev => prev.map(s => s.id === decomposeTarget.smId ? {
          ...s,
          workItems: s.workItems.map(wi => wi.id === decomposeTarget.wiId ? { ...wi, subTasks: tasks } : wi),
        } : s));
      }
      // 始终更新对话框中的子任务
      setNewItemForm(p => ({ ...p, subTasks: tasks }));
      toast(`AI已拆解 ${tasks.length} 项子任务`, 'success');
    } catch (e: any) { toast('AI拆解失败: ' + (e.message || '请重试'), 'error'); }
    finally { setDecomposing(false); setShowAIDecompose(false); setDecomposeDesc(''); setDecomposeFile(null); setDecomposeFileText(''); }
  };

  // 文件转Data URI
  const fileToDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 上传AI拆解文件
  const handleDecomposeFile = async (f: File) => {
    setDecomposeFile(f);
    try {
      const text = await parseDocument(f);
      setDecomposeFileText(text.slice(0, 8000));
    } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
  };
  const handleDeleteWorkItem = (smId: string, itemId: string) => {
    pushUndoHistory();
    setSubModules(prev => prev.map(s => s.id === smId ? { ...s, workItems: s.workItems.filter(wi => wi.id !== itemId) } : s));
    setCheckedItems(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    setLinks(prev => prev.filter(l => l.from !== itemId && l.to !== itemId));
  };

  // 删除工作项附件
  const handleDeleteAttachment = (smId: string, itemId: string, attachIdx: number) => {
    pushUndoHistory();
    setSubModules(prev => prev.map(s => s.id === smId ? {
      ...s, workItems: s.workItems.map(wi => wi.id === itemId ? {
        ...wi, attachments: wi.attachments?.filter((_, i) => i !== attachIdx),
      } : wi)
    } : s));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium border border-gray-200">
                <ArrowLeft className="w-4 h-4" /> 返回首页
              </button>
              <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center`}>
                {iconMap[initialChapter.icon]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">第{initialChapter.number}章 {initialChapter.title}</h1>
                <p className="text-sm text-gray-500">{initialChapter.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {undoStack.length > 0 && (
                <button onClick={handleUndo} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  title="撤销（最近5步）">
                  <Undo2 className="w-3 h-3" /> 撤销({undoStack.length})
                </button>
              )}
              <span className="text-sm text-gray-500">进度：{checkedCount}/{totalItems}</span>
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${colors.bg} transition-all duration-300`}
                  style={{ width: `${totalItems > 0 ? (checkedCount / totalItems * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-sm text-gray-600 mb-4">{initialChapter.description}</p>

        {/* Tab */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 border border-gray-200 w-fit">
          {[
            { key: 'modules', label: '工作模块', icon: <CheckSquare className="w-4 h-4" /> },
            { key: 'logic', label: '时序逻辑图', icon: <GitBranch className="w-4 h-4" /> },
            { key: 'forms', label: '附表清单', icon: <FileText className="w-4 h-4" /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? `${colors.bg} text-white` : 'text-gray-600 hover:bg-gray-100'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ========== 工作模块 ========== */}
        {activeTab === 'modules' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {subModules.map(sm => {
              const smChecked = sm.workItems.length > 0 && sm.workItems.every(wi => checkedItems.has(wi.id));
              const smDone = sm.workItems.length > 0 && sm.workItems.every(wi => completedItems.has(wi.id));
              const smPartial = !smChecked && sm.workItems.some(wi => checkedItems.has(wi.id));
              const allSelected = sm.workItems.length > 0 && sm.workItems.every(wi => checkedItems.has(wi.id));
              return (
                <div key={sm.id} className={`bg-white rounded-lg border-2 p-4 transition-all duration-200 ${smDone ? 'border-green-300 bg-green-50/30' : smChecked ? 'border-blue-300 bg-blue-50/20' : smPartial ? 'border-yellow-300' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${smDone ? 'bg-green-500' : smChecked ? 'bg-blue-500' : smPartial ? 'bg-yellow-500' : 'bg-gray-200'}`}>{sm.id}</span>
                      {editingSmId === sm.id ? (
                        <input type="text" value={editingSmName}
                          onChange={e => setEditingSmName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveSmName(); if (e.key === 'Escape') setEditingSmId(''); }}
                          onBlur={handleSaveSmName}
                          className="text-sm font-semibold border-b-2 border-blue-400 bg-transparent outline-none px-1 w-28"
                          autoFocus />
                      ) : (
                        <h3 className="font-semibold text-sm text-gray-800 cursor-pointer hover:text-blue-600 hover:underline group flex items-center gap-1"
                          onClick={() => { setEditingSmId(sm.id); setEditingSmName(sm.name); }}
                          title="点击修改名称">
                          {sm.name}
                          <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400" />
                        </h3>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleAllInSubModule(sm.id)} className="px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title={allSelected ? '取消全选' : '一键全选'}>
                        <ListChecks className="w-3 h-3 inline mr-0.5" />{allSelected ? '取消' : '全选'}
                      </button>
                      <button onClick={() => handleSaveTemplate(sm.id)} className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="保存为模版">
                        <Save className="w-3 h-3 inline mr-0.5" />模版
                      </button>
                      <button onClick={() => {
                        if (confirm(`确认将"${sm.name}"恢复为默认模版状态？\n\n这将清除所有自定义工作项、子任务、流程图和附件，恢复为系统默认模版。`)) {
                          const defaultCh = initialChapter;
                          const defaultSm = defaultCh.subModules.find(s => s.id === sm.id);
                          if (defaultSm) {
                            setSubModules(prev => prev.map(s => s.id === sm.id ? { ...defaultSm, workItems: defaultSm.workItems.map(wi => ({...wi})) } : s));
                            toast(`"${sm.name}"已恢复为默认模版`, 'success');
                          }
                        }
                      }} className="px-2 py-0.5 text-[10px] rounded bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors" title="恢复默认模版">
                        默认
                      </button>
                      <button onClick={() => openAddItem(sm.id)} className="p-1 rounded hover:bg-gray-200 transition-colors" title="添加工作项"><Plus className="w-3.5 h-3.5 text-gray-500" /></button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {sm.workItems.map(wi => {
                      const isChecked = checkedItems.has(wi.id);
                      const isDone = completedItems.has(wi.id);
                      return (
                      <div key={wi.id} className={`flex items-center gap-1.5 p-1.5 rounded group ${isDone ? 'text-green-700' : isChecked ? 'text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <label className="cursor-pointer" title={isChecked ? '取消选中' : '选中纳入计划'}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleItem(wi.id)} className="sr-only" />
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                            {isChecked && <CheckSquare className="w-3 h-3 text-white" />}
                          </div>
                        </label>
                        <label className={`cursor-pointer ${!isChecked ? 'opacity-30 pointer-events-none' : ''}`} title={isChecked ? (isDone ? '标记未完成' : '标记完成') : '请先选中'}>
                          <input type="checkbox" checked={isDone} onChange={() => toggleComplete(wi.id)} className="sr-only" />
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-green-500 border-green-500' : isChecked ? 'border-green-300' : 'border-gray-200'}`}>
                            {isDone && <CheckSquare className="w-3 h-3 text-white" />}
                          </div>
                        </label>
                        <span className="text-xs truncate flex-1 min-w-0">{wi.name}</span>
                        {wi.isCustom && (
                          <button onClick={() => handleDeleteWorkItem(sm.id, wi.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 rounded transition-opacity" title="删除"><Trash2 className="w-3 h-3" /></button>
                        )}
                        <button onClick={() => openEditItem(sm.id, wi)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 rounded transition-opacity" title="修改">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button onClick={() => {
                        setDecomposeTarget({ smId: sm.id, wiId: wi.id, wiName: wi.name });
                        if (wi.flowImage && wi.flowImage.startsWith('data:image/')) {
                          const b = wi.flowImage.split(',')[1];
                          const blob = new Blob([Uint8Array.from(atob(b), c => c.charCodeAt(0))], {type:'image/png'});
                          setDecomposeFile(new File([blob], 'flowchart.png', {type:'image/png'}));
                          setDecomposeFileText('');
                        } else {
                          setDecomposeFile(null);
                          const ctx = (wi.subTasks && wi.subTasks.length > 0)
                            ? wi.subTasks.map((st,i) => `${i+1}.${st.name}(${st.plannedDuration||0}天)`).join('; ') : '';
                          setDecomposeFileText(ctx);
                        }
                        setDecomposeDesc('');
                        setShowAIDecompose(true);
                      }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-purple-600 rounded transition-opacity" title="AI拆解">
                          <Sparkles className="w-3 h-3" />
                        </button>
                        {(wi.duration || wi.attachmentFormat || (wi.attachments && wi.attachments.length > 0)) && (
                          <div className="hidden sm:flex items-center gap-1 ml-1 text-[10px] text-gray-400">
                            {wi.duration && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{wi.duration}</span>}
                            {wi.attachmentFormat && <span className="flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />{wi.attachmentFormat}</span>}
                            {wi.attachments && wi.attachments.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedAttachments(prev => { const n = new Set(prev); n.has(wi.id) ? n.delete(wi.id) : n.add(wi.id); return n; }); }}
                                className="flex items-center gap-0.5 text-blue-500 font-medium hover:text-blue-700 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors"
                                title={`${wi.attachments.length}个附件 (点击展开/收起)`}>
                                <Paperclip className="w-2.5 h-2.5" />{wi.attachments.length}
                              </button>
                            )}
                          </div>
                        )}
                        {/* 展开的附件列表 */}
                        {expandedAttachments.has(wi.id) && wi.attachments && wi.attachments.length > 0 && (
                          <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-blue-200 pl-2">
                            {wi.attachments.map((att, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-[10px] text-gray-500 group/att bg-gray-50 rounded px-1.5 py-0.5">
                                <Paperclip className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                                <span className="truncate flex-1">{att.fileName}</span>
                                <span className="text-[9px] text-gray-400 shrink-0">{att.version}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(sm.id, wi.id, idx); }}
                                  className="opacity-0 group-hover/att:opacity-100 p-0.5 text-red-400 hover:text-red-600 rounded transition-opacity shrink-0"
                                  title="删除此附件">
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* AI拆解子任务（可折叠） */}
                        {wi.subTasks && wi.subTasks.length > 0 && (
                          <div className="mt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedAttachments(prev => { const n = new Set(prev); n.has('sub-' + wi.id) ? n.delete('sub-' + wi.id) : n.add('sub-' + wi.id); return n; }); }}
                              className="flex items-center gap-1 text-[10px] text-purple-500 font-medium hover:text-purple-700 hover:bg-purple-50 px-1 py-0.5 rounded transition-colors">
                              <Sparkles className="w-2.5 h-2.5" />AI子任务 ({wi.subTasks.length}) {expandedAttachments.has('sub-' + wi.id) ? '▾' : '▸'}
                            </button>
                            {expandedAttachments.has('sub-' + wi.id) && (
                              <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-purple-200 pl-2">
                                {wi.subTasks.map(st => (
                                  <div key={st.id} className="flex items-center gap-1.5 text-xs text-gray-600 group/st bg-purple-50/50 rounded px-1.5 py-0.5">
                                    <input type="checkbox" checked={st.checked}
                                      onChange={() => {
                                        setSubModules(prev => prev.map(s => s.id === sm.id ? {
                                          ...s,
                                          workItems: s.workItems.map(w => w.id === wi.id ? {
                                            ...w,
                                            subTasks: w.subTasks?.map(t => t.id === st.id ? { ...t, checked: !t.checked } : t),
                                          } : w),
                                        } : s));
                                      }} className="rounded w-3 h-3" />
                                    <span className="flex-1 truncate">{st.name}</span>
                                    {st.duration && <span className="text-[10px] text-gray-400"><Clock className="w-2.5 h-2.5 inline" />{st.duration}</span>}
                                    {st.resource && <span className="text-[10px] text-gray-400">{st.resource}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========== 时序逻辑图 ========== */}
        {activeTab === 'logic' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">工作子项时序逻辑关系图</h3>
                <p className="text-sm text-gray-500 mt-0.5">蓝色虚线框=计划中 · 绿色实线框=已完成 · 使用 draw.io 编辑器管理连线</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 图例 */}
                <div className="flex items-center gap-2 text-xs px-2">
                  <span className="flex items-center gap-0.5"><span className="w-3 h-3 rounded border-2 border-dashed border-blue-500 bg-blue-50" /> 计划</span>
                  <span className="flex items-center gap-0.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-50" /> 完成</span>
                  <span className="flex items-center gap-0.5"><span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-blue-500" /> 计划连线</span>
                  <span className="flex items-center gap-0.5"><span className="inline-block w-5 h-0.5 border-t-2 border-green-500" /> 完成连线</span>
                </div>
                <div className="h-6 w-px bg-gray-200" />

                {/* 编辑模式 */}
                <button onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    editMode ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {editMode ? <><CheckSquare className="w-3 h-3" /> 编辑完成</> : <><Edit3 className="w-3 h-3" /> 编辑</>}
                </button>

                {/* 缩放 */}
                <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg">
                  <button onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.15))} className="p-1.5 hover:bg-gray-100 rounded-l" title="缩小">
                    <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <span className="text-xs text-gray-600 px-1 min-w-[42px] text-center">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.15))} className="p-1.5 hover:bg-gray-100 rounded-r" title="放大">
                    <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
                <button onClick={() => setZoomLevel(1)} className="p-1.5 hover:bg-gray-100 rounded border border-gray-200" title="适应页面">
                  <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                </button>

                {editMode && (
                  <button onClick={() => setLinks([])} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">重置</button>
                )}
              </div>
            </div>

            {/* 编辑模式提示 */}
            {editMode && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex flex-wrap items-center gap-3">
                <span>使用 draw.io 编辑器拖拽节点、创建连线</span>
                <span>编辑连线后点击"同步连线"保存到工作模块</span>
                <span>修改会自动保存</span>
              </div>
            )}

            <div className="overflow-auto border border-gray-100 rounded-lg bg-gray-50">
              <LogicDiagram
                subModules={subModules}
                checkedItems={checkedItems}
                completedItems={completedItems}
                links={links}
                onLinksChange={setLinks}
                zoomLevel={zoomLevel}
              />
            </div>
          </div>
        )}

        {/* ========== 附表清单 ========== */}
        {activeTab === 'forms' && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">本章节附表清单</h3>
              <p className="text-sm text-gray-500 mt-1">各附表格式与资料管理系统表格格式一致 · 支持样本预览、上传、AI自动填写</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-xs">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">附表编号</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">表格名称</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 w-16">状态</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 w-56">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {initialChapter.forms.map((form, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500" style={{fontFamily:'Microsoft YaHei, sans-serif'}}>{form.code}</td>
                      <td className="px-4 py-3 text-gray-800 text-xs">{form.name}</td>
                      <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">{form.description || '待填'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <button onClick={() => {
                            const sampleContent = `【${form.name}】\n编号：${form.code}\n项目名称：________\n日期：________\n内容：________\n\n（此为样本格式，请根据实际项目填写具体内容）\n\n审核人：________\n批准人：________`;
                            setFormEditContent(sampleContent);
                            setFormEditModal({ code: form.code, name: form.name });
                          }}
                            className="px-3 py-1.5 rounded border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="查看样本">样本</button>
                          <label className="px-3 py-1.5 rounded border border-green-200 bg-white text-green-600 hover:bg-green-50 transition-colors cursor-pointer"
                            title="上传表单文件">
                            上传
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) alert(`已选择文件：${f.name}\n\n（上传功能可在此处对接实际的表单存储系统）`);
                              }} />
                          </label>
                          <button onClick={() => {
                            setFormEditContent(`【${form.name}】\n编号：${form.code}\n\n`);
                            setFormEditModal({ code: form.code, name: form.name });
                          }}
                            className="px-3 py-1.5 rounded border border-amber-200 bg-white text-amber-600 hover:bg-amber-50 transition-colors"
                            title="编辑表单（含AI填写）">编辑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t text-center">共 {initialChapter.forms.length} 个附表 · 格式与《全过程项目管理工作指南（二次修订版）20251201》一致</div>
          </div>
        )}
      </div>

      {/* ========== 表单编辑弹窗（含AI自动填写） ========== */}
      {formEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold">编辑表单</h3>
                <p className="text-sm text-gray-500 mt-0.5">{formEditModal.code} — {formEditModal.name}</p>
              </div>
              <button onClick={() => setFormEditModal(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {/* AI 自动填写 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setAiFillLoading(true);
                    await new Promise(r => setTimeout(r, 1200));
                    const aiContent = `【${formEditModal.name}】\n表单编号：${formEditModal.code}\n项目名称：[根据当前项目自动填入]\n填报单位：[建设单位名称]\n\n一、基本情况\n工程名称：________\n工程地点：________\n建设规模：________\n\n二、审批意见\n经办人：[AI预填] 符合规定，建议批准\n审核人：[待审核]\n批准人：[待批准]\n\n三、备注\n[根据项目实际情况填写]\n\n日期：${new Date().toLocaleDateString('zh-CN')}`;
                    setFormEditContent(aiContent);
                    setAiFillLoading(false);
                  }}
                  disabled={aiFillLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    aiFillLoading ? 'bg-purple-100 text-purple-400 border-purple-200 cursor-wait' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  }`}>
                  {aiFillLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiFillLoading ? 'AI 正在智能填写...' : 'AI 自动填写'}
                </button>
                <span className="text-[10px] text-gray-400">AI将根据表单类型自动填充样本内容</span>
              </div>
              <textarea
                value={formEditContent}
                onChange={e => setFormEditContent(e.target.value)}
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:border-blue-500 resize-none"
                placeholder="在此编辑表单内容..." />
            </div>
            <div className="flex justify-between p-4 border-t bg-gray-50 shrink-0">
              <button onClick={() => {
                const blob = new Blob(['\uFEFF' + formEditContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${formEditModal.code}_${formEditModal.name}.txt`;
                a.click(); URL.revokeObjectURL(url);
              }}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                导出文本
              </button>
              <button onClick={() => {
                // 持久化表单内容，供知识图谱读取
                if (formEditModal && formEditContent.trim().length > 10) {
                  const key = `form-content-${initialChapter.id}-${formEditModal.code}`;
                  localStorage.setItem(key, JSON.stringify({ content: formEditContent, lastModified: new Date().toISOString() }));
                  const fKey = `form-fields-${initialChapter.id}-${formEditModal.code}`;
                  try { const auth = JSON.parse(localStorage.getItem('doc-system-auth') || '{}'); localStorage.setItem(fKey, JSON.stringify({ creator: auth?.user?.username || 'admin' })); } catch {}
                }
                setFormEditModal(null);
              }}
                className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">完成</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 添加工作项弹窗 ========== */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold">{editItemId ? '修改工作项' : '添加工作项'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">子模块：{subModules.find(s => s.id === addItemTargetSmId)?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => document.getElementById('guide-note-area')?.scrollIntoView({behavior:'smooth'})}
                  className="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5"/>工作指南
                </button>
                <button onClick={() => setShowAddItemModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-black">
              <div>
                <label className="block text-sm font-medium text-black mb-1">工作项名称 *</label>
                <input type="text" value={newItemForm.name} onChange={e => setNewItemForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="输入工作项名称" className="w-full px-3 py-2 border border-gray-400 rounded-lg placeholder:text-xs" />
              </div>

              {/* 流程图上传+显示 */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">流程图</label>
                <div className="border-2 border-dashed border-gray-400 rounded-lg bg-gray-100 flex items-center justify-center relative" style={{minHeight:'160px'}}>
                  {newItemForm.flowImage ? (
                    <div className="relative w-full flex items-center justify-center">
                      <img src={newItemForm.flowImage} className="max-w-full max-h-64 object-contain rounded" alt="流程图" />
                      <button onClick={() => setShowFlowZoom(true)}
                        className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded hover:bg-black/70">放大</button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-center p-6 text-black hover:text-blue-600 transition-colors">
                      <Upload className="w-8 h-8 mx-auto mb-1" />
                      <span className="text-xs font-medium">点击上传流程图</span>
                      <p className="text-xs mt-0.5">支持 PNG/JPG 格式，上传后在此区域显示</p>
                      <input type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const r = new FileReader();
                          r.onload = () => setNewItemForm(p => ({ ...p, flowImage: r.result as string }));
                          r.readAsDataURL(f);
                        }
                      }} />
                    </label>
                  )}
                </div>
                {newItemForm.flowImage && (
                  <div className="flex items-center gap-3 mt-1">
                    <label className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                      <Edit3 className="w-3 h-3"/>替换流程图
                      <input type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const r = new FileReader();
                          r.onload = () => setNewItemForm(p => ({ ...p, flowImage: r.result as string }));
                          r.readAsDataURL(f);
                        }
                      }} />
                    </label>
                    <button onClick={() => setNewItemForm(p => ({ ...p, flowImage: '' }))}
                      className="text-xs text-red-600 hover:text-red-800">移除</button>
                  </div>
                )}
              </div>

              {/* 子任务编辑区(始终显示,支持增删+重新拆解) */}
              <div className="border border-gray-400 rounded-lg">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-100 rounded-t-lg border-b border-gray-400">
                  <span className="text-xs font-medium text-black">子任务 (AI拆解)
                    {(newItemForm.subTasks && newItemForm.subTasks.length > 0) &&
                      <span className="text-xs text-gray-500 ml-1">({newItemForm.subTasks.length}项)</span>
                    }
                  </span>
                  <button onClick={() => {
                    const wiName = newItemForm.name || '工作项';
                    setDecomposeTarget({ smId: addItemTargetSmId, wiId: editItemId || 'new', wiName });
                    // 有流程图：作为上传文件传给AI
                    if (newItemForm.flowImage && newItemForm.flowImage.startsWith('data:image/')) {
                      const b64 = newItemForm.flowImage.split(',')[1];
                      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                      const blob = new Blob([bytes], { type: 'image/png' });
                      setDecomposeFile(new File([blob], 'flowchart.png', { type: 'image/png' }));
                      setDecomposeFileText('');
                      setDecomposeDesc('');
                    } else if (newItemForm.subTasks && newItemForm.subTasks.length > 0) {
                      setDecomposeFile(null);
                      setDecomposeFileText(newItemForm.subTasks.map((st,i) => `${i+1}.${st.name}(${st.plannedDuration||0}天)`).join('; '));
                      setDecomposeDesc('');
                    } else {
                      // 无数据：预填工作项名称作为拆解提示
                      setDecomposeFile(null);
                      setDecomposeFileText('');
                      setDecomposeDesc(`请对"${wiName}"进行拆解，输入流程描述或上传文件`);
                    }
                    setShowAIDecompose(true);
                  }}
                    className="px-3 py-1 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3"/>AI拆解
                  </button>
                </div>
                {(newItemForm.subTasks && newItemForm.subTasks.length > 0) ? (
                  <>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-black">
                      <thead>
                        <tr className="bg-gray-50 text-left border-b">
                          <th className="px-2 py-1.5 w-8">#</th>
                          <th className="px-2 py-1.5">子任务名称</th>
                          <th className="px-2 py-1.5 w-20">责任方/泳道</th>
                          <th className="px-2 py-1.5 w-16 text-center">预计(天)</th>
                          <th className="px-2 py-1.5 w-16 text-center">实际(天)</th>
                          <th className="px-2 py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItemForm.subTasks.map((st, i) => (
                          <tr key={st.id} className="border-t border-gray-200">
                            <td className="px-2 py-1 text-center text-black font-medium">{i+1}</td>
                            <td className="px-2 py-1">
                              <input value={st.name}
                                onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, name: e.target.value } : t) }))}
                                className="w-full px-1.5 py-0.5 text-xs text-black border rounded" />
                            </td>
                            <td className="px-2 py-1">
                              <input value={st.swimlane || ''} placeholder="责任方"
                                onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, swimlane: e.target.value } : t) }))}
                                className="w-full px-1.5 py-0.5 text-xs text-blue-600 border rounded bg-blue-50" />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input type="number" value={st.plannedDuration || ''} placeholder="0"
                                onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, plannedDuration: Number(e.target.value) || 0 } : t) }))}
                                className="w-full px-1 py-0.5 text-xs text-black text-center border rounded" />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input type="number" value={st.actualDuration || ''} placeholder="0"
                                onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, actualDuration: Number(e.target.value) || 0 } : t) }))}
                                className="w-full px-1 py-0.5 text-xs text-black text-center border rounded" />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <button onClick={() => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.filter(t => t.id !== st.id) }))}
                                className="text-red-400 hover:text-red-600 text-xs">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold">
                          <td colSpan={3} className="px-2 py-1.5 text-right text-xs">工期(并行取最长泳道)</td>
                          {(() => {
                            const sts = newItemForm.subTasks || [];
                            // 按泳道分组求和，取最大泳道总时长(并行泳道同时进行)
                            const groups: Record<string,number> = {};
                            sts.forEach(t => {
                              const key = t.swimlane || '默认';
                              groups[key] = (groups[key]||0) + (t.plannedDuration||0);
                            });
                            const maxPlanned = Object.keys(groups).length > 1
                              ? Math.max(...Object.values(groups))
                              : sts.reduce((s:any,t:any) => s + (t.plannedDuration||0), 0);
                            const sumActual = sts.reduce((s:any,t:any) => s + (t.actualDuration||0), 0);
                            return <><td className="px-2 py-1.5 text-center text-xs">{maxPlanned} 天</td><td className="px-2 py-1.5 text-center text-xs">{sumActual} 天</td></>;
                          })()}
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="px-3 py-1.5 border-t bg-gray-50 rounded-b-lg">
                    <button onClick={() => {
                      const newId = `s${Date.now()}`;
                      setNewItemForm(p => ({ ...p, subTasks: [...(p.subTasks || []), { id: newId, name: '新子任务', swimlane: '', plannedDuration: 0, actualDuration: 0, checked: false }] }));
                    }}
                      className="text-xs text-blue-600 hover:text-blue-800">+ 添加子任务</button>
                  </div>
                  </>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-gray-400">
                    点击右上角 [AI拆解] 按钮，通过文字描述或上传文件自动拆解子任务
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">参考官方网站</label>
                <div className="flex items-center gap-2">
                  <input type="url" value={newItemForm.duration} onChange={e => setNewItemForm(p => ({ ...p, duration: e.target.value }))}
                    placeholder="https://... 北京市官方办理网址" className="flex-1 px-3 py-2 border border-gray-400 rounded-lg placeholder:text-xs" />
                  <button onClick={async () => {
                    const q = (newItemForm.name || '工程建设项目') + ' 北京 官方办理 手续';
                    try {
                      const reply = await api.aiChat([{role:'user',content:`搜索"${q}"的北京市官方政府网站办理链接。只返回1-2个最相关的完整URL，每行一个，不要其他文字。`}],'');
                      const urls = reply.split('\n').filter(l=>l.startsWith('http'));
                      if (urls.length > 0) setNewItemForm(p=>({...p,duration:urls[0].trim()}));
                      else toast('未找到相关链接，请手动输入','warning');
                    } catch { toast('搜索失败，请手动输入链接','error'); }
                  }}
                    className="px-3 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1 shrink-0"
                    title="AI搜索北京官方办理网站">
                    <Sparkles className="w-3.5 h-3.5"/>AI搜索
                  </button>
                </div>
                {newItemForm.duration && newItemForm.duration.startsWith('http') && (
                  <a href={newItemForm.duration} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 inline-block">🔗 打开链接</a>
                )}
              </div>

              {/* 附件上传 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-black">附件上传</label>
                  <label className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" /> 选择文件
                    <input type="file" className="hidden" multiple onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.zip,.rar,.txt,.csv" />
                  </label>
                </div>
                {editItemId && pendingAttachments.filter(a => !a.data).length > 0 && (
                  <div className="space-y-1 mb-2">
                    <p className="text-xs text-black mb-1">已有附件：</p>
                    {pendingAttachments.filter(a => !a.data).map((a, i) => (
                      <div key={`old-${i}`} className="flex items-center gap-2 text-xs text-black bg-gray-50 rounded px-2 py-1 group">
                        <Paperclip className="w-3 h-3" /> {a.fileName}
                        <span className="text-xs text-gray-400">(已保存)</span>
                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {
                            const sm = subModules.find(s => s.id === addItemTargetSmId);
                            const wi = sm?.workItems.find(w => w.id === editItemId);
                            const att = wi?.attachments?.[i];
                            if (att?.data) {
                              const blob = new Blob([Uint8Array.from(atob(att.data.split(',')[1]||att.data), c=>c.charCodeAt(0))], {type:'application/octet-stream'});
                              const url = URL.createObjectURL(blob);
                              const el = document.createElement('a'); el.href = url; el.download = att.fileName; el.click();
                              URL.revokeObjectURL(url);
                            } else { toast('文件数据不可用', 'warning'); }
                          }} className="p-0.5 text-blue-600 hover:text-blue-800 rounded" title="下载"><Download className="w-3 h-3"/></button>
                          <label className="p-0.5 text-green-600 hover:text-green-800 rounded cursor-pointer" title="替换">
                            <Edit3 className="w-3 h-3"/>
                            <input type="file" className="hidden" onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const r = new FileReader();
                                r.onload = () => { pendingAttachments[i] = { fileName: f.name, data: r.result as string, size: f.size }; setPendingAttachments([...pendingAttachments]); };
                                r.readAsDataURL(f);
                              }
                            }} />
                          </label>
                          <button onClick={() => handleDeleteAttachment(addItemTargetSmId, editItemId!, i)} className="p-0.5 text-red-600 hover:text-red-800 rounded" title="删除"><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {pendingAttachments.filter(a => !!a.data).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-black mb-1">新上传：</p>
                    {pendingAttachments.map((a, idx) => {
                      if (!a.data) return null;
                      return (
                        <div key={`new-${idx}`} className="flex items-center gap-2 text-xs text-black bg-blue-50 rounded px-2 py-1 group">
                          <Paperclip className="w-3 h-3 text-blue-600" /> {a.fileName}
                          <span className="text-xs text-black">({(a.size / 1024).toFixed(0)}KB)</span>
                          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {
                              const blob = new Blob([Uint8Array.from(atob(a.data.split(',')[1]||a.data), c=>c.charCodeAt(0))], {type:'application/octet-stream'});
                              const url = URL.createObjectURL(blob);
                              const el = document.createElement('a'); el.href = url; el.download = a.fileName; el.click();
                              URL.revokeObjectURL(url);
                            }} className="p-0.5 text-blue-600 hover:text-blue-800 rounded" title="下载"><Download className="w-3 h-3"/></button>
                            <label className="p-0.5 text-green-600 hover:text-green-800 rounded cursor-pointer" title="替换">
                              <Edit3 className="w-3 h-3"/>
                              <input type="file" className="hidden" onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const r = new FileReader();
                                  r.onload = () => { pendingAttachments[idx] = { fileName: f.name, data: r.result as string, size: f.size }; setPendingAttachments([...pendingAttachments]); };
                                  r.readAsDataURL(f);
                                }
                              }} />
                            </label>
                            <button onClick={() => handleRemovePendingAttachment(idx)} className="p-0.5 text-red-600 hover:text-red-800 rounded" title="删除"><Trash2 className="w-3 h-3"/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {pendingAttachments.length === 0 && (
                  <p className="text-xs text-black" style={{color:'#666'}}>支持 PDF/Word/Excel/图片/CAD 等格式，单文件≤10MB</p>
                )}
              </div>

              {/* 上传人+日期 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">上传人</label>
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-400 rounded-lg text-xs text-black">
                    {(() => { try { return JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.user?.username || '未登录'; } catch { return '未登录'; } })()}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">上传日期</label>
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-400 rounded-lg text-xs text-black">
                    {new Date().toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">前置工作项（可多选，选同层级工作项）</label>
                <div className="max-h-48 overflow-y-auto border border-gray-400 rounded-lg p-2 space-y-0.5">
                  {subModules.map(sm => (
                    <div key={sm.id} className="mb-1">
                      <p className="text-xs font-semibold text-black px-1">{sm.id}. {sm.name}</p>
                      {sm.workItems.map(wi => (
                        <label key={wi.id} className="flex items-center gap-2 p-1 pl-4 rounded hover:bg-gray-50 cursor-pointer text-xs text-black">
                          <input type="checkbox" checked={newItemForm.predecessors.includes(wi.id)}
                            onChange={e => setNewItemForm(p => ({ ...p, predecessors: e.target.checked ? [...p.predecessors, wi.id] : p.predecessors.filter(id => id !== wi.id) }))} className="rounded" />
                          {wi.id} {wi.name}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">后置工作项（可多选，选同层级工作项）</label>
                <div className="max-h-48 overflow-y-auto border border-gray-400 rounded-lg p-2 space-y-0.5">
                  {subModules.map(sm => (
                    <div key={sm.id} className="mb-1">
                      <p className="text-xs font-semibold text-black px-1">{sm.id}. {sm.name}</p>
                      {sm.workItems.map(wi => (
                        <label key={wi.id} className="flex items-center gap-2 p-1 pl-4 rounded hover:bg-gray-50 cursor-pointer text-xs text-black">
                          <input type="checkbox" checked={newItemForm.successors.includes(wi.id)}
                            onChange={e => setNewItemForm(p => ({ ...p, successors: e.target.checked ? [...p.successors, wi.id] : p.successors.filter(id => id !== wi.id) }))} className="rounded" />
                          {wi.id} {wi.name}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div id="guide-note-area">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-black">办理指南</label>
                  <div className="flex items-center gap-2">
                    <button onClick={async () => {
                      // 收集所有附件文本
                      const texts: string[] = [];
                      for (const a of pendingAttachments) {
                        if (a.data && a.data.includes('base64')) {
                          try {
                            const b64 = a.data.split(',')[1] || a.data;
                            const raw = atob(b64);
                            if (raw.length < 50000 && !raw.includes('\0')) texts.push(a.fileName + ': ' + raw.slice(0, 3000));
                          } catch {}
                        }
                      }
                      if (newItemForm.flowImage && newItemForm.flowImage.length > 200) texts.push('流程图内容');
                      const ctx = texts.join('\n\n').slice(0, 6000);
                      if (!ctx && !newItemForm.name) { toast('请先上传附件或填写工作项名称', 'warning'); return; }
                      try {
                        const prompt = `根据以下资料，生成办理指南（≤200字），格式：\n一、办理要点：\n二、所需资料：\n三、重点经办人：\n（资料不足处标注"待补充"）\n\n工作项：${newItemForm.name}\n参考资料：${ctx || '无附件，根据工作项名称推断'}`;
                        const reply = await api.aiChat([{role:'user',content:prompt}], '', {model:'auto'});
                        setNewItemForm(p => ({...p, guideNotes: reply.slice(0, 300)}));
                        toast('AI已生成办理指南', 'success');
                      } catch { toast('生成失败', 'error'); }
                    }}
                      className="px-2 py-0.5 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50 flex items-center gap-1">
                      <Sparkles className="w-3 h-3"/>AI分析
                    </button>
                    {(newItemForm.guideNotes || '') && (
                      <button onClick={() => {
                        const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>办理指南 — ${newItemForm.name||'工作项'}</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;color:#333}
h1{text-align:center;color:#2563eb;font-size:1.5em}h2{color:#1e40af;border-bottom:2px solid #2563eb;padding-bottom:6px;margin-top:24px}
.meta{text-align:center;color:#64748b;font-size:.85em;margin-bottom:24px}
.guide{background:#f8fafc;padding:20px;border-radius:8px;white-space:pre-wrap;line-height:2}
.files{font-size:.85em;color:#64748b;margin-top:16px}footer{text-align:center;color:#94a3b8;font-size:.8em;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px}</style></head><body>
<h1>办理指南</h1><p class="meta">工作项：${newItemForm.name||'未命名'} | 生成时间：${new Date().toLocaleString('zh-CN')}</p>
<h2>指南内容</h2><div class="guide">${(newItemForm.guideNotes||'').replace(/\n/g,'<br>')}</div>
<h2>附件清单</h2><div class="files">${pendingAttachments.map(a=>'· '+a.fileName).join('<br>')||'无'}</div>
<footer>全过程工程咨询管理服务平台 · 自动生成</footer></body></html>`;
                        const blob = new Blob(['\uFEFF'+html], {type:'text/html;charset=utf-8'});
                        const url = URL.createObjectURL(blob);
                        const el = document.createElement('a'); el.href = url; el.download = `办理指南_${newItemForm.name||'工作项'}.html`; el.click();
                        URL.revokeObjectURL(url);
                      }}
                        className="px-2 py-0.5 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 flex items-center gap-1" title="下载HTML指南">
                        <Download className="w-3 h-3"/>下载
                      </button>
                    )}
                  </div>
                </div>
                <textarea value={newItemForm.guideNotes || ''} onChange={e => setNewItemForm(p => ({...p, guideNotes: e.target.value}))}
                  placeholder="输入办理要点、注意事项、所需材料清单等..."
                  rows={4} className="w-full px-3 py-2 border border-gray-400 rounded-lg text-xs resize-none outline-none placeholder:text-xs" />
              </div>

            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 shrink-0">
              <button onClick={() => setShowAddItemModal(false)} className="px-4 py-2 text-black bg-white border border-gray-400 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleAddWorkItem} disabled={!newItemForm.name.trim()}
                className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1.5 ${colors.bg} ${colors.hover}`}>
                <Plus className="w-4 h-4" /> {editItemId ? '保存修改' : '添加工作项'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI拆解弹窗 */}
      {showAIDecompose && decomposeTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && setShowAIDecompose(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500"/>AI拆解工作流程</h3>
                <p className="text-xs text-gray-500 mt-0.5">工作项：{decomposeTarget.wiName}</p>
              </div>
              <button onClick={() => setShowAIDecompose(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工作流程描述</label>
                <textarea value={decomposeDesc} onChange={e => setDecomposeDesc(e.target.value)}
                  placeholder="描述此工作项的执行流程，如：
1. 编制专项施工方案
2. 监理单位审核
3. 施工单位技术交底
4. 现场实施与旁站监督
5. 验收确认"
                  rows={6} className="w-full border rounded-lg p-3 text-sm resize-none outline-none placeholder:text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <label className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-purple-400 hover:text-purple-500 cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5"/> 上传文档/流程图
                  <input type="file" className="hidden" accept=".txt,.docx,.doc,.pdf,.png,.jpg,.jpeg" onChange={e => e.target.files?.[0] && handleDecomposeFile(e.target.files[0])} />
                </label>
                {decomposeFile && (
                  <span className="text-xs text-purple-600 flex items-center gap-1">
                    <FileText className="w-3 h-3"/>{decomposeFile.name}
                    <button onClick={() => { setDecomposeFile(null); setDecomposeFileText(''); }} className="text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                  </span>
                )}
              </div>
              {/* 图片预览 */}
              {decomposeFile && decomposeFile.type.startsWith('image/') && (
                <div className="mt-2">
                  <img src={URL.createObjectURL(decomposeFile)} alt="流程图预览"
                    className="max-w-full max-h-64 rounded-lg border border-gray-200 object-contain" />
                </div>
              )}

              <div className="text-xs text-gray-500 leading-relaxed"><Lightbulb className="w-4 h-4 inline mr-1 text-yellow-500" />更新流程图子任务需重新上传文档（包括文档、图片），按子项名称生成子任务需删除对话框内已有图片或对流程进行基本描述（无文档、图片时）。</div>
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button onClick={() => setShowAIDecompose(false)} className="px-4 py-2 text-gray-600 bg-white border rounded-lg text-sm">取消</button>
              <button onClick={handleAIDecompose} disabled={decomposing || (!decomposeDesc.trim() && !decomposeFileText)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:bg-gray-300 flex items-center gap-1.5">
                {decomposing ? <><Loader className="w-4 h-4 animate-spin"/>拆解中...</> : <><Sparkles className="w-4 h-4"/>开始拆解</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 流程图放大预览 */}
      {showFlowZoom && newItemForm.flowImage && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={() => setShowFlowZoom(false)}>
          <div className="relative max-w-[95vw] max-h-[95vh] overflow-auto bg-white rounded-lg p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowFlowZoom(false)} className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-black/50 text-white text-sm rounded hover:bg-black/70">关闭</button>
            <img src={newItemForm.flowImage} className="max-w-none" alt="流程图原尺寸" />
          </div>
        </div>
      )}

    </div>
  );
};

export default GuideChapter;
