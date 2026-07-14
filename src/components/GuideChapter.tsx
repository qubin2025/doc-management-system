import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ClipboardCheck, FileSearch, HardHat, CheckCircle2,
  CheckSquare, FileText, GitBranch, Plus, Upload,
  X, Edit3, Sparkles, Lightbulb, Loader, Undo2, BookOpen, Paperclip
} from 'lucide-react';
import { GuideChapter as GuideChapterType, GuideSubModule, GuideWorkItem, GuideLink, GuideSubTask, GuideForm } from '../types';
import * as api from '../data/api';
import { toast } from './Toast';
import { parseDocument } from '../data/documentParser';
import { saveModules, loadModules } from '../data/imageStore';
import GuideModulesTab from './GuideModulesTab';
import GuideFormsTab from './GuideFormsTab';
import GuideLogicTab from './GuideLogicTab';

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

  // ===== 状态管理 =====
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
  const [pendingAttachments, setPendingAttachments] = useState<{ fileName: string; data: string; size: number }[]>([]);
  const [showAIDecompose, setShowAIDecompose] = useState(false);
  const [decomposeTarget, setDecomposeTarget] = useState<{ smId: string; wiId: string; wiName: string } | null>(null);
  const [decomposeDesc, setDecomposeDesc] = useState('');
  const [decomposeFile, setDecomposeFile] = useState<File | null>(null);
  const [decomposeFileText, setDecomposeFileText] = useState('');
  const [decomposing, setDecomposing] = useState(false);
  const [showFlowZoom, setShowFlowZoom] = useState(false);

  // 表单编辑
  const [formEditModal, setFormEditModal] = useState<{ code: string; name: string } | null>(null);
  const [formEditContent, setFormEditContent] = useState('');
  const [aiFillLoading, setAiFillLoading] = useState(false);

  // 撤销
  const [undoStack, setUndoStack] = useState<GuideSubModule[][]>([]);
  const pushUndoHistory = () => { setUndoStack(prev => [JSON.parse(JSON.stringify(subModules)), ...prev].slice(0, 5)); };
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setSubModules(undoStack[0]);
    setUndoStack(s => s.slice(1));
  };

  // 持久化
  useEffect(() => {
    if (!modulesLoaded) return;
    saveModules(subModules, `${STORAGE_KEY}-modules`);
  }, [subModules, modulesLoaded]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedItems])); }, [checkedItems]);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}-done`, JSON.stringify([...completedItems])); }, [completedItems]);
  useEffect(() => { localStorage.setItem(LINKS_KEY, JSON.stringify(links)); }, [links]);

  // ===== 工作项操作 =====
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
  const toggleAttachments = (key: string) => {
    setExpandedAttachments(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };
  const handleSaveTemplate = (smId: string) => {
    const sm = subModules.find(s => s.id === smId);
    if (!sm) return;
    const key = `sm-template-${initialChapter.id}-${smId}`;
    localStorage.setItem(key, JSON.stringify({ name: sm.name, workItems: sm.workItems }));
    alert(`子模块"${sm.name}"已保存为模版`);
  };
  const handleDeleteWorkItem = (smId: string, itemId: string) => {
    pushUndoHistory();
    setSubModules(prev => prev.map(s => s.id === smId ? { ...s, workItems: s.workItems.filter(wi => wi.id !== itemId) } : s));
    setCheckedItems(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    setLinks(prev => prev.filter(l => l.from !== itemId && l.to !== itemId));
  };
  const handleDeleteAttachment = (smId: string, itemId: string, attachIdx: number) => {
    pushUndoHistory();
    setSubModules(prev => prev.map(s => s.id === smId ? {
      ...s, workItems: s.workItems.map(wi => wi.id === itemId ? {
        ...wi, attachments: wi.attachments?.filter((_, i) => i !== attachIdx),
      } : wi)
    } : s));
  };

  // ===== 添加/编辑工作项弹窗 =====
  const openAddItem = (smId: string) => {
    setEditItemId(null); setAddItemTargetSmId(smId);
    setNewItemForm({ name: '', duration: '', attachmentFormat: '', predecessors: [], successors: [], subTasks: [], flowImage: '', guideNotes: '' });
    setPendingAttachments([]); setShowAddItemModal(true);
  };
  const openEditItem = (smId: string, wi: GuideWorkItem) => {
    setEditItemId(wi.id); setAddItemTargetSmId(smId);
    const preds = links.filter(l => l.to === wi.id).map(l => l.from);
    const succs = links.filter(l => l.from === wi.id).map(l => l.to);
    setNewItemForm({
      name: wi.name, duration: wi.duration || '', attachmentFormat: wi.attachmentFormat || '',
      predecessors: preds, successors: succs, subTasks: wi.subTasks || [],
      flowImage: wi.flowImage || '', guideNotes: (wi as any).guideNotes || ''
    });
    setPendingAttachments((wi.attachments || []).map(a => ({ fileName: a.fileName, data: '', size: 0 })));
    setShowAddItemModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const MAX_SIZE = 10 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_SIZE) { alert(`文件"${f.name}"超过10MB限制，已跳过`); continue; }
      const reader = new FileReader();
      reader.onload = () => setPendingAttachments(prev => [...prev, { fileName: f.name, data: reader.result as string, size: f.size }]);
      reader.readAsDataURL(f);
    }
    e.target.value = '';
  };

  const handleRemovePendingAttachment = (idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddWorkItem = () => {
    if (!newItemForm.name.trim()) return;
    const sm = subModules.find(s => s.id === addItemTargetSmId);
    if (!sm) return;
    const now = new Date().toLocaleString('zh-CN');
    const existing = editItemId ? subModules.flatMap(s => s.workItems).find(w => w.id === editItemId)?.attachments || [] : [];
    const nextV = existing.length + 1;
    const newAtts = pendingAttachments.filter(a => a.data).map((a, i) => ({
      fileName: a.fileName, version: `V${nextV + i}`, uploadTime: now, data: a.data,
    }));
    const mergedAtts = [...existing, ...newAtts];
    pushUndoHistory();
    const newLinks: GuideLink[] = [];
    const wiId = editItemId || `${addItemTargetSmId}.${Date.now()}`;
    newItemForm.predecessors.forEach(predWiId => { newLinks.push({ from: predWiId, to: wiId, label: `${predWiId}→${wiId}`, isCustom: true }); });
    newItemForm.successors.forEach(succWiId => { newLinks.push({ from: wiId, to: succWiId, label: `${wiId}→${succWiId}`, isCustom: true }); });

    if (editItemId) {
      setSubModules(prev => prev.map(s => s.id === addItemTargetSmId ? {
        ...s, workItems: s.workItems.map(wi => wi.id === editItemId ? {
          ...wi, name: newItemForm.name.trim(), duration: newItemForm.duration || undefined,
          attachmentFormat: newItemForm.attachmentFormat || undefined, attachments: mergedAtts,
          subTasks: newItemForm.subTasks, flowImage: newItemForm.flowImage || undefined,
          guideNotes: newItemForm.guideNotes as any,
        } : wi)
      } : s));
      setLinks(prev => [...prev.filter(l => l.from !== editItemId && l.to !== editItemId), ...newLinks]);
    } else {
      const newItem: GuideWorkItem = {
        id: wiId, name: newItemForm.name.trim(), checked: false,
        duration: newItemForm.duration || undefined, attachmentFormat: newItemForm.attachmentFormat || undefined,
        isCustom: true, attachments: mergedAtts, subTasks: newItemForm.subTasks,
        flowImage: newItemForm.flowImage || undefined, guideNotes: newItemForm.guideNotes as any,
      };
      setSubModules(prev => prev.map(s => s.id === addItemTargetSmId ? { ...s, workItems: [...s.workItems, newItem] } : s));
      if (newLinks.length > 0) setLinks(prev => [...prev, ...newLinks]);
    }
    setShowAddItemModal(false);
  };

  // ===== AI办理指南 =====
  const DEFAULT_GUIDE_PROMPT = `根据以下资料生成办理指南，格式：\n一、办理要点：\n二、所需资料：\n三、重点经办人：\n（资料不足处标注"待补充"）\n\n工作项：{name}\n参考资料：{context}`;
  const [guideAnalyzing, setGuideAnalyzing] = useState(false);

  const handleAIGuide = async () => {
    if (guideAnalyzing) return;
    const texts: string[] = [];
    for (const a of pendingAttachments) {
      if (a.data && a.data.includes('base64')) {
        try { const raw = atob(a.data.split(',')[1] || a.data); if (raw.length < 50000 && !raw.includes('\0')) texts.push(a.fileName + ': ' + raw.slice(0, 3000)); } catch {}
      }
    }
    if (newItemForm.flowImage?.length > 200) texts.push('流程图内容');
    const ctx = texts.join('\n\n').slice(0, 6000);
    if (!ctx && !newItemForm.name) { toast('请先上传附件或填写工作项名称', 'warning'); return; }
    setGuideAnalyzing(true);
    try {
      const prompt = DEFAULT_GUIDE_PROMPT.replace('{name}', newItemForm.name).replace('{context}', ctx || '无附件，根据工作项名称推断');
      const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { model: 'auto' });
      setNewItemForm(p => ({ ...p, guideNotes: reply }));
      toast(`AI已生成(${reply.length}字)`, 'success');
    } catch (e: any) { toast('生成失败: ' + (e.message || ''), 'error'); }
    finally { setGuideAnalyzing(false); }
  };

  // ===== AI拆解 =====
  const fileToDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const handleDecomposeFile = async (f: File) => {
    setDecomposeFile(f);
    try { const text = await parseDocument(f); setDecomposeFileText(text.slice(0, 8000)); } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
  };
  const handleAIDecompose = async () => {
    if (!decomposeTarget || (!decomposeDesc.trim() && !decomposeFileText && !decomposeFile)) return;
    setDecomposing(true);
    try {
      const isImage = decomposeFile?.type?.startsWith('image/');
      let reply: string;
      if (isImage) {
        const b64 = await fileToDataUri(decomposeFile!);
        reply = await api.visionChat(b64, `分析这张流程图，拆解为子任务。识别泳道/责任方，输出JSON：[{"name":"子任务名","swimlane":"责任方","plannedDuration":2,"actualDuration":0}]` + (decomposeDesc.trim() ? `\n参考：${decomposeDesc}` : ''));
      } else if (decomposeFileText.trim()) {
        reply = await api.aiChat([{ role: 'user', content: `${decomposeDesc.trim() ? `补充：${decomposeDesc}\n` : ''}根据文档拆解为子任务(3-8项)：\n${decomposeFileText.slice(0, 8000)}\n输出JSON：[{"name":"任务名","plannedDuration":2,"actualDuration":0}]` }], '', { model: 'auto' });
      } else {
        reply = await api.aiChat([{ role: 'user', content: `将流程拆解为子任务(3-8项)，输出JSON：[{"name":"任务名","plannedDuration":2,"actualDuration":0}]\n流程：${decomposeDesc}` }], '', { model: 'auto' });
      }
      let json = reply.replace(/```json\n?|\n?```/g, '').trim();
      const arrStart = json.indexOf('['), arrEnd = json.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) json = json.slice(arrStart, arrEnd + 1);
      let tasks: GuideSubTask[] = [];
      try {
        tasks = JSON.parse(json).map((t: any, i: number) => ({
          id: `${decomposeTarget.wiId}.s${i + 1}`, name: t.name || t.title || '',
          swimlane: t.swimlane || '', plannedDuration: typeof t.plannedDuration === 'number' ? t.plannedDuration : (parseInt(t.plannedDuration) || 0),
          actualDuration: typeof t.actualDuration === 'number' ? t.actualDuration : 0, checked: false, isCustom: true,
        }));
      } catch {
        const lines = reply.split('\n').filter(l => l.match(/^\d+[\.\)、]|[A-Z]\.|第.*步/) && l.length > 3);
        if (lines.length === 0) lines.push(...reply.split('\n').filter(l => l.trim().length > 5).slice(0, 8));
        tasks = lines.map((l, i) => ({ id: `${decomposeTarget.wiId}.s${i + 1}`, name: l.replace(/^[\d\.\)、\s]+/, '').slice(0, 50), swimlane: '', plannedDuration: 0, actualDuration: 0, checked: false, isCustom: true }));
      }
      if (tasks.length === 0) throw new Error('未能解析出子任务');
      if (decomposeTarget.wiId !== 'new') {
        setSubModules(prev => prev.map(s => s.id === decomposeTarget.smId ? { ...s, workItems: s.workItems.map(wi => wi.id === decomposeTarget.wiId ? { ...wi, subTasks: tasks } : wi) } : s));
      }
      setNewItemForm(p => ({ ...p, subTasks: tasks }));
      toast(`AI已拆解 ${tasks.length} 项子任务`, 'success');
    } catch (e: any) { toast('AI拆解失败: ' + (e.message || '请重试'), 'error'); }
    finally { setDecomposing(false); setShowAIDecompose(false); setDecomposeDesc(''); setDecomposeFile(null); setDecomposeFileText(''); }
  };

  // ===== 表单操作 =====
  const handleOpenFormEdit = (form: GuideForm) => {
    const key = `form-content-${initialChapter.id}-${form.code}`;
    const saved = localStorage.getItem(key);
    setFormEditContent(saved ? JSON.parse(saved).content : (form.sampleContent || ''));
    setFormEditModal({ code: form.code, name: form.name });
  };
  const handleSaveFormEdit = () => {
    if (formEditModal) {
      const key = `form-content-${initialChapter.id}-${formEditModal.code}`;
      localStorage.setItem(key, JSON.stringify({ content: formEditContent, lastModified: new Date().toISOString(), version: 1 }));
      toast('表单已保存', 'success');
      setFormEditModal(null);
    }
  };
  const handleAiFillForm = async () => {
    if (!formEditModal) return;
    setAiFillLoading(true);
    try {
      const fields = initialChapter.forms.find(f => f.code === formEditModal.code)?.fields || [];
      const result = await api.aiFillForm(formEditModal.code, formEditModal.name, fields, { name: initialChapter.title });
      setFormEditContent(result || formEditContent);
      toast('AI填写完成', 'success');
    } catch (e: any) { toast('AI填写失败: ' + (e.message || ''), 'error'); }
    finally { setAiFillLoading(false); }
  };

  const totalItems = subModules.reduce((s, sm) => s + sm.workItems.length, 0);
  const checkedCount = checkedItems.size;

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
                <button onClick={handleUndo} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  title="撤销（最近5步）"><Undo2 className="w-3 h-3" /> 撤销({undoStack.length})</button>
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

        {/* 工作模块 Tab */}
        {activeTab === 'modules' && (
          <GuideModulesTab
            subModules={subModules} checkedItems={checkedItems} completedItems={completedItems}
            expandedAttachments={expandedAttachments} colors={colors}
            onToggleItem={toggleItem} onToggleComplete={toggleComplete}
            onToggleAllInSubModule={toggleAllInSubModule} onOpenAddItem={openAddItem}
            onOpenEditItem={openEditItem} onDeleteWorkItem={handleDeleteWorkItem}
            onDeleteAttachment={handleDeleteAttachment} onToggleAttachments={toggleAttachments}
            onEditSmName={smId => { setEditingSmId(smId); const sm = subModules.find(s => s.id === smId); setEditingSmName(sm?.name || ''); }}
            onSaveTemplate={handleSaveTemplate}
            onAIDecomposeFromItem={(smId, wi) => {
              setDecomposeTarget({ smId, wiId: wi.id, wiName: wi.name });
              if (wi.subTasks?.length) {
                setDecomposeFile(null);
                setDecomposeFileText(wi.subTasks.map((st, i) => `${i + 1}.${st.name}(${st.plannedDuration || 0}天)`).join('; '));
                setDecomposeDesc('');
              } else {
                setDecomposeDesc(`请对"${wi.name}"进行拆解`);
                setDecomposeFile(null); setDecomposeFileText('');
              }
              setShowAIDecompose(true);
            }}
            editingSmId={editingSmId} editingSmName={editingSmName}
            onEditingSmNameChange={setEditingSmName} onSaveSmName={handleSaveSmName}
          />
        )}

        {/* 时序逻辑图 Tab */}
        {activeTab === 'logic' && (
          <GuideLogicTab
            subModules={subModules} checkedItems={checkedItems} completedItems={completedItems}
            links={links} zoomLevel={zoomLevel} editMode={editMode}
            onLinksChange={setLinks}
            onZoomIn={() => setZoomLevel(z => Math.min(2, z + 0.25))}
            onZoomOut={() => setZoomLevel(z => Math.max(0.25, z - 0.25))}
            onZoomReset={() => setZoomLevel(1)}
            onToggleEditMode={() => setEditMode(!editMode)}
          />
        )}

        {/* 附表清单 Tab */}
        {activeTab === 'forms' && (
          <GuideFormsTab
            forms={initialChapter.forms} colors={colors}
            formEditModal={formEditModal} formEditContent={formEditContent} aiFillLoading={aiFillLoading}
            onFormEditContentChange={setFormEditContent}
            onOpenFormEdit={handleOpenFormEdit} onCloseFormEdit={() => setFormEditModal(null)}
            onAiFillForm={handleAiFillForm} onSaveFormEdit={handleSaveFormEdit}
          />
        )}
      </div>

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
                <button onClick={() => document.getElementById('guide-note-area')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />工作指南
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
              {/* 流程图 */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">流程图</label>
                <div className="border-2 border-dashed border-gray-400 rounded-lg bg-gray-100 flex items-center justify-center relative" style={{ minHeight: '160px' }}>
                  {newItemForm.flowImage ? (
                    <div className="relative w-full flex items-center justify-center">
                      <img src={newItemForm.flowImage} className="max-w-full max-h-64 object-contain rounded" alt="流程图" />
                      <button onClick={() => setShowFlowZoom(true)} className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded hover:bg-black/70">放大</button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-center p-6 text-black hover:text-blue-600 transition-colors">
                      <Upload className="w-8 h-8 mx-auto mb-1" /><span className="text-xs font-medium">点击上传流程图</span>
                      <p className="text-xs mt-0.5">支持 PNG/JPG 格式</p>
                      <input type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={e => {
                        const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setNewItemForm(p => ({ ...p, flowImage: r.result as string })); r.readAsDataURL(f); }
                      }} />
                    </label>
                  )}
                </div>
                {newItemForm.flowImage && (
                  <div className="flex items-center gap-3 mt-1">
                    <label className="text-xs text-blue-600 cursor-pointer flex items-center gap-1"><Edit3 className="w-3 h-3" />替换
                      <input type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={e => {
                        const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setNewItemForm(p => ({ ...p, flowImage: r.result as string })); r.readAsDataURL(f); }
                      }} />
                    </label>
                    <button onClick={() => setNewItemForm(p => ({ ...p, flowImage: '' }))} className="text-xs text-red-600">移除</button>
                  </div>
                )}
              </div>
              {/* 子任务编辑 */}
              <div className="border border-gray-400 rounded-lg">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-100 rounded-t-lg border-b border-gray-400">
                  <span className="text-xs font-medium text-black">子任务 (AI拆解)
                    {newItemForm.subTasks?.length > 0 && <span className="text-xs text-gray-500 ml-1">({newItemForm.subTasks.length}项)</span>}
                  </span>
                  <button onClick={() => {
                    const wiName = newItemForm.name || '工作项';
                    setDecomposeTarget({ smId: addItemTargetSmId, wiId: editItemId || 'new', wiName });
                    if (newItemForm.flowImage?.startsWith('data:image/')) {
                      const b64 = newItemForm.flowImage.split(',')[1];
                      const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
                      setDecomposeFile(new File([blob], 'flowchart.png', { type: 'image/png' }));
                      setDecomposeFileText(''); setDecomposeDesc('');
                    } else if (newItemForm.subTasks?.length > 0) {
                      setDecomposeFile(null);
                      setDecomposeFileText(newItemForm.subTasks.map((st, i) => `${i + 1}.${st.name}(${st.plannedDuration || 0}天)`).join('; '));
                      setDecomposeDesc('');
                    } else {
                      setDecomposeFile(null); setDecomposeFileText('');
                      setDecomposeDesc(`请对"${wiName}"进行拆解`);
                    }
                    setShowAIDecompose(true);
                  }} className="px-3 py-1 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />AI拆解
                  </button>
                </div>
                {newItemForm.subTasks?.length > 0 ? (
                  <>
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-xs text-black">
                        <thead><tr className="bg-gray-50 text-left border-b"><th className="px-2 py-1.5 w-8">#</th><th className="px-2 py-1.5">名称</th><th className="px-2 py-1.5 w-20">责任方</th><th className="px-2 py-1.5 w-16 text-center">预计</th><th className="px-2 py-1.5 w-16 text-center">实际</th><th className="px-2 py-1.5 w-8"></th></tr></thead>
                        <tbody>
                          {newItemForm.subTasks.map((st, i) => (
                            <tr key={st.id} className="border-t border-gray-200">
                              <td className="px-2 py-1 text-center font-medium">{i + 1}</td>
                              <td className="px-2 py-1"><input value={st.name} onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, name: e.target.value } : t) }))} className="w-full px-1.5 py-0.5 text-xs border rounded" /></td>
                              <td className="px-2 py-1"><input value={st.swimlane || ''} placeholder="责任方" onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, swimlane: e.target.value } : t) }))} className="w-full px-1.5 py-0.5 text-xs text-blue-600 border rounded bg-blue-50" /></td>
                              <td className="px-2 py-1 text-center"><input type="number" value={st.plannedDuration || ''} placeholder="0" onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, plannedDuration: Number(e.target.value) || 0 } : t) }))} className="w-full px-1 py-0.5 text-xs text-center border rounded" /></td>
                              <td className="px-2 py-1 text-center"><input type="number" value={st.actualDuration || ''} placeholder="0" onChange={e => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.map(t => t.id === st.id ? { ...t, actualDuration: Number(e.target.value) || 0 } : t) }))} className="w-full px-1 py-0.5 text-xs text-center border rounded" /></td>
                              <td className="px-1 py-1 text-center"><button onClick={() => setNewItemForm(p => ({ ...p, subTasks: p.subTasks?.filter(t => t.id !== st.id) }))} className="text-red-400 hover:text-red-600 text-xs">×</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-1.5 border-t bg-gray-50 rounded-b-lg">
                      <button onClick={() => { const newId = `s${Date.now()}`; setNewItemForm(p => ({ ...p, subTasks: [...(p.subTasks || []), { id: newId, name: '新子任务', swimlane: '', plannedDuration: 0, actualDuration: 0, checked: false }] })); }} className="text-xs text-blue-600">+ 添加子任务</button>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-gray-400">点击右上角 [AI拆解] 按钮自动拆解子任务</div>
                )}
              </div>
              {/* 参考网站 */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">参考官方网站</label>
                <div className="flex items-center gap-2">
                  <input type="url" value={newItemForm.duration} onChange={e => setNewItemForm(p => ({ ...p, duration: e.target.value }))}
                    placeholder="https://... 官方办理网址" className="flex-1 px-3 py-2 border border-gray-400 rounded-lg placeholder:text-xs" />
                </div>
              </div>
              {/* 附件上传 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-black">附件上传</label>
                  <label className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> 选择文件
                    <input type="file" className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.zip,.rar,.txt,.csv" />
                  </label>
                </div>
                {pendingAttachments.length > 0 && (
                  <div className="space-y-1">
                    {pendingAttachments.map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-blue-50 rounded px-2 py-1 group">
                        <Paperclip className="w-3 h-3 text-blue-600" /> {a.fileName}
                        <span className="text-xs">({(a.size / 1024).toFixed(0)}KB)</span>
                        <button onClick={() => handleRemovePendingAttachment(idx)} className="ml-auto text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 前置/后置工作项 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">前置工作项</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {subModules.flatMap(sm => sm.workItems.map(wi => (
                      <label key={wi.id} className="flex items-center gap-1.5 py-0.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1">
                        <input type="checkbox" checked={newItemForm.predecessors.includes(wi.id)}
                          onChange={e => setNewItemForm(p => ({ ...p, predecessors: e.target.checked ? [...p.predecessors, wi.id] : p.predecessors.filter(id => id !== wi.id) }))} />
                        {wi.id} {wi.name}
                      </label>
                    )))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">后置工作项</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {subModules.flatMap(sm => sm.workItems.map(wi => (
                      <label key={wi.id} className="flex items-center gap-1.5 py-0.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1">
                        <input type="checkbox" checked={newItemForm.successors.includes(wi.id)}
                          onChange={e => setNewItemForm(p => ({ ...p, successors: e.target.checked ? [...p.successors, wi.id] : p.successors.filter(id => id !== wi.id) }))} />
                        {wi.id} {wi.name}
                      </label>
                    )))}
                  </div>
                </div>
              </div>

              {/* 办理指南 */}
              <div id="guide-note-area">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-black">办理指南</label>
                  <button onClick={handleAIGuide} disabled={guideAnalyzing}
                    className={`px-2 py-0.5 text-xs border rounded flex items-center gap-1 ${guideAnalyzing ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 border-purple-300 hover:bg-purple-50'}`}>
                    {guideAnalyzing ? <><Loader className="w-3 h-3 animate-spin" />分析中</> : <><Sparkles className="w-3 h-3" />AI分析</>}
                  </button>
                </div>
                <textarea value={newItemForm.guideNotes || ''} onChange={e => setNewItemForm(p => ({ ...p, guideNotes: e.target.value }))}
                  placeholder="输入办理要点、注意事项、所需材料清单等..."
                  rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs resize-none outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setShowAddItemModal(false)} className="px-4 py-2 text-black bg-white border border-gray-400 rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={handleAddWorkItem} disabled={!newItemForm.name.trim()}
                  className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1.5 ${colors.bg} ${colors.hover}`}>
                  <Plus className="w-4 h-4" /> {editItemId ? '保存修改' : '添加工作项'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI拆解弹窗 */}
      {showAIDecompose && decomposeTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAIDecompose(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500" />AI拆解工作流程</h3><p className="text-xs text-gray-500 mt-0.5">工作项：{decomposeTarget.wiName}</p></div>
              <button onClick={() => setShowAIDecompose(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <textarea value={decomposeDesc} onChange={e => setDecomposeDesc(e.target.value)} placeholder="描述工作项执行流程..." rows={6} className="w-full border rounded-lg p-3 text-sm resize-none outline-none placeholder:text-xs" />
              <div className="flex items-center gap-2">
                <label className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-purple-400 cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> 上传文档/流程图
                  <input type="file" className="hidden" accept=".txt,.docx,.doc,.pdf,.png,.jpg,.jpeg" onChange={e => e.target.files?.[0] && handleDecomposeFile(e.target.files[0])} />
                </label>
                {decomposeFile && <span className="text-xs text-purple-600 flex items-center gap-1"><FileText className="w-3 h-3" />{decomposeFile.name}<button onClick={() => { setDecomposeFile(null); setDecomposeFileText(''); }} className="text-red-400"><X className="w-3 h-3" /></button></span>}
              </div>
              {decomposeFile?.type?.startsWith('image/') && <img src={URL.createObjectURL(decomposeFile)} alt="预览" className="max-w-full max-h-64 rounded-lg border object-contain" />}
              <div className="text-xs text-gray-500"><Lightbulb className="w-4 h-4 inline mr-1 text-yellow-500" />更新流程图子任务需重新上传文档</div>
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button onClick={() => setShowAIDecompose(false)} className="px-4 py-2 text-gray-600 bg-white border rounded-lg text-sm">取消</button>
              <button onClick={handleAIDecompose} disabled={decomposing || (!decomposeDesc.trim() && !decomposeFileText)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:bg-gray-300 flex items-center gap-1.5">
                {decomposing ? <><Loader className="w-4 h-4 animate-spin" />拆解中...</> : <><Sparkles className="w-4 h-4" />开始拆解</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 流程图放大 */}
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
