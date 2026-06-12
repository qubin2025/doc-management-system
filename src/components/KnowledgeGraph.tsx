import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Maximize2, GitBranch, Filter } from 'lucide-react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { buildGraph, KnowledgeGraph as KGType } from '../data/knowledgeGraph';

interface Props { onBack: () => void; }

const nodeColors: Record<string, string> = {
  project: '#3B82F6',
  form: '#8B5CF6',
  document: '#10B981',
  'work-item': '#F59E0B',
  person: '#EF4444',
  chapter: '#6366F1',
};

const KnowledgeGraphView: React.FC<Props> = ({ onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [graph, setGraph] = useState<KGType | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    const g = buildGraph();
    setGraph(g);
  }, []);

  const filteredGraph = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    if (typeFilter === 'all') return graph;
    const nodes = graph.nodes.filter(n => n.type === typeFilter);
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graph.edges.filter(e => nodeIds.has(e.from) || nodeIds.has(e.to));
    return { nodes, edges };
  }, [graph, typeFilter]);

  useEffect(() => {
    if (!containerRef.current || !graph) return;
    const nodesData = new DataSet(filteredGraph.nodes.map(n => ({
      id: n.id,
      label: n.label,
      title: `<b>${n.label}</b><br>类型: ${n.type}${n.props ? '<br>' + JSON.stringify(n.props).replace(/[{"}]/g,'').replace(/,/g,'<br>') : ''}`,
      color: { background: nodeColors[n.type] || '#94a3b8', border: '#1e293b', highlight: { background: nodeColors[n.type] || '#94a3b8', border: '#000' } },
      font: { color: '#fff', size: 14, face: 'Microsoft YaHei' },
      shape: 'box',
      margin: 10,
      borderWidth: 2,
    })));
    const edgesData = new DataSet(filteredGraph.edges.map(e => ({
      id: e.from + '-' + e.to,
      from: e.from,
      to: e.to,
      label: e.type,
      arrows: 'to',
      color: { color: '#94a3b8', highlight: '#3b82f6' },
      font: { size: 10, color: '#64748b', face: 'Microsoft YaHei' },
      width: 1.5,
      smooth: { type: 'curvedCW', roundness: 0.2 },
    })));
    const options = {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: { gravitationalConstant: -80, springLength: 200, springConstant: 0.08 },
        stabilization: { iterations: 100 },
      },
      interaction: { hover: true, tooltipDelay: 150, zoomView: true, dragView: true, navigationButtons: true },
      layout: { improvedLayout: true },
      edges: { smooth: true },
    };
    const net = new Network(containerRef.current, { nodes: nodesData as any, edges: edgesData as any }, options);
    networkRef.current = net;
    // Auto-fit after stabilization
    setTimeout(() => net.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } }), 1500);
    return () => { net.destroy(); };
  }, [filteredGraph]);

  const types = useMemo(() => {
    if (!graph) return [];
    const t = new Set(graph.nodes.map(n => n.type));
    return Array.from(t);
  }, [graph]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center rounded-lg"><GitBranch className="w-5 h-5 text-white" /></div>
            <h1 className="text-lg font-bold text-gray-800">知识图谱</h1>
            <span className="text-sm text-gray-400">{graph?.nodes.length || 0}节点 · {graph?.edges.length || 0}边</span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 py-1 border rounded text-xs">
              <option value="all">全部类型</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="w-px h-5 bg-gray-200" />
            <button onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current as any)?.getScale?.() * 1.3 || 1.5 })} className="px-2 py-1 text-xs border rounded hover:bg-gray-50" title="放大">🔍+</button>
            <button onClick={() => networkRef.current?.moveTo({ scale: Math.max(0.1, (networkRef.current as any)?.getScale?.() * 0.7 || 0.5) })} className="px-2 py-1 text-xs border rounded hover:bg-gray-50" title="缩小">🔍-</button>
            <button onClick={() => networkRef.current?.fit({ animation: true })} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1" title="居中适应"><Maximize2 className="w-3 h-3" />居中</button>
            <button onClick={() => { setGraph(buildGraph()); }} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 flex items-center gap-1" title="刷新重建"><RefreshCw className="w-3 h-3" />刷新</button>
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-4 text-xs overflow-x-auto">
        {Object.entries(nodeColors).map(([t, c]) => (
          <span key={t} className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded" style={{ background: c }} />
            {t}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="flex-1" style={{ minHeight: '60vh' }} />
    </div>
  );
};

export default KnowledgeGraphView;
