import React from 'react';
import { Plus, Edit3, Trash2, Paperclip, Download, Sparkles, ListChecks, Star } from 'lucide-react';
import { GuideSubModule, GuideWorkItem } from '../types';

type WorkItemStatus = 'required' | 'recommended' | 'optional' | 'excluded';

interface GuideModulesTabProps {
  subModules: GuideSubModule[];
  checkedItems: Set<string>;
  completedItems: Set<string>;
  expandedAttachments: Set<string>;
  colors: { bg: string; border: string; text: string; light: string; hover: string };
  tailoringStatus?: Record<string, WorkItemStatus>; // 裁剪配置
  showExcluded?: boolean; // 是否显示被排除的工作项
  onToggleItem: (itemId: string) => void;
  onToggleComplete: (itemId: string) => void;
  onToggleAllInSubModule: (smId: string) => void;
  onOpenAddItem: (smId: string) => void;
  onOpenEditItem: (smId: string, wi: GuideWorkItem) => void;
  onDeleteWorkItem: (smId: string, itemId: string) => void;
  onDeleteAttachment: (smId: string, itemId: string, attachIdx: number) => void;
  onToggleAttachments: (key: string) => void;
  onEditSmName: (smId: string) => void;
  onSaveTemplate: (smId: string) => void;
  onAIDecomposeFromItem: (smId: string, wi: GuideWorkItem) => void;
  editingSmId: string;
  editingSmName: string;
  onEditingSmNameChange: (v: string) => void;
  onSaveSmName: () => void;
}

