import ConfirmDialog from './ConfirmDialog';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Target, ChevronRight, ChevronDown, Edit2, Trash2, Home, ClipboardCheck, ArrowRight } from 'lucide-react';
import type { ProjectObjective, GuideChapter } from '../types';
import {
  buildObjectiveTree, recalculateAllProgress,
  getWorkItemCompletedMap, loadObjectives, saveObjectives,
  getObjectiveStats,
} from '../data/objectiveEngine';
import * as api from '../data/api';
import AddObjectiveModal from './AddObjectiveModal';

interface TargetManagerProps {
  projectName: string;
  guideChapters: GuideChapter[];
  onBack: () => void;
  flowMode?: boolean;
  onNext?: (view: string) => void;
}

const TargetManager: React.FC<TargetManagerProps> = ({ projectName, guideChapters, onBack, flowMode, onNext }) => {
  const [objectives, setObjectives] = useState<ProjectObjective[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectObjective | null>(null);
  const [parentForAdd, setParentForAdd] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // 加载数据
  useEffect(() => {
    const load = async () => {
      // 先尝试后端加载
      try {
        const res = await api.fetchObjectives(projectName);
        if (res.items && res.items.length > 0) {
          setObjectives(res.items);
          return;
        }
      } catch { /* 后端不可用，使用本地数据 */ }
      // 降级到localStorage
      setObjectives(loadObjectives(projectName));
    };
    load();
  }, [projectName]);

  // 同步到localStorage
  useEffect(() => {
    if (objectives.length > 0) {
      saveObjectives(projectName, objectives);
    }
  }, [objectives, projectName]);

  // 监听工作项完成状态变更，自动重算进度
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes(`guide-${projectName}-chapter-`) && e.key.includes('-done')) {
        const completedMap = getWorkItemCompletedMap(projectName);
        setObjectives(prev => recalculateAllProgress(prev, completedMap));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [projectName]);

  const stats = getObjectiveStats(objectives);
  const tree = buildObjectiveTree(objectives);

  // 展开/折叠
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(objectives.map(o => o.id)));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  // 获取工作项名称
  const getWorkItemName = (workItemId: string): string => {
    for (const ch of guideChapters) {
      for (const sm of ch.subModules) {
        const wi = sm.workItems.find(w => w.id === workItemId);
        if (wi) return `${ch.number}. ${sm.name} > ${wi.name}`;
      }
    }
    return workItemId;
  };

  // 刷新进度
  const refreshProgress = () => {
    const completedMap = getWorkItemCompletedMap(projectName);
    setObjectives(prev => recalculateAllProgress(prev, completedMap));
  };

  // 保存到后端
  const syncToBackend = async () => {
    setSyncing(true);
    try {
      for (const obj of objectives) {
        try {
          await api.createObjective({
            projectName, parentId: obj.parentId, title: obj.title,
            description: obj.description, level: obj.level,
            weight: obj.weight, linkedWorkItemIds: obj.linkedWorkItemIds,
          });
        } catch { /* 跳过已存在的 */ }
      }
    } finally { setSyncing(false); }
  };

  // 处理创建
  const handleCreate = async (data: Partial<ProjectObjective>) => {
    const newObj: ProjectObjective = {
      id: `obj-${Date.now()}`,
      projectName,
      parentId: data.parentId || null,
      title: data.title || '',
      description: data.description || '',
      level: data.level || 'phase',
      weight: data.weight || 0,
      progress: 0,
      status: 'not-started',
      linkedWorkItemIds: data.linkedWorkItemIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setObjectives(prev => [...prev, newObj]);

    try { await api.createObjective(newObj); } catch { /* 后端不可用 */ }
  };

  // 处理更新
  const handleUpdate = async (id: string, data: Partial<ProjectObjective>) => {
    setObjectives(prev => prev.map(o =>
      o.id === id ? { ...o, ...data, updatedAt: new Date().toISOString() } : o
    ));
    try { await api.updateObjective(id, data); } catch { /* 后端不可用 */ }
  };

  // 处理删除
  const handleDelete = (id: string) => {
    const deleteRecursive = (parentId: string) => {
      setObjectives(prev => {
        const children = prev.filter(o => o.parentId === parentId);
        children.forEach(c => deleteRecursive(c.id));
        return prev.filter(o => o.id !== parentId);
      });
    };
    deleteRecursive(id);
    try { api.deleteObjective(id); } catch { /* 后端不可用 */ }
  };

  // 渲染进度环
  const renderProgressRing = (progress: number, size = 60) => {
    const circumference = 2 * Math.PI * 27;
    const offset = circumference * (1 - progress);
    return (
      <svg width={size} height={size} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="4" />
        <circle cx="30" cy="30" r="27" fill="none" stroke="#38bdf8" strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 30 30)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        <text x="30" y="30" textAnchor="middle" dominantBaseline="central"
          fill="var(--text-primary)" opacity="0.9" fontSize="13" fontWeight="bold">
          {Math.round(progress * 100)}%
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6">
      {/* 头部 */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition">
              <ArrowLeft size={20} />
            </button>
            <Target size={24} className="text-sky-400" />
            <div>
              <h1 className="text-xl font-bold">目标管理</h1>
              <p className="text-sm text-[var(--text-muted)]">{projectName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={collapseAll} className="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition">
              折叠全部
            </button>
            <button onClick={expandAll} className="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition">
              展开全部
            </button>
            <button onClick={refreshProgress} className="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition">
              刷新进度
            </button>
            <button onClick={syncToBackend} disabled={syncing}
              className="px-3 py-1.5 text-sm bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition">
              {syncing ? '同步中...' : '同步到云端'}
            </button>
            <button onClick={() => { setParentForAdd(null); setEditTarget(null); setShowAddModal(true); }}
              className="px-4 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-white rounded-lg transition flex items-center gap-1">
              <Plus size={16} /> 新增目标
            </button>
            {flowMode && objectives.length > 0 && onNext && (
              <button onClick={() => onNext('homepage')}
                className="px-4 py-1.5 text-sm bg-green-500 hover:bg-green-400 text-white rounded-lg transition flex items-center gap-1 animate-pulse">
                <Home size={14} /> 进入工作首页 <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 引导流程指示器 */}
        {flowMode && (
          <div className="flex items-center justify-center gap-3 mb-4 text-xs">
            <span className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              <ClipboardCheck size={12} /> 第1步 √
            </span>
            <ChevronRight size={14} className="text-[var(--text-muted)]" />
            <span className="flex items-center gap-1 px-3 py-1 bg-sky-500/20 text-sky-400 rounded-full font-bold border border-sky-500/30">
              <Target size={12} /> 第2步：目标管理
            </span>
            <ChevronRight size={14} className="text-[var(--text-muted)]" />
            <span className="flex items-center gap-1 px-3 py-1 bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded-full border border-[var(--border-secondary)]">
              第3步：开始工作
            </span>
          </div>
        )}

        {/* 统计卡片 */}
        {objectives.length > 0 && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-[var(--bg-card)] rounded-xl p-4 text-center border border-[var(--border-primary)]">
              <div className="flex justify-center mb-2">{renderProgressRing(stats.overallProgress)}</div>
              <div className="text-xs text-[var(--text-muted)]">总体进度</div>
            </div>
            <div className="bg-[var(--bg-card)] rounded-xl p-4 text-center border border-[var(--border-primary)] flex flex-col justify-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-xs text-[var(--text-muted)]">目标总数</div>
            </div>
            <div className="bg-[var(--bg-card)] rounded-xl p-4 text-center border border-[var(--border-primary)] flex flex-col justify-center">
              <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
              <div className="text-xs text-[var(--text-muted)]">已完成</div>
            </div>
            <div className="bg-[var(--bg-card)] rounded-xl p-4 text-center border border-[var(--border-primary)] flex flex-col justify-center">
              <div className="text-2xl font-bold text-sky-400">{stats.inProgress}</div>
              <div className="text-xs text-[var(--text-muted)]">进行中</div>
            </div>
            <div className="bg-[var(--bg-card)] rounded-xl p-4 text-center border border-[var(--border-primary)] flex flex-col justify-center">
              <div className="text-2xl font-bold text-[var(--text-muted)]">{stats.notStarted}</div>
              <div className="text-xs text-[var(--text-muted)]">未开始</div>
            </div>
          </div>
        )}

        {/* WBS树 */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
          {objectives.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)]">
              <Target size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">还没有目标</p>
              <p className="text-sm mb-4">创建项目的WBS目标分解树，将工作计划转化为可追踪的目标</p>
              <button onClick={() => { setParentForAdd(null); setEditTarget(null); setShowAddModal(true); }}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg transition inline-flex items-center gap-2">
                <Plus size={16} /> 创建第一个目标
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)]">
              {tree.map(node => (
                <TargetNode
                  key={node.id}
                  node={node}
                  allObjectives={objectives}
                  guideChapters={guideChapters}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onEdit={(obj) => { setEditTarget(obj); setParentForAdd(null); setShowAddModal(true); }}
                  onDelete={handleDelete}
                  onRequestDelete={setConfirmDeleteId}
                  onAddChild={(parentId) => { setParentForAdd(parentId); setEditTarget(null); setShowAddModal(true); }}
                  getWorkItemName={getWorkItemName}
                  renderProgressRing={renderProgressRing}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {confirmDeleteId && (
        <ConfirmDialog title="删除目标" message="确定删除此目标及其所有子目标吗？此操作不可撤销。"
          danger onConfirm={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)} />
      )}

      {/* 新增/编辑弹窗 */}
      {showAddModal && (
        <AddObjectiveModal
          projectName={projectName}
          objectives={objectives}
          guideChapters={guideChapters}
          editTarget={editTarget}
          parentId={parentForAdd}
          onSave={(data) => {
            if (editTarget) {
              handleUpdate(editTarget.id, data);
            } else {
              handleCreate(data);
            }
            setShowAddModal(false);
            setEditTarget(null);
            setParentForAdd(null);
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditTarget(null);
            setParentForAdd(null);
          }}
        />
      )}
    </div>
  );
};

// 递归树节点组件
interface TargetNodeProps {
  node: ProjectObjective;
  allObjectives: ProjectObjective[];
  guideChapters: GuideChapter[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (obj: ProjectObjective) => void;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  getWorkItemName: (id: string) => string;
  renderProgressRing: (progress: number, size?: number) => React.ReactNode;
  depth: number;
}

const TargetNode: React.FC<TargetNodeProps> = ({
  node, allObjectives, guideChapters, expanded, onToggle, onEdit, onDelete,
  onRequestDelete, onAddChild, getWorkItemName, renderProgressRing, depth,
}) => {
  const children = allObjectives.filter(o => o.parentId === node.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(node.id);
  const [showLinks, setShowLinks] = useState(false);

  const levelLabel = { 'root': '总目标', 'phase': '阶段', 'deliverable': '交付物', 'work-item': '工作包' };
  const levelColor = {
    'root': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'phase': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    'deliverable': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'work-item': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  const statusColor = {
    'completed': 'text-green-400', 'in-progress': 'text-sky-400', 'not-started': 'text-[var(--text-muted)]',
  };

  return (
    <div>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)]/50 transition group`}
        style={{ paddingLeft: `${16 + depth * 24}px` }}>
        {/* 展开/折叠 */}
        <button onClick={() => onToggle(node.id)}
          className={`p-0.5 ${hasChildren ? 'visible' : 'invisible'}`}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* 进度环 */}
        <div className="flex-shrink-0">{renderProgressRing(node.progress, 32)}</div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{node.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${levelColor[node.level]}`}>
              {levelLabel[node.level]}
            </span>
            <span className={`text-xs ${statusColor[node.status]}`}>
              {node.status === 'completed' ? '已完成' : node.status === 'in-progress' ? '进行中' : '未开始'}
            </span>
          </div>
          {node.description && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{node.description}</p>
          )}
          {/* 关联工作项 */}
          {node.linkedWorkItemIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {node.linkedWorkItemIds.slice(0, 3).map(wid => (
                <span key={wid} className="text-[10px] bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                  {getWorkItemName(wid).split(' > ').pop()}
                </span>
              ))}
              {node.linkedWorkItemIds.length > 3 && (
                <button onClick={() => setShowLinks(!showLinks)}
                  className="text-[10px] text-sky-400 hover:underline">
                  +{node.linkedWorkItemIds.length - 3} 更多
                </button>
              )}
            </div>
          )}
          {/* 展开更多关联 */}
          {showLinks && (
            <div className="mt-1 p-2 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-muted)] max-h-32 overflow-y-auto">
              {node.linkedWorkItemIds.map(wid => (
                <div key={wid} className="py-0.5">{getWorkItemName(wid)}</div>
              ))}
            </div>
          )}
        </div>

        {/* 权重 */}
        {node.weight > 0 && (
          <span className="text-xs text-[var(--text-muted)] w-10 text-right">{Math.round(node.weight * 100)}%</span>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onAddChild(node.id)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition" title="添加子目标">
            <Plus size={14} />
          </button>
          <button onClick={() => onEdit(node)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition" title="编辑">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onRequestDelete(node.id)}
            className="p-1 hover:bg-red-900/50 hover:text-red-400 rounded transition" title="删除">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 递归渲染子节点 */}
      {hasChildren && isExpanded && (
        <div>
          {children.map(child => (
            <TargetNode
              key={child.id}
              node={child}
              allObjectives={allObjectives}
              guideChapters={guideChapters}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onRequestDelete={onRequestDelete}
              onAddChild={onAddChild}
              getWorkItemName={getWorkItemName}
              renderProgressRing={renderProgressRing}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TargetManager;
