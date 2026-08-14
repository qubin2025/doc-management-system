import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ClipboardCheck, FileSearch, HardHat, CheckCircle2,
  CheckSquare, FileText, GitBranch, Plus, Upload,
  X, Edit3, Sparkles, Lightbulb, Loader, Undo2, BookOpen, Paperclip
} from 'lucide-react';
import { GuideChapter as GuideChapterType, GuideSubModule, GuideWorkItem, GuideLink, GuideSubTask, GuideForm, FormSampleFile, FormArtifact } from '../types';
import * as api from '../data/api';
import { toast } from './Toast';
import { parseDocument } from '../data/documentParser';
import { saveModules, loadModules } from '../data/imageStore';
import GuideModulesTab from './GuideModulesTab';
import { loadTailoringConfig } from '../data/tailoringEngine';
import GuideFormsTab from './GuideFormsTab';
import GuideLogicTab from './GuideLogicTab';

interface GuideChapterProps { chapter: GuideChapterType; projectName?: string; onBack: () => void; }

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

const GuideChapter: React.FC<GuideChapterProps> = ({ chapter: initialChapter, projectName, onBack }) => {
  // 加载裁剪配置
  const tailoringConfig = projectName ? loadTailoringConfig(projectName) : null;
  const tailoringStatus = tailoringConfig?.result?.workItemStatus;
  const colors = colorMap[initialChapter.color] || colorMap.blue;
  // v5.2: 键名带项目名，与 ProjectEntryPage/syncService 读取方一致（修复键名不一致 Bug）
  const STORAGE_KEY = projectName ? `guide-${projectName}-chapter-${initialChapter.id}` : `guide-chapter-${initialChapter.id}`;
  const LINKS_KEY = projectName ? `guide-${projectName}-item-links-${initialChapter.id}` : `guide-item-links-${initialChapter.id}`;

  // v5.3 防污染：禁用"全局旧键→项目新键"的模糊迁移。
  // 全局匿名键（无项目名）是 v2.x/v3.x "未关联项目时的演示模式"遗留，
  // 新建命名项目（如天宝北街）不应继承其他项目留下的数据。
  // 如需精确迁移，请在特定项目之间显式拷贝（通过 sync 导出/导入功能）。

  // v5.3 数据补救：浏览器一次性修复历史迁移污染。
  // 逻辑：如果任何带项目名的键内容与全局旧键完全相同（高置信度说明是误迁移产生），
  // 则清除该项目级键的疑似污染数据。仅执行一次（通过 cleanup-v2 旗标控制）。
  if (projectName && typeof window !== 'undefined' && !localStorage.getItem('guide-cleanup-v2')) {
    try {
      const chapterIds: string[] = [];
      for (const k of Object.keys(localStorage)) {
        const m = k.match(/^guide-chapter-(ch\d+)(-done|-modules)?$/);
        if (m) chapterIds.push(m[1]);
      }
      // 同时覆盖 API 数据中可能的 ch1~ch4
      for (const chId of new Set([...chapterIds, 'ch1', 'ch2', 'ch3', 'ch4'])) {
        const globals = [
          [`guide-chapter-${chId}`, `guide-${projectName}-chapter-${chId}`],
          [`guide-chapter-${chId}-done`, `guide-${projectName}-chapter-${chId}-done`],
          [`guide-chapter-${chId}-modules`, `guide-${projectName}-chapter-${chId}-modules`],
          [`guide-item-links-${chId}`, `guide-${projectName}-item-links-${chId}`],
        ] as [string, string][];
        globals.forEach(([globKey, projKey]) => {
          const gv = localStorage.getItem(globKey), pv = localStorage.getItem(projKey);
          if (gv && pv && gv === pv) {
            localStorage.removeItem(projKey);
          }
        });
      }
    } catch {}
    localStorage.setItem('guide-cleanup-v2', '1');
  }

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

  // 指南进度 → 初始化从后端加载（合并 localStorage + API，避免换浏览器丢失）
  useEffect(() => {
    if (!projectName) return;
    let cancelled = false;
    (async () => {
      try {
        const apiItems = await api.fetchGuideProgress(projectName, initialChapter.id);
        if (cancelled || !apiItems || apiItems.length === 0) return;
        setCheckedItems(prev => {
          const merged = new Set(prev);
          apiItems.forEach(id => merged.add(id));
          return merged;
        });
        console.log(`[guide] 进度从后端加载: chapter=${initialChapter.id} count=${apiItems.length}`);
      } catch (e) {
        console.warn('[guide] 进度后端加载失败，使用 localStorage 数据:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [projectName, initialChapter.id]);

  // 指南进度 → API 持久化（checkedItems 变更时同步到后端 + localStorage）
  useEffect(() => {
    if (!projectName || checkedItems.size === 0) return;
    api.saveGuideProgress(projectName, initialChapter.id, [...checkedItems]).catch(() => {});
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedItems]));
  }, [checkedItems]);

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

  // 样本/成果/AI提示词管理（按 formCode 分组）— 优先 API，降级 localStorage
  const FORMS_PREFIX = projectName ? `guide-forms-${projectName}-${initialChapter.id}` : `guide-forms-default-${initialChapter.id}`;
  const SAMPLE_FILES_KEY = `${FORMS_PREFIX}-sample-files`;
  const ARTIFACTS_KEY = `${FORMS_PREFIX}-artifacts`;
  const AI_PROMPTS_KEY = `${FORMS_PREFIX}-ai-prompts`;

  const safeLoadJson = <T,>(key: string, fallback: T): T => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
    catch { return fallback; }
  };
  const safeSaveJson = (key: string, value: unknown, label: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e: unknown) {
      const quotaErr = e as { name?: string };
      if (quotaErr?.name === 'QuotaExceededError') {
        console.error(`[guide] ${label} localStorage 配额已满（5MB）`);
        toast(`${label}本地存储已满（5MB 上限），请删除旧文件或使用文件下载备份`, 'error');
      } else {
        console.error(`[guide] ${label} localStorage 保存异常:`, e);
        toast(`${label}本地保存失败: ${(e as Error)?.message || '未知错误'}`, 'error');
      }
    }
  };

  // 初始化先用 localStorage 数据（避免 API 加载前的空窗），随后异步从 API 同步
  const [sampleFilesMap, setSampleFilesMap] = useState<Record<string, FormSampleFile[]>>(() => safeLoadJson(SAMPLE_FILES_KEY, {}));
  const [artifactsMap, setArtifactsMap] = useState<Record<string, FormArtifact[]>>(() => safeLoadJson(ARTIFACTS_KEY, {}));
  const [aiPromptsMap, setAiPromptsMap] = useState<Record<string, string>>(() => safeLoadJson(AI_PROMPTS_KEY, {}));
  const [formsApiLoaded, setFormsApiLoaded] = useState(false);

  // 异步从后端加载本章节全部表单数据（含样本/成果/AI提示词），覆盖 localStorage
  useEffect(() => {
    if (!projectName || formsApiLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        console.log(`[guide] 初始化加载 → backend: project=${projectName} chapter=${initialChapter.id}`);
        const result = await api.fetchAllGuideForms(projectName, initialChapter.id);
        if (cancelled) return;
        const forms = result?.forms || {};
        const apiSample: Record<string, FormSampleFile[]> = {};
        const apiArtifact: Record<string, FormArtifact[]> = {};
        const apiPrompt: Record<string, string> = {};
        let totalCount = 0;
        Object.entries(forms).forEach(([code, f]) => {
          if (f.sampleFiles && f.sampleFiles.length > 0) { apiSample[code] = f.sampleFiles as FormSampleFile[]; totalCount += f.sampleFiles.length; }
          if (f.artifacts && f.artifacts.length > 0) { apiArtifact[code] = f.artifacts as FormArtifact[]; totalCount += f.artifacts.length; }
          if (f.aiPrompt) { apiPrompt[code] = f.aiPrompt; }
        });
        console.log(`[guide] 初始化加载完成: 共 ${Object.keys(forms).length} 个表单，${totalCount} 个文件，${Object.keys(apiPrompt).length} 个自定义提示词`);
        // 只覆盖 API 中有数据的字段，避免清空本地尚未同步的数据
        setSampleFilesMap(prev => ({ ...prev, ...apiSample }));
        setArtifactsMap(prev => ({ ...prev, ...apiArtifact }));
        setAiPromptsMap(prev => ({ ...prev, ...apiPrompt }));
      } catch (e) {
        console.warn('[guide] 初始化加载失败，使用 localStorage 数据:', e);
      } finally {
        if (!cancelled) setFormsApiLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [projectName, initialChapter.id, formsApiLoaded]);

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

  // 样本/成果/AI提示词 → 双写持久化（localStorage 即时 + API 异步）
  // 仅在 API 初始加载完成后才向 backend 同步，避免初始化阶段把空数据写回后端
  const syncToBackend = async (formCode: string, kind: 'sample' | 'artifact' | 'prompt') => {
    if (!projectName || !formsApiLoaded) return;
    try {
      if (kind === 'sample') {
        const list = sampleFilesMap[formCode] || [];
        await api.saveGuideSampleFiles(projectName, initialChapter.id, formCode, list);
      } else if (kind === 'artifact') {
        const list = artifactsMap[formCode] || [];
        await api.saveGuideArtifacts(projectName, initialChapter.id, formCode, list);
      } else {
        const prompt = aiPromptsMap[formCode] || '';
        await api.saveGuideAiPrompt(projectName, initialChapter.id, formCode, prompt);
      }
    } catch (e) {
      console.error(`[guide] ${kind} 后端同步异常 formCode=${formCode}:`, e);
    }
  };

  useEffect(() => {
    safeSaveJson(SAMPLE_FILES_KEY, sampleFilesMap, '样本文件');
    // 仅对发生变化的 formCode 同步到后端（简化：全部同步，依赖 React 18 批处理）
    if (formsApiLoaded && projectName) {
      Object.keys(sampleFilesMap).forEach(code => syncToBackend(code, 'sample'));
    }
  }, [sampleFilesMap, formsApiLoaded, projectName]);
  useEffect(() => {
    safeSaveJson(ARTIFACTS_KEY, artifactsMap, '成果文件');
    if (formsApiLoaded && projectName) {
      Object.keys(artifactsMap).forEach(code => syncToBackend(code, 'artifact'));
    }
  }, [artifactsMap, formsApiLoaded, projectName]);
  useEffect(() => {
    safeSaveJson(AI_PROMPTS_KEY, aiPromptsMap, 'AI提示词');
    if (formsApiLoaded && projectName) {
      Object.keys(aiPromptsMap).forEach(code => syncToBackend(code, 'prompt'));
    }
  }, [aiPromptsMap, formsApiLoaded, projectName]);

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
      // API 持久化
      const token = JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
      fetch('/api/guide/forms', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ projectName, chapterId: initialChapter.id, code: formEditModal.code, content: formEditContent }),
      }).catch(() => {});
      toast('表单已保存', 'success');
      setFormEditModal(null);
    }
  };
  // v5.2: 暂存待执行的 AI 填写请求（用于表格行按钮的"打开弹窗后自动填写"链路）
  const pendingAiFillCodeRef = useRef<string | null>(null);

  // 监听 formEditModal 变化：当由表格行按钮触发打开弹窗时，自动执行 AI 填写
  useEffect(() => {
    if (pendingAiFillCodeRef.current && formEditModal?.code === pendingAiFillCodeRef.current) {
      const code = pendingAiFillCodeRef.current;
      pendingAiFillCodeRef.current = null;
      doAiFill(code);
    }
  }, [formEditModal?.code]);

  const handleAiFillForm = async (formCode?: string) => {
    // 支持两种调用路径：
    //   1. 表格行按钮传入 formCode → 先打开编辑弹窗，等弹窗就绪后再 AI 填写
    //   2. 弹窗内按钮无参 → 直接用 formEditModal 执行 AI 填写
    let targetCode = formEditModal?.code || formCode;
    if (!targetCode) return;

    // 表格行按钮点击 → 先打开编辑弹窗，记录待执行的填写任务
    if (formCode && formEditModal?.code !== formCode) {
      const form = initialChapter.forms.find(f => f.code === formCode);
      if (form) {
        pendingAiFillCodeRef.current = formCode;
        handleOpenFormEdit(form);
      }
      return; // 等 useEffect 检测到弹窗打开后自动触发
    }

    // 弹窗内直接调用 → 立即执行 AI 填写
    await doAiFill(targetCode);
  };

  // 实际执行 AI 填写的内部函数
  const doAiFill = async (targetCode: string) => {
    setAiFillLoading(true);
    try {
      const fields = initialChapter.forms.find(f => f.code === targetCode)?.fields || [];
      const form = initialChapter.forms.find(f => f.code === targetCode);
      const formName = form?.name || targetCode;
      const projectInfo = getProjectInfoForAi();
      const customPrompt = aiPromptsMap[targetCode] || form?.aiPrompt || '';
      const projectContext = {
        name: projectInfo.name,
        details: {
          area: projectInfo.area,
          scale: projectInfo.level,
          investment: '',
          overview: `项目编号: ${projectInfo.code}\n项目经理: ${projectInfo.manager}\n计划工期: ${projectInfo.startDate} ~ ${projectInfo.endDate}\n项目类型: ${projectInfo.type}`,
        } as any,
      };
      let result: string;
      if (customPrompt) {
        let finalPrompt = customPrompt;
        Object.entries(projectInfo).forEach(([k, v]) => {
          finalPrompt = finalPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
        const fieldListText = fields.map(f => `- ${f.label} (${f.type})`).join('\n');
        finalPrompt += `\n\n## 表单字段\n${fieldListText}\n\n## 请输出\n请以Markdown表格格式输出完整的${formName}，表头为各字段标签，下方附加填写说明。`;
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('doc-system-auth') ? { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('doc-system-auth')!).token } : {}) },
          body: JSON.stringify({ messages: [{ role: 'user', content: finalPrompt }], context: 'form-fill' }),
        });
        if (res.ok) { const d = await res.json(); result = d.reply || d.message || ''; }
        else {
          result = await api.aiFillForm(targetCode, formName, fields, projectContext, undefined);
        }
      } else {
        result = await api.aiFillForm(targetCode, formName, fields, projectContext, undefined);
      }
      setFormEditContent(result || formEditContent);
      toast('AI填写完成，已抓取项目信息自动生成计划表', 'success');
    } catch (e: any) { toast('AI填写失败: ' + (e.message || ''), 'error'); }
    finally { setAiFillLoading(false); }
  };

  const getProjectInfoForAi = () => {
    const info: Record<string, string> = { name: projectName || '', code: '', manager: '', startDate: '', endDate: '', area: '', level: '', type: '' };
    if (projectName) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('doc-mgmt-projects-'));
      for (const k of keys) {
        try {
          const arr = JSON.parse(localStorage.getItem(k) || '[]');
          const found = arr.find((p: any) => p.name === projectName);
          if (found) {
            info.name = found.name || projectName;
            info.code = found.code || '';
            info.manager = found.manager || '';
            info.startDate = found.startDate || '';
            info.endDate = found.endDate || '';
            info.area = found.area || '';
            info.level = found.level || '';
            info.type = found.type || '';
            break;
          }
        } catch {}
      }
    }
    return info;
  };

  // === 样本文件操作 ===
  const handleUploadSample = async (formCode: string, fileName: string, fileData: string) => {
    const fileSizeKB = Math.round(fileData.length / 1024);
    console.log(`[guide] 样本上传开始: formCode=${formCode} fileName=${fileName} size=${fileSizeKB}KB (base64)`);
    const newFile: FormSampleFile = {
      id: `sample-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName, fileData,
      uploadedAt: new Date().toISOString(),
      uploadedBy: localStorage.getItem('doc-system-user') || 'unknown',
    };
    setSampleFilesMap(prev => {
      const updated = { ...prev, [formCode]: [...(prev[formCode] || []), newFile] };
      console.log(`[guide] 样本上传 → state 更新: formCode=${formCode} 总数=${updated[formCode].length}`);
      return updated;
    });
    // 持久化由 useEffect 自动触发；这里仅给用户即时反馈
    toast(`样本文件已添加（${fileSizeKB}KB），正在同步到服务器`, 'success');
  };
  const handleDeleteSample = (formCode: string, fileId: string) => {
    console.log(`[guide] 样本删除: formCode=${formCode} fileId=${fileId}`);
    setSampleFilesMap(prev => ({ ...prev, [formCode]: (prev[formCode] || []).filter(f => f.id !== fileId) }));
    toast('样本文件已删除', 'success');
  };
  const handleSampleDownload = (file: FormSampleFile) => {
    console.log(`[guide] 样本下载: fileName=${file.fileName}`);
    const a = document.createElement('a');
    a.href = file.fileData;
    a.download = file.fileName;
    a.click();
  };

  // === 成果文件操作（自动版本号） ===
  const handleUploadArtifact = async (formCode: string, fileName: string, fileData: string) => {
    const fileSizeKB = Math.round(fileData.length / 1024);
    const existing = artifactsMap[formCode] || [];
    const version = existing.length > 0 ? Math.max(...existing.map(a => a.version)) + 1 : 1;
    console.log(`[guide] 成果上传开始: formCode=${formCode} fileName=${fileName} size=${fileSizeKB}KB version=V${version}`);
    const newArtifact: FormArtifact = {
      id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName, fileData, version,
      uploadedAt: new Date().toISOString(),
      uploadedBy: localStorage.getItem('doc-system-user') || 'unknown',
    };
    setArtifactsMap(prev => {
      const updated = { ...prev, [formCode]: [...(prev[formCode] || []), newArtifact] };
      console.log(`[guide] 成果上传 → state 更新: formCode=${formCode} version=V${version} 总数=${updated[formCode].length}`);
      return updated;
    });
    toast(`成果文件已添加 V${version}（${fileSizeKB}KB），正在同步到服务器`, 'success');
  };
  const handleDeleteArtifact = (formCode: string, fileId: string) => {
    console.log(`[guide] 成果删除: formCode=${formCode} fileId=${fileId}`);
    setArtifactsMap(prev => ({ ...prev, [formCode]: (prev[formCode] || []).filter(f => f.id !== fileId) }));
    toast('成果文件已删除', 'success');
  };
  const handleArtifactDownload = (file: FormArtifact) => {
    console.log(`[guide] 成果下载: fileName=${file.fileName} version=V${file.version}`);
    const a = document.createElement('a');
    a.href = file.fileData;
    a.download = `V${file.version}_${file.fileName}`;
    a.click();
  };

  // === AI 提示词操作 ===
  const handleUpdateAiPrompt = (formCode: string, prompt: string) => {
    console.log(`[guide] AI提示词更新: formCode=${formCode} length=${prompt.length}`);
    setAiPromptsMap(prev => ({ ...prev, [formCode]: prompt }));
  };

  const totalItems = subModules.reduce((s, sm) => s + sm.workItems.length, 0);
  const checkedCount = checkedItems.size;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 h-[65px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium border border-gray-200">
                <ArrowLeft className="w-4 h-4" /> 返回首页
              </button>
              <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center`}>
                {iconMap[initialChapter.icon]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">第{initialChapter.number}章 {initialChapter.title}</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">{initialChapter.subtitle}</p>
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
            tailoringStatus={tailoringStatus} showExcluded={!!projectName}
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
            sampleFilesMap={sampleFilesMap} artifactsMap={artifactsMap} aiPromptsMap={aiPromptsMap}
            onUploadSample={handleUploadSample} onDeleteSample={handleDeleteSample} onDownloadSample={handleSampleDownload}
            onUploadArtifact={handleUploadArtifact} onDeleteArtifact={handleDeleteArtifact} onDownloadArtifact={handleArtifactDownload}
            onUpdateAiPrompt={handleUpdateAiPrompt}
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
