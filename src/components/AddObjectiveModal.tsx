import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ProjectObjective, GuideChapter } from '../types';

interface AddObjectiveModalProps {
  projectName: string;
  objectives: ProjectObjective[];
  guideChapters: GuideChapter[];
  editTarget: ProjectObjective | null;
  parentId: string | null;
  onSave: (data: Partial<ProjectObjective>) => void;
  onClose: () => void;
}

const AddObjectiveModal: React.FC<AddObjectiveModalProps> = ({
  projectName, objectives, guideChapters, editTarget, parentId, onSave, onClose,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<ProjectObjective['level']>('phase');
  const [weight, setWeight] = useState(0);
  const [selectedParent, setSelectedParent] = useState<string | null>(parentId);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [workItemSearch, setWorkItemSearch] = useState('');
  const [showWorkItemPicker, setShowWorkItemPicker] = useState(false);

  const isEdit = !!editTarget;

  useEffect(() => {
    if (editTarget) {
      setTitle(editTarget.title);
      setDescription(editTarget.description);
      setLevel(editTarget.level);
      setWeight(editTarget.weight);
      setSelectedParent(editTarget.parentId);
      setLinkedIds(editTarget.linkedWorkItemIds || []);
    }
  }, [editTarget]);

  // 获取所有可选的工作项
  const allWorkItems: { id: string; name: string; chapter: string }[] = [];
  for (const ch of guideChapters) {
    for (const sm of ch.subModules) {
      for (const wi of sm.workItems) {
        allWorkItems.push({
          id: wi.id,
          name: wi.name,
          chapter: `${ch.number}. ${sm.name}`,
        });
      }
    }
  }

  const filteredWorkItems = workItemSearch
    ? allWorkItems.filter(w =>
        w.name.includes(workItemSearch) || w.id.includes(workItemSearch) || w.chapter.includes(workItemSearch))
    : allWorkItems;

  // 可选父目标列表（排除自身及子孙）
  const getDescendantIds = (parentId: string): Set<string> => {
    const ids = new Set<string>();
    const children = objectives.filter(o => o.parentId === parentId);
    children.forEach(c => {
      ids.add(c.id);
      getDescendantIds(c.id).forEach(id => ids.add(id));
    });
    return ids;
  };
  const excludedIds = editTarget ? new Set([editTarget.id, ...getDescendantIds(editTarget.id)]) : new Set();
  const availableParents = objectives.filter(o => !excludedIds.has(o.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      projectName,
      parentId: selectedParent,
      title: title.trim(),
      description: description.trim(),
      level,
      weight: level === 'root' ? 1 : weight,
      linkedWorkItemIds: linkedIds,
    });
  };

  const toggleWorkItem = (id: string) => {
    setLinkedIds(prev =>
      prev.includes(id) ? prev.filter(wid => wid !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-primary)]">
          <h2 className="text-lg font-bold">{isEdit ? '编辑目标' : '新增目标'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 父目标 */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">父目标</label>
            <select value={selectedParent || ''} onChange={e => setSelectedParent(e.target.value || null)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm focus:border-sky-500 focus:outline-none">
              <option value="">-- 无（作为根目标）--</option>
              {availableParents.map(p => (
                <option key={p.id} value={p.id}>
                  {'　'.repeat(p.level === 'phase' ? 0 : p.level === 'deliverable' ? 1 : 2)}{p.title}
                </option>
              ))}
            </select>
          </div>

          {/* 目标名称 */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">目标名称 *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="例：施工质量达到优良标准"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              autoFocus />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="目标的详细说明..."
              rows={2}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm focus:border-sky-500 focus:outline-none resize-none" />
          </div>

          {/* 层级 */}
          {!editTarget && (
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">目标层级</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { v: 'root', l: '总目标' },
                  { v: 'phase', l: '阶段目标' },
                  { v: 'deliverable', l: '交付物' },
                  { v: 'work-item', l: '工作包' },
                ] as const).map(opt => (
                  <button key={opt.v} type="button" onClick={() => setLevel(opt.v)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                      level === opt.v
                        ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                        : 'bg-gray-800 border-gray-700 text-[var(--text-secondary)] hover:border-gray-600'
                    }`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 权重 */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              权重 ({Math.round(weight * 100)}%)
              {level === 'root' && ' — 根目标权重固定100%'}
            </label>
            <input type="range" min="0" max="100" value={Math.round(weight * 100)}
              onChange={e => setWeight(Number(e.target.value) / 100)}
              disabled={level === 'root'}
              className="w-full accent-sky-500" />
          </div>

          {/* 关联工作项 */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              关联工作项 ({linkedIds.length}个已选)
            </label>
            <button type="button" onClick={() => setShowWorkItemPicker(!showWorkItemPicker)}
              className="w-full text-left px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm hover:border-gray-600 transition">
              {linkedIds.length === 0
                ? '点击选择要关联的工作项...'
                : linkedIds.map(id => allWorkItems.find(w => w.id === id)?.name || id).join(', ')}
            </button>

            {showWorkItemPicker && (
              <div className="mt-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg overflow-hidden">
                <div className="p-2 border-b border-gray-700">
                  <input type="text" value={workItemSearch} onChange={e => setWorkItemSearch(e.target.value)}
                    placeholder="搜索工作项..."
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded px-2 py-1 text-xs focus:border-sky-500 focus:outline-none" />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredWorkItems.slice(0, 50).map(wi => {
                    const isSelected = linkedIds.includes(wi.id);
                    return (
                      <button key={wi.id} type="button" onClick={() => toggleWorkItem(wi.id)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--bg-hover)] transition ${
                          isSelected ? 'bg-sky-500/10' : ''}`}>
                        <span className={isSelected ? 'text-sky-400' : 'text-[var(--text-muted)]'}>
                          {isSelected ? '■' : '□'}
                        </span>
                        <span className="text-gray-500 w-12 flex-shrink-0">{wi.id}</span>
                        <span className="truncate">{wi.name}</span>
                        <span className="text-[var(--text-muted)] text-[10px] flex-shrink-0">{wi.chapter}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-3 border-t border-[var(--border-primary)]">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-[var(--bg-hover)] rounded-lg text-sm transition">
              取消
            </button>
            <button type="submit" disabled={!title.trim()}
              className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white rounded-lg text-sm transition">
              {isEdit ? '保存修改' : '创建目标'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddObjectiveModal;
