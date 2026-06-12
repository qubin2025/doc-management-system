import React, { useState, useMemo, useCallback } from 'react';
import { ReactFlow, Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Edit3, ZoomIn, ZoomOut, Maximize2, X, Save, Plus } from 'lucide-react';
import { CpmResult, CpmTaskResult } from '../data/cpmEngine';
import { toast } from './Toast';

interface Props {
  cpmResult: CpmResult;
  onTasksChange?: (tasks: CpmTaskResult[]) => void;
}

const NetworkDiagram: React.FC<Props> = ({ cpmResult, onTasksChange }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [editNode, setEditNode] = useState<CpmTaskResult | null>(null);
  const [editForm, setEditForm] = useState({ name: '', duration: 0, predecessors: '', es: 0 });
  const [addNode, setAddNode] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', duration: 5, predecessors: '', es: 0 });

  // Layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 150 });
    const nodes: Node[] = []; const edges: Edge[] = [];
    for (const t of cpmResult.tasks) {
      nodes.push({
        id: t.id, position: { x: 0, y: 0 },
        data: { label: `${t.name}\n工期:${t.duration}天 | ES:${t.es} EF:${t.ef}\nLS:${t.ls} LF:${t.lf} | 浮时:${t.float}`, critical: t.critical, task: t },
        style: { background: t.critical ? '#fee2e2' : '#eff6ff', border: `2px solid ${t.critical ? '#ef4444' : '#3b82f6'}`, borderRadius: 8, padding: 10, width: 180, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap' as const },
        type: 'default',
      });
      g.setNode(t.id, { width: 180, height: 70 });
    }
    for (const t of cpmResult.tasks) {
      for (const pid of t.predecessors) {
        edges.push({ id: `${pid}-${t.id}`, source: pid, target: t.id, animated: cpmResult.criticalPath.includes(pid) && cpmResult.criticalPath.includes(t.id), style: { stroke: cpmResult.criticalPath.includes(pid) && cpmResult.criticalPath.includes(t.id) ? '#ef4444' : '#94a3b8', strokeWidth: cpmResult.criticalPath.includes(pid) && cpmResult.criticalPath.includes(t.id) ? 2 : 1 } });
        g.setEdge(pid, t.id);
      }
    }
    dagre.layout(g);
    for (const node of nodes) { const n = g.node(node.id); node.position = { x: n.x - 90, y: n.y - 35 }; }
    return { nodes, edges };
  }, [cpmResult]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // 右键菜单
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const closeMenu = () => setContextMenu(null);

  const handleEditNode = (task: CpmTaskResult) => {
    setEditNode(task);
    setEditForm({ name: task.name, duration: task.duration, predecessors: task.predecessors.join(','), es: task.es });
    setContextMenu(null);
  };

  const saveEdit = () => {
    if (!editNode || !onTasksChange) return;
    const updated = cpmResult.tasks.map(t => t.id === editNode.id ? { ...t, name: editForm.name, duration: editForm.duration, predecessors: editForm.predecessors.split(/[,，]/).map(s => s.trim()).filter(Boolean), es: editForm.es, ef: editForm.es + editForm.duration } : t);
    onTasksChange(updated);
    toast('已更新: ' + editForm.name, 'success');
    setEditNode(null);
  };

  const handleAddNode = () => {
    if (!onTasksChange) return;
    const newId = String(Math.max(...cpmResult.tasks.map(t => parseInt(t.id) || 0), 0) + 1);
    const newTask: CpmTaskResult = {
      id: newId, name: addForm.name || '新任务', duration: addForm.duration, es: addForm.es,
      ef: addForm.es + addForm.duration, ls: 0, lf: 0, float: 0, critical: false,
      predecessors: addForm.predecessors.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      progress: 0,
    };
    onTasksChange([...cpmResult.tasks, newTask]);
    toast('已添加: ' + newTask.name, 'success');
    setAddNode(false);
    setAddForm({ name: '', duration: 5, predecessors: '', es: 0 });
  };

  const onPaneContextMenu = useCallback((e: any) => {
    e.preventDefault();
    setContextMenu(null);
    setAddNode(true);
  }, []);

  const handleDeleteNode = (nodeId: string) => {
    if (!onTasksChange) return;
    const updated = cpmResult.tasks.filter(t => t.id !== nodeId).map(t => ({ ...t, predecessors: t.predecessors.filter(p => p !== nodeId) }));
    onTasksChange(updated);
    toast('已删除节点', 'success');
    setContextMenu(null);
  };

  const toolbar = [
    { icon: <ZoomOut className="w-3.5 h-3.5" />, label: '缩小', action: () => { /* ReactFlow zoom handled by Controls */ } },
    { icon: <ZoomIn className="w-3.5 h-3.5" />, label: '放大', action: () => {} },
    { icon: <Maximize2 className="w-3.5 h-3.5" />, label: '适应窗口(H)', action: () => {} },
    { icon: <Edit3 className="w-3.5 h-3.5" />, label: '编辑选中节点', action: () => {} },
  ];

  return (
    <div onContextMenu={e => e.preventDefault()} onClick={closeMenu}>
      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-xs text-gray-500">右键节点编辑 | 滚轮缩放 | 拖拽平移 | Ctrl+Z 撤销</span>
        <div className="flex items-center gap-1 ml-auto">
          {toolbar.map((t, i) => (
            <button key={i} onClick={t.action} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors" title={t.label}>{t.icon}</button>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" />关键路径</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-400 inline-block" />非关键路径</span>
        <span className="flex items-center gap-1"><span style={{ width: 20, height: 2, background: '#ef4444', display: 'inline-block' }} />关键连线</span>
        <span className="text-gray-400 ml-auto">{cpmResult.tasks.length}节点 | {cpmResult.criticalPath.length}关键</span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ height: 550 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          fitView
          fitViewOptions={{ padding: 0.3, minZoom: 0.1, maxZoom: 1.5 }}
          minZoom={0.05}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap nodeColor={n => (n.data as any)?.critical ? '#ef4444' : '#3b82f6'} />
        </ReactFlow>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div className="fixed bg-white border rounded-lg shadow-xl z-[9999] py-1 text-xs" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="px-3 py-1 text-[10px] text-gray-400 border-b">
            {cpmResult.tasks.find(t => t.id === contextMenu.nodeId)?.name?.slice(0, 20)}
          </div>
          <button onClick={() => { const t = cpmResult.tasks.find(t2 => t2.id === contextMenu.nodeId); if (t) handleEditNode(t); }} className="block w-full text-left px-3 py-1.5 hover:bg-gray-100">✏ 编辑节点</button>
          <button onClick={() => toast('点击另一节点建立连线', 'info')} className="block w-full text-left px-3 py-1.5 hover:bg-gray-100">🔗 添加前置</button>
          <button onClick={() => handleDeleteNode(contextMenu.nodeId)} className="block w-full text-left px-3 py-1.5 hover:bg-gray-100">✕ 删除节点</button>
        </div>
      )}

      {/* 编辑节点对话框 */}
      {editNode && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999]" onClick={() => setEditNode(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">编辑节点: {editNode.id}</h3>
              <button onClick={() => setEditNode(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">任务名称</label><input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">工期(天)</label><input type="number" value={editForm.duration} onChange={e => setEditForm(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">ES(开始日)</label><input type="number" value={editForm.es} onChange={e => setEditForm(p => ({ ...p, es: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">前置任务(逗号分隔)</label><input value={editForm.predecessors} onChange={e => setEditForm(p => ({ ...p, predecessors: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="如: 1,2,3" /></div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p>结束日 EF: {editForm.es + editForm.duration}</p>
                {editNode && <p>关键路径: {editNode.critical ? '是' : '否'} | 浮时: {editNode.float}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditNode(null)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1"><Save className="w-4 h-4" />保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增节点对话框（右键空白处） */}
      {addNode && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999]" onClick={() => setAddNode(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><Plus className="w-5 h-5 text-green-500" />新增项目节点</h3>
              <button onClick={() => setAddNode(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">任务名称</label><input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="如: 新增工序" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">工期(天)</label><input type="number" value={addForm.duration} onChange={e => setAddForm(p => ({ ...p, duration: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">ES(开始日)</label><input type="number" value={addForm.es} onChange={e => setAddForm(p => ({ ...p, es: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">前置任务ID(逗号分隔)</label><input value={addForm.predecessors} onChange={e => setAddForm(p => ({ ...p, predecessors: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="如: 1,2" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddNode(false)} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleAddNode} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm flex items-center gap-1"><Plus className="w-4 h-4" />添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkDiagram;
