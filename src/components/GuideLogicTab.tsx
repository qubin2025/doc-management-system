import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Edit3 } from 'lucide-react';
import { GuideSubModule, GuideLink } from '../types';
import LogicDiagram from './LogicDiagram';

interface GuideLogicTabProps {
  subModules: GuideSubModule[];
  checkedItems: Set<string>;
  completedItems: Set<string>;
  links: GuideLink[];
  zoomLevel: number;
  editMode: boolean;
  onLinksChange: (links: GuideLink[]) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleEditMode: () => void;
}

const GuideLogicTab: React.FC<GuideLogicTabProps> = ({
  subModules, checkedItems, completedItems, links, zoomLevel, editMode,
  onLinksChange, onZoomIn, onZoomOut, onZoomReset, onToggleEditMode,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">缩放：{Math.round(zoomLevel * 100)}%</span>
          <button onClick={onZoomOut} disabled={zoomLevel <= 0.25}
            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30" title="缩小">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={onZoomReset} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50" title="重置">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={onZoomIn} disabled={zoomLevel >= 2}
            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30" title="放大">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onToggleEditMode}
          className={`px-3 py-1.5 text-xs rounded-lg border transition flex items-center gap-1 ${
            editMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <Edit3 className="w-3.5 h-3.5" /> {editMode ? '编辑中' : '编辑模式'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: '500px' }}>
        <LogicDiagram
          subModules={subModules}
          checkedItems={checkedItems}
          completedItems={completedItems}
          links={links}
          onLinksChange={onLinksChange}
          zoomLevel={zoomLevel}
        />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 bg-white rounded-lg border border-gray-200 p-3">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> 计划中</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 已完成</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> 未开始</span>
        <span className="flex items-center gap-1 ml-auto">—— 连线</span>
        <span className="flex items-center gap-1 text-[10px]">{editMode ? '编辑模式：可拖拽连线创建依赖关系' : '只读模式'}</span>
      </div>
    </div>
  );
};

export default GuideLogicTab;