const GuideModulesTab: React.FC<GuideModulesTabProps> = ({
  subModules, checkedItems, completedItems, expandedAttachments, colors,
  onToggleItem, onToggleComplete, onToggleAllInSubModule,
  onOpenAddItem, onOpenEditItem, onDeleteWorkItem, onDeleteAttachment,
  onToggleAttachments, onEditSmName, onSaveTemplate, onAIDecomposeFromItem,
  editingSmId, editingSmName, onEditingSmNameChange, onSaveSmName,
  tailoringStatus, showExcluded = true,
}) => {
  const statusStyle = (s: WorkItemStatus) => {
    switch (s) {
      case 'required': return 'border-l-red-500';
      case 'recommended': return 'border-l-blue-400';
      case 'excluded': return 'opacity-40 grayscale';
      default: return '';
    }
  };
  const downloadFile = (data: string, fileName: string) => {
    try {
      const b64 = data.split(',')[1] || data;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a'); el.href = url; el.download = fileName; el.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {subModules.map(sm => {
        const smChecked = sm.workItems.length > 0 && sm.workItems.every(wi => checkedItems.has(wi.id));
        const smDone = sm.workItems.length > 0 && sm.workItems.every(wi => completedItems.has(wi.id));
        const smPartial = !smChecked && sm.workItems.some(wi => checkedItems.has(wi.id));
        // 裁剪统计
        let tailorStats = '';
        if (tailoringStatus) {
          const r = sm.workItems.filter(wi => tailoringStatus[wi.id] === 'required').length;
          const rec = sm.workItems.filter(wi => tailoringStatus[wi.id] === 'recommended').length;
          const opt = sm.workItems.filter(wi => tailoringStatus[wi.id] === 'optional').length;
          tailorStats = `必${r}/推${rec}/可${opt}`;
        }
        return (
          <div key={sm.id} className={`bg-white rounded-lg border-2 p-4 transition-all duration-200 ${
            smDone ? 'border-green-300 bg-green-50/30' :
            smChecked ? 'border-blue-300 bg-blue-50/20' :
            smPartial ? 'border-yellow-300' :
            'border-gray-100 hover:border-gray-200 hover:shadow-sm'
          }`}>
            {/* 子模块头部 */}
            <div className="flex items-center justify-between mb-3">
              {editingSmId === sm.id ? (
                <input value={editingSmName} onChange={e => onEditingSmNameChange(e.target.value)}
                  onBlur={onSaveSmName} onKeyDown={e => e.key === 'Enter' && onSaveSmName()}
                  className="flex-1 px-2 py-1 text-sm border-b-2 border-blue-500 outline-none font-medium" autoFocus />
              ) : (
                <h3 className="font-semibold text-sm" title={sm.id}>{sm.name}
              {tailorStats && <span className="ml-1 text-[10px] text-purple-500 font-normal">({tailorStats})</span>}
            </h3>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => onToggleAllInSubModule(sm.id)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                    sm.workItems.every(wi => checkedItems.has(wi.id))
                      ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {sm.workItems.every(wi => checkedItems.has(wi.id)) ? '全选 ✓' : '全选'}
                </button>
                <button onClick={() => onOpenAddItem(sm.id)}
                  className={`p-1 rounded hover:bg-${colors.bg.replace('bg-','')}/10`} title="添加工作项">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => onEditSmName(sm.id)}
                  className="p-1 rounded hover:bg-gray-100" title="编辑名称">
                  <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <button onClick={() => onSaveTemplate(sm.id)}
                  className="p-1 rounded hover:bg-gray-100" title="保存为模版">
                  <Download className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* 工作项列表 */}
            {sm.workItems.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">暂无工作项，点击 + 添加</p>
            ) : (
              <div className="space-y-1.5">
                {sm.workItems.filter(wi => {
                  if (!showExcluded && tailoringStatus?.[wi.id] === 'excluded') return false;
                  return true;
                }).map(wi => {
                  const isChecked = checkedItems.has(wi.id);
                  const isCompleted = completedItems.has(wi.id);
                  const tStatus = tailoringStatus?.[wi.id] || 'optional';
                  const expKey = `${sm.id}-${wi.id}`;
                  const isExpanded = expandedAttachments.has(expKey);
                  return (
                    <div key={wi.id} className={`rounded-lg border p-2.5 transition border-l-2 ${
                      isCompleted ? 'border-green-200 bg-green-50' :
                      isChecked ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
                    } ${statusStyle(tStatus)}`}>
                      <div className="flex items-start gap-2">
                        <button onClick={() => onToggleItem(wi.id)}
                          className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                            isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                          }`}>
                          {isChecked && <span className="text-white text-[10px] leading-none">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-sm ${isCompleted ? 'line-through text-green-700' : isChecked ? 'text-blue-700' : 'text-gray-700'}`}>
                              {wi.id} {wi.name}
                            </span>
                            {tStatus === 'required' && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold">必选</span>}
                            {tStatus === 'recommended' && <Star size={10} className="text-blue-400 inline" />}
                            {tStatus === 'excluded' && <span className="text-[9px] text-gray-400">(已排除)</span>}
                            {wi.subTasks && wi.subTasks.length > 0 && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded">{wi.subTasks.length}子任务</span>
                            )}
                            {wi.attachments && wi.attachments.length > 0 && (
                              <button onClick={() => onToggleAttachments(expKey)}
                                className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
                                <Paperclip className="w-3 h-3" /> {wi.attachments.length}附件
                              </button>
                            )}
                          </div>
                          {wi.duration && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {wi.duration.startsWith('http') ? (
                                <a href={wi.duration} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">🔗 办理网站</a>
                              ) : wi.duration}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          {isChecked && (
                            <button onClick={() => onToggleComplete(wi.id)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                                isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-green-200'
                              }`}>
                              {isCompleted ? '已完成 ✓' : '完成'}
                            </button>
                          )}
                          <button onClick={() => onAIDecomposeFromItem(sm.id, wi)}
                            className="p-1 hover:bg-purple-100 rounded" title="AI拆解">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          </button>
                          <button onClick={() => onOpenEditItem(sm.id, wi)}
                            className="p-1 hover:bg-gray-100 rounded" title="编辑">
                            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button onClick={() => onDeleteWorkItem(sm.id, wi.id)}
                            className="p-1 hover:bg-red-50 rounded" title="删除">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {/* 展开子任务 */}
                      {isExpanded && wi.subTasks && wi.subTasks.length > 0 && (
                        <div className="mt-2 ml-6 space-y-1 border-t pt-2">
                          <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                            <ListChecks className="w-3 h-3" /> 子任务 ({wi.subTasks.length})
                          </p>
                          {wi.subTasks.map(st => (
                            <div key={st.id} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              <span>{st.name}</span>
                              {st.swimlane && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">{st.swimlane}</span>}
                              <span className="text-[10px] text-gray-400">{st.plannedDuration || 0}天</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 展开附件 */}
                      {isExpanded && wi.attachments && wi.attachments.length > 0 && (
                        <div className="mt-2 ml-6 space-y-1 border-t pt-2">
                          {wi.attachments.map((att, ai) => (
                            <div key={ai} className="flex items-center gap-2 text-xs text-gray-500 group">
                              <Paperclip className="w-3 h-3" />
                              <span>{att.fileName}</span>
                              <span className="text-[10px] text-gray-400">({att.version})</span>
                              {att.data && (
                                <button onClick={() => downloadFile(att.data!, att.fileName)}
                                  className="text-blue-500 hover:underline opacity-0 group-hover:opacity-100">
                                  <Download className="w-3 h-3" />
                                </button>
                              )}
                              <button onClick={() => onDeleteAttachment(sm.id, wi.id, ai)}
                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GuideModulesTab;
