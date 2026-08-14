import React, { useEffect, useRef, useState, useMemo, useCallback, Suspense } from 'react';
import { ArrowLeft, Search, X, Plus, Link2, Save, Users, Cpu, Palette, ChevronDown, RotateCcw, Download, Edit2, Trash2, Camera, Type } from 'lucide-react';
import * as THREE from 'three';
import { buildGraph, KnowledgeGraph as KGType, getParentChain, TYPE_NAMES, TYPE_EDGE_NAMES } from '../data/knowledgeGraph';
import { getCachedProjects } from '../data/projectDataCache';
import * as api from '../data/api';

const ForceGraph3D = React.lazy(() => import('react-force-graph-3d'));

// ===== 类型色 =====
const TYPE_COLORS: Record<string, string> = {
  project: '#3B82F6', chapter: '#6366F1', 'sub-module': '#8B5CF6', 'work-item': '#F59E0B',
  form: '#EC4899', document: '#10B981', supplier: '#F97316', cost: '#14B8A6', person: '#EF4444',
  'construction-plan': '#F59E0B', 'standard-clause': '#3B82F6', 'review-item': '#EF4444', 'risk-point': '#DC2626',
  contract: '#8B5CF6', 'bid-document': '#6366F1', agent: '#8B5CF6',
};

// ===== 3D 主题光效 =====
const THEMES: Record<string, { name: string; gradient: string; bgHex: string; light: string; amb: number; fog: string }> = {
  space:    { name: '深空黑', gradient: 'radial-gradient(circle, #111827 0%, #000000 100%)', bgHex: '#000000', light: '#6366f1', amb: 0.20, fog: '#000000' },
  dusk:     { name: '暮光紫', gradient: 'radial-gradient(circle, #2e1065 0%, #030712 100%)', bgHex: '#030712', light: '#fb923c', amb: 0.55, fog: '#030712' },
  starlight:{ name: '星光蓝', gradient: 'radial-gradient(circle, #1e1b4b 0%, #020617 100%)', bgHex: '#020617', light: '#e0f2fe', amb: 0.25, fog: '#020617' },
  dawn:     { name: '破晓金', gradient: 'radial-gradient(circle, #0c4a6e 0%, #082f49 100%)', bgHex: '#082f49', light: '#fde68a', amb: 0.65, fog: '#082f49' },
  moonlight:{ name: '月光白', gradient: 'radial-gradient(circle, #f3f4f6 0%, #e5e7eb 50%, #9ca3af 100%)', bgHex: '#f3f4f6', light: '#ffffff', amb: 0.85, fog: '#f3f4f6' },
};

// ===== 3D 子组件 =====
const Graph3DCanvas: React.FC<{
  nodes: any[]; edges: any[]; selectedNode: any; onNodeClick: (node: any) => void; theme: string;
  onLightingReady: (scene: any) => void; fgRefOut?: React.MutableRefObject<any>;
  fontSize?: string; fontColor?: string;
}> = React.memo(({ nodes: rawNodes, edges: rawEdges, selectedNode, onNodeClick, theme, onLightingReady, fgRefOut, fontSize = 'md', fontColor }) => {
  const fgRef = useRef<any>(null);
  useEffect(() => { if (fgRefOut) fgRefOut.current = fgRef.current; }, [fgRef.current, fgRefOut]);
  const themeCfg = THEMES[theme] || THEMES.space;

  const gData = useMemo(() => {
    // 层级球体大小：项目(10) > 章节(8) > 子模块(6) > 工作项(4)
    const SIZE_MAP: Record<string, number> = { project: 10, chapter: 8, 'sub-module': 6, 'work-item': 4 };
    const links = rawEdges.filter(e => {
      const ids = new Set(rawNodes.map(n => n.id));
      return ids.has(e.from) && ids.has(e.to);
    }).map(e => ({ source: e.from, target: e.to, type: e.type || 'REFERENCES', strength: (e.props as any)?.strength || 3 }));
    return {
      nodes: rawNodes.map(n => ({ ...n, name: n.label, val: SIZE_MAP[n.type] || 5 })),
      links,
    };
  }, [rawNodes, rawEdges]);

  // 选中节点时，计算所有直接关联节点
  const connectedIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const s = new Set<string>([selectedNode.id]);
    rawEdges.forEach(e => { if (e.from === selectedNode.id) s.add(e.to); if (e.to === selectedNode.id) s.add(e.from); });
    return s;
  }, [selectedNode, rawEdges]);

  // 灯光
  useEffect(() => {
    const t = setTimeout(() => {
      if (fgRef.current) {
        const scene = fgRef.current.scene();
        scene.fog = new THREE.FogExp2(themeCfg.fog, 0.0006);
        scene.children = scene.children.filter((c: any) => !c.userData?._kg);
        const pLight = new THREE.PointLight(themeCfg.light, 3, 1500); pLight.position.set(100, 100, 100); pLight.userData = { _kg: true }; scene.add(pLight);
        const ambLight = new THREE.AmbientLight(themeCfg.light, themeCfg.amb); ambLight.userData = { _kg: true }; scene.add(ambLight);
        const rim = new THREE.DirectionalLight('#ffffff', 0.4); rim.position.set(-100, -50, -100); rim.userData = { _kg: true }; scene.add(rim);
        onLightingReady(scene);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [theme]);

  // 相机跟随
  useEffect(() => {
    if (selectedNode && fgRef.current) {
      setTimeout(() => {
        const gn = gData.nodes.find((n: any) => n.id === selectedNode.id) as any;
        if (gn && typeof gn.x === 'number') {
          const dist = 180;
          const ratio = 1 + dist / Math.hypot(gn.x, gn.y, gn.z);
          fgRef.current.cameraPosition({ x: gn.x * ratio, y: gn.y * ratio, z: gn.z * ratio }, gn, 1200);
        }
      }, 200);
    }
  }, [selectedNode]);

  useEffect(() => { setTimeout(() => fgRef.current?.zoomToFit(400, 100), 1800); }, [gData]);

  const nodeObj = useCallback((node: any) => {
    const nodeColor = TYPE_COLORS[node.type] || '#6366f1';
    const isSel = node.id === selectedNode?.id;
    const isConnected = !isSel && connectedIds.has(node.id);
    const size = (node.val || 5) * 0.9;
    const group = new THREE.Group();
    // 选中=白色高亮，关联节点=增亮，其他=默认
    const emissiveIntensity = isSel ? 0.8 : isConnected ? 0.55 : 0.3;
    const matColor = isSel ? '#ffffff' : isConnected ? '#e0e7ff' : nodeColor;
    const mat = new THREE.MeshStandardMaterial({ color: matColor, emissive: nodeColor, emissiveIntensity, metalness: 0.8, roughness: 0.2 });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), mat));
    const rimOpacity = isSel ? 0.25 : isConnected ? 0.2 : 0.12;
    group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 1.3, 32, 32), new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: rimOpacity, side: THREE.BackSide })));
    // 标签
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    if (ctx) {
      const fSize = fontSize === 'sm' ? 28 : fontSize === 'lg' ? 44 : 36;
      ctx.font = `Bold ${fSize}px "Microsoft YaHei",sans-serif`; const tw = ctx.measureText(node.name).width;
      canvas.width = tw + 50; canvas.height = fSize + 20;
      const defaultColor = theme === 'moonlight' ? '#1e3a5f' : '#f8fafc';
      const labelColor = fontColor || (isSel ? '#fff' : defaultColor);
      ctx.font = `Bold ${fSize}px "Microsoft YaHei",sans-serif`; ctx.fillStyle = labelColor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = nodeColor; ctx.shadowBlur = isSel ? 12 : 4;
      ctx.fillText(node.name, canvas.width / 2, canvas.height / 2);
      const tex = new THREE.CanvasTexture(canvas); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sp.position.set(0, size + 8, 0); sp.scale.set(6 * canvas.width / canvas.height, 6, 1); group.add(sp);
    }
    return group;
  }, [selectedNode]);

  const linkColor = useCallback((l: any) => l.type?.startsWith('BELONGS') ? '#3b82f6' : l.type?.startsWith('PRECEDES') ? '#22c55e' : '#4b5563', []);

  return (
    <div className="absolute inset-0 w-full h-full transition-all duration-1000" style={{ background: themeCfg.gradient }}>
      <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">加载 3D...</div>}>
        <ForceGraph3D ref={fgRef} graphData={gData} backgroundColor="rgba(0,0,0,0)" nodeThreeObject={nodeObj} nodeThreeObjectExtend={false}
          linkWidth={(l: any) => (l.strength || 3) / 5}
          linkColor={linkColor}
          linkOpacity={0.65}
          linkDirectionalParticles={2} linkDirectionalParticleSpeed={0.004} linkDirectionalParticleWidth={1.2} linkDirectionalParticleColor={() => '#ffffff'}
          onNodeClick={onNodeClick}
          onNodeDragEnd={(n: any) => { n.fx = n.x; n.fy = n.y; n.fz = n.z; }}
          showNavInfo={false}
          d3AlphaDecay={0.03} d3VelocityDecay={0.5}
          warmupTicks={30} cooldownTicks={10} />
      </Suspense>
    </div>
  );
});

// ===== 节点详情面板 =====
const NodeDetailPanel: React.FC<{
  node: any; nodes: any[]; edges: any[]; lightTheme: boolean; onClose: () => void; onEdit: (n: any) => void; onDelete: (id: string) => void; onSelectNode: (id: string) => void;
}> = ({ node, nodes, edges, lightTheme, onClose, onEdit, onDelete, onSelectNode }) => {
  const pt = {
    panelBg: lightTheme ? 'bg-white/70 border-gray-200' : 'bg-gray-900/30 border-gray-800/20',
    textMain: lightTheme ? 'text-gray-800' : 'text-white',
  };
  const connections = useMemo(() => edges.filter(e => e.from === node.id || e.to === node.id), [edges, node.id]);
  const parentChain = useMemo(() => getParentChain(node.id, nodes, edges), [node.id, nodes, edges]);

  return (
    <div className={`backdrop-blur-3xl border-t md:border rounded-t-3xl md:rounded-xl p-6 shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-300 ${pt.panelBg}`}>
      <div className="w-12 h-1 bg-gray-700/40 rounded-full mx-auto mb-4 md:hidden" />
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className={`text-xl font-bold ${pt.textMain}`}>{node.label}</h3>
          <p className="text-xs text-indigo-400 mt-0.5">{TYPE_NAMES[node.type] || node.type}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={20} /></button>
      </div>

      <div className="space-y-4 max-h-[35vh] md:max-h-[55vh] overflow-y-auto">
        {/* 父节点链 */}
        {parentChain.length > 1 && (
          <div>
            <h5 className="text-xs font-bold text-amber-400 mb-2 uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              父节点链
              <span className="text-[10px] font-normal text-gray-600 normal-case ml-auto">{parentChain.length}级</span>
            </h5>
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              {parentChain.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-600">→</span>}
                  <button onClick={(e) => { e.stopPropagation(); onSelectNode(p.id); }}
                    className={`px-2 py-1 rounded-full border transition-colors ${
                      p.id === node.id
                        ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300 font-bold'
                        : lightTheme ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100' : 'bg-blue-500/10 border-blue-400/20 text-blue-300 hover:bg-blue-500/20'
                    }`}>
                    {p.label}
                    <span className="ml-1 text-[8px] opacity-70">{TYPE_NAMES[p.type]}</span>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 属性信息 */}
        <div className="space-y-1 border-l-2 border-white/5 pl-3 py-1">
          {node.props?.desc && <p className="text-xs text-gray-300 italic">"{node.props.desc}"</p>}
          {node.props?.completed !== undefined && (
            <p className="text-xs">{node.props.completed === 'true' ? '✅ 已完成' : '⬜ 未完成'}</p>
          )}
          {node.props?.duration && <p className="text-xs text-gray-400">⏱ {node.props.duration}</p>}
          {node.props?.area && <p className="text-xs text-gray-400">📐 {node.props.area}</p>}
          <p className="text-[10px] text-gray-600">ID: {node.id}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => onEdit(node)} className="flex-1 bg-indigo-600/30 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600/50 transition-colors flex items-center justify-center gap-1"><Edit2 size={14} />编辑</button>
          <button onClick={() => { if (confirm(`删除节点"${node.label}"?`)) onDelete(node.id); }} className="px-4 bg-red-900/20 py-2 rounded-lg text-xs text-red-400 hover:bg-red-900/40 transition-colors"><Trash2 size={14} /></button>
        </div>

        {/* 关联节点 */}
        <div className="pt-4 border-t border-gray-800/20">
          <h5 className="text-xs font-bold text-gray-500 mb-2 uppercase">关联节点 ({connections.length})</h5>
          <div className="grid grid-cols-1 gap-2">
            {connections.map(e => {
              const otherId = e.from === node.id ? e.to : e.from;
              const other = nodes.find(n => n.id === otherId);
              if (!other) return null;
              const isParent = parentChain.some(p => p.id === other.id);
              return (
                <button key={e.from + e.to + e.type} onClick={() => onSelectNode(other.id)}
                  className={`flex items-center justify-between text-xs p-2.5 rounded-lg border transition-colors ${
                    isParent ? 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10' : 'bg-gray-800/10 border-gray-700/10 hover:bg-indigo-600/10'
                  }`}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full`} style={{ background: TYPE_COLORS[other.type] || '#6366f1' }} />
                    <span className="font-medium text-gray-200">{other.label}</span>
                    {isParent && <span className="text-[9px] text-amber-500">父节点</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600">{TYPE_NAMES[other.type]}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-900/30 text-indigo-300">{TYPE_EDGE_NAMES[e.type] || e.type}</span>
                  </span>
                </button>
              );
            })}
            {connections.length === 0 && <p className="text-xs text-gray-600 text-center py-2">暂无关联节点</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== 主组件 =====
interface Props { onBack: () => void; }
const KnowledgeGraphView: React.FC<Props> = ({ onBack }) => {
  const [graph, setGraph] = useState<KGType | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<string>('space');
  // 3D场景主题独立，页面UI跟随系统三色主题
  const isSystemLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'dark';
  const lightTheme = theme === 'moonlight' || isSystemLight;
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fgRef = useRef<any>(null);

  // 弹窗
  const [showNodeDialog, setShowNodeDialog] = useState(false);
  const [showEdgeDialog, setShowEdgeDialog] = useState(false);
  const [nodeEdit, setNodeEdit] = useState({ id: '', type: 'project', label: '', color: '#3B82F6', desc: '' });
  const [nodeMode, setNodeMode] = useState<'create' | 'edit'>('create');
  const [edgeEdit, setEdgeEdit] = useState({ from: '', to: '', label: '', color: '#94a3b8', width: 2, arrow: 'curvedCW', fontSize: 10, fontColor: '#64748b', textAlign: 'on' as 'on' | 'along' });
  const [edgeFromSearch, setEdgeFromSearch] = useState('');
  const [edgeToSearch, setEdgeToSearch] = useState('');
  const [savedGraphs, setSavedGraphs] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem('kg-saved-graphs') || '{}'); } catch { return {}; } });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const [showFontPanel, setShowFontPanel] = useState(false);
  const [fontSize, setFontSize] = useState<'sm'|'md'|'lg'>(() => (localStorage.getItem('kg-font-size') as any) || 'md');
  const [fontColor, setFontColor] = useState(() => localStorage.getItem('kg-font-color') || '');

  // 保存当前图谱位置
  const handleSaveGraph = () => {
    if (!saveName.trim()) return;
    const fg = fgRef.current;
    if (!fg) return;
    const pos: Record<string, { x: number; y: number; z: number }> = {};
    const gd = fg.graphData();
    gd.nodes.forEach((n: any) => { if (typeof n.x === 'number') pos[n.id] = { x: n.x, y: n.y, z: n.z }; });
    const v: Record<string, string> = { ...savedGraphs, [saveName.trim()]: JSON.stringify(pos) };
    setSavedGraphs(v);
    localStorage.setItem('kg-saved-graphs', JSON.stringify(v));
    setSaveName('');
    setShowSaveDialog(false);
  };

  // 恢复图谱位置
  const handleRestoreGraph = (name: string) => {
    try {
      const pos = JSON.parse(savedGraphs[name] || '{}');
      const fg = fgRef.current;
      if (!fg) return;
      const gd = fg.graphData();
      Object.entries(pos).forEach(([id, p]: any) => {
        const n = gd.nodes.find((x: any) => x.id === id);
        if (n) { n.fx = p.x; n.fy = p.y; n.fz = p.z; }
      });
      // Reheat simulation briefly
      fg.d3Force('charge')?.initialize(gd.nodes);
      gd.nodes.forEach((n: any) => { if (!n.fx) { n.fx = n.x; n.fy = n.y; n.fz = n.z; } });
      // Tick a few times to settle
      for (let i = 0; i < 10; i++) fg.d3ReheatSimulation();
    } catch {}
    setShowRestoreMenu(false);
  };

  // 删除保存的版本
  const handleDeleteSaved = (name: string) => {
    const v = { ...savedGraphs };
    delete v[name];
    setSavedGraphs(v);
    localStorage.setItem('kg-saved-graphs', JSON.stringify(v));
  };

  const loadGraph = async () => {
    const kg = await api.fetchKnowledgeGraph(typeFilter);
    if (kg.available && kg.nodes.length > 0) {
      // v5.3: 过滤 Neo4j 数据，只保留属于当前存在项目的节点
      // 防止已删除项目（如 test-project、项目x、测试2）残留图谱中
      const currentProjects = new Set(getCachedProjects().map(p => 'proj-' + p.name));
      // 收集需要保留的节点ID
      const keepIds = new Set<string>();
      for (const n of kg.nodes) {
        if (n.type === 'project') {
          // 项目节点：只保留当前存在的项目
          if (currentProjects.has(n.id)) keepIds.add(n.id);
        } else {
          // 非项目节点（章节/子模块/工作项/文档/Agent等）：默认保留
          keepIds.add(n.id);
        }
      }
      // 额外检查：非项目节点如果有 parentId 指向已删除项目，也移除
      const filteredNodes = kg.nodes.filter(n => {
        if (n.type === 'project') return keepIds.has(n.id);
        // 检查是否属于已删除项目（通过 parentId 或 props.project）
        const parentProjId = n.parentId?.startsWith('proj-') ? n.parentId : null;
        const projInProps = n.props?.project ? 'proj-' + n.props.project : null;
        if ((parentProjId && !currentProjects.has(parentProjId)) ||
            (projInProps && !currentProjects.has(projInProps))) {
          return false;
        }
        return true;
      });
      const filteredIds = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = kg.edges.filter(e => filteredIds.has(e.from) && filteredIds.has(e.to));
      setApiAvailable(true);
      setGraph({ ...kg, nodes: filteredNodes, edges: filteredEdges } as KGType);
    } else {
      setApiAvailable(false);
      setGraph(buildGraph());
    }
  };
  useEffect(() => { loadGraph(); }, [typeFilter]);

  const allNodes = useMemo(() => graph?.nodes || [], [graph]);
  const allEdges = useMemo(() => graph?.edges || [], [graph]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return typeFilter === 'all' ? allNodes : allNodes.filter(n => n.type === typeFilter);
    const q = searchQuery.toLowerCase();
    let base = typeFilter === 'all' ? allNodes : allNodes.filter(n => n.type === typeFilter);
    return base.filter(n => n.label.toLowerCase().includes(q));
  }, [allNodes, typeFilter, searchQuery]);

  const ids = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => allEdges.filter(e => ids.has(e.from) && ids.has(e.to)), [allEdges, ids]);

  const types = useMemo(() => Array.from(new Set(allNodes.map(n => n.type))), [allNodes]);

  // 节点操作
  const openCreateNode = () => { setNodeMode('create'); setNodeEdit({ id: '', type: 'project', label: '', color: '#3B82F6', desc: '' }); setShowNodeDialog(true); };
  const openEditNode = (n: any) => { setNodeMode('edit'); setNodeEdit({ id: n.id, type: n.type, label: n.label, color: (n.props as any)?.color || '#3B82F6', desc: (n.props as any)?.desc || '' }); setShowNodeDialog(true); };
  const saveNode = async () => {
    if (!nodeEdit.label.trim()) return;
    const n = { id: nodeMode === 'create' ? 'node-' + Date.now() : nodeEdit.id, type: nodeEdit.type, label: nodeEdit.label.trim(), props: { color: nodeEdit.color, desc: nodeEdit.desc } };
    if (apiAvailable) await api.syncKnowledgeGraph([n], []);
    setShowNodeDialog(false); loadGraph();
  };
  const deleteNode = async (id: string) => {
    if (apiAvailable) { try { await fetch(`/api/kg/nodes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + (localStorage.getItem('doc-system-token') || '') } }); } catch {} }
    setSelectedNode(null); loadGraph();
  };
  const openCreateEdge = () => { setEdgeEdit({ from: '', to: '', label: '', color: '#94a3b8', width: 2, arrow: 'curvedCW', fontSize: 10, fontColor: '#64748b', textAlign: 'on' }); setEdgeFromSearch(''); setEdgeToSearch(''); setShowEdgeDialog(true); };
  const saveEdge = async () => {
    if (!edgeEdit.from || !edgeEdit.to) return;
    const e = { from: edgeEdit.from, to: edgeEdit.to, type: edgeEdit.label || 'REFERENCES', label: edgeEdit.label, props: { color: edgeEdit.color, width: edgeEdit.width, arrowStyle: edgeEdit.arrow, fontSize: edgeEdit.fontSize, fontColor: edgeEdit.fontColor, textAlign: edgeEdit.textAlign } };
    if (apiAvailable) await api.syncKnowledgeGraph([], [e]);
    setShowEdgeDialog(false); loadGraph();
  };

  const filteredFrom = useMemo(() => allNodes.filter(n => edgeFromSearch ? n.label.includes(edgeFromSearch) : true).slice(0, 20), [allNodes, edgeFromSearch]);
  const filteredTo = useMemo(() => allNodes.filter(n => edgeToSearch ? n.label.includes(edgeToSearch) : true).slice(0, 20), [allNodes, edgeToSearch]);

  const t = {
    headerBg: lightTheme ? 'bg-white/80 border-gray-200 border-b' : 'bg-gray-950/50 border-white/5',
    panelBg: lightTheme ? 'bg-white/70 border-gray-200' : 'bg-gray-900/30 border-gray-800/20',
    inputBg: lightTheme ? 'bg-white/80 border-gray-200 text-gray-800 placeholder:text-gray-400' : 'bg-gray-900/40 border-white/10 text-gray-100 placeholder:text-gray-600',
    dialogBg: lightTheme ? 'bg-white/50 backdrop-blur-xl border-gray-200' : 'bg-gray-900/50 backdrop-blur-xl border-white/10',
    dialogInput: lightTheme ? 'bg-white/70 border-gray-300 text-black' : 'bg-gray-800/50 border-white/10 text-gray-100',
    dialogLabel: lightTheme ? 'text-black font-medium' : 'text-gray-400',
    dialogCancel: lightTheme ? 'text-gray-700 border-gray-300 hover:bg-gray-100' : 'text-gray-400 border-white/10 hover:text-white',
    cardBg: lightTheme ? 'bg-white/40 border-gray-200' : 'bg-gray-900/40 border-white/5',
    textMain: lightTheme ? 'text-gray-800' : 'text-white',
    textSub: lightTheme ? 'text-gray-600' : 'text-gray-400',
    textDim: lightTheme ? 'text-gray-400' : 'text-gray-500',
    hoverBg: lightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10',
    btnOutline: lightTheme ? 'bg-white/50 border-gray-300 text-gray-700 hover:text-gray-900 text-xs' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white text-xs',
    menuBg: lightTheme ? 'bg-white/90 border-gray-200' : 'bg-gray-900/80 border-white/10',
    dropdownBg: lightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-white/10',
  };

  return (
    <div className={`h-screen w-full overflow-hidden flex flex-col font-sans ${lightTheme ? 'bg-gray-100 text-gray-800' : 'bg-gray-950 text-gray-100'}`}>
      {/* ===== 3D 背景全屏 ===== */}
      <div className="absolute inset-0 z-0">
        <Graph3DCanvas
          nodes={filteredNodes} edges={filteredEdges} selectedNode={selectedNode}
          onNodeClick={(n) => setSelectedNode(n)}
          theme={theme}
          onLightingReady={() => {}}
          fgRefOut={fgRef}
          fontSize={fontSize}
          fontColor={fontColor}
        />
      </div>

      {/* ===== 顶部栏 ===== */}
      <header className={`relative z-20 flex items-center justify-between px-4 py-3 backdrop-blur-xl border-b ${t.headerBg}`}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`p-1.5 rounded-lg ${t.hoverBg}`}><ArrowLeft className={`w-5 h-5 ${t.textSub}`} /></button>
          <div className="bg-indigo-600 p-1.5 rounded-lg"><Cpu className="text-white" size={18} /></div>
          <h1 className={`text-lg font-bold tracking-tight ${t.textMain}`}>知识图谱<span className="text-indigo-500">3D</span></h1>
          <span className={`text-xs ${t.textDim}`}>{allNodes.length}节点 · {allEdges.length}边</span>
          {apiAvailable !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${apiAvailable ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{apiAvailable ? 'Neo4j' : '本地'}</span>
          )}
          {/* 主题选择 */}
          <div className="relative ml-2">
            <button onClick={() => setShowThemeMenu(!showThemeMenu)} className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${t.btnOutline}`}>
              <Palette size={12} className="text-indigo-400" />{THEMES[theme]?.name}<ChevronDown size={10} className={`transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} />
            </button>
            {showThemeMenu && (
              <div className={`absolute top-full left-0 mt-1 backdrop-blur-2xl border rounded-xl shadow-2xl overflow-hidden z-50 min-w-[120px] ${t.menuBg}`}>
                {Object.entries(THEMES).map(([k, v]) => (
                  <button key={k} onClick={() => { setTheme(k); setShowThemeMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-[10px] transition-colors uppercase font-bold tracking-wider ${t.hoverBg} ${theme === k ? 'text-indigo-400' : t.textSub}`}>{v.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={openCreateNode} className="px-2.5 py-1.5 text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 rounded-lg hover:bg-indigo-600/30 flex items-center gap-1"><Plus className="w-3 h-3" />新建</button>
          <button onClick={openCreateEdge} className="px-2.5 py-1.5 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/20 rounded-lg hover:bg-purple-600/30 flex items-center gap-1"><Link2 className="w-3 h-3" />连线</button>
          <button onClick={() => setShowFontPanel(true)} className={`px-2 py-1 border rounded-lg flex items-center gap-1 ${t.btnOutline}`} title="字体设置"><Type className="w-3 h-3" /></button>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={`px-2 py-1 border rounded-lg ${t.btnOutline}`}>
            <option value="all">全部</option>{types.map(t => <option key={t} value={t}>{TYPE_NAMES[t] || t}</option>)}
          </select>
          <button onClick={loadGraph} className={`px-2 py-1 border rounded-lg flex items-center gap-1 ${t.btnOutline}`}><RotateCcw className="w-3 h-3" />刷新</button>
          <button onClick={() => { setSaveName(''); setShowSaveDialog(true); }} className={`px-2 py-1 border rounded-lg flex items-center gap-1 ${t.btnOutline}`} title="保存当前图谱"><Camera className="w-3 h-3" /></button>
          {/* 恢复菜单 */}
          <div className="relative">
            <button onClick={() => setShowRestoreMenu(!showRestoreMenu)} className={`px-2 py-1 border rounded-lg flex items-center gap-1 ${t.btnOutline}`} title="恢复图谱版本"><RotateCcw className="w-3 h-3" /></button>
            {showRestoreMenu && Object.keys(savedGraphs).length > 0 && (
              <div className={`absolute top-full right-0 mt-1 backdrop-blur-2xl border rounded-xl shadow-2xl overflow-hidden z-50 min-w-[180px] ${t.menuBg}`}>
                {Object.entries(savedGraphs).map(([name]) => (
                  <div key={name} className="flex items-center hover:bg-indigo-600/10">
                    <button onClick={() => handleRestoreGraph(name)} className="flex-1 text-left px-3 py-2 text-xs text-gray-300">{name}</button>
                    <button onClick={() => handleDeleteSaved(name)} className="px-2 text-red-400 hover:text-red-300"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { const data = JSON.stringify({ nodes: allNodes, edges: allEdges }, null, 2); const b = new Blob([data], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'knowledge-graph.json'; a.click(); }} className={`px-2 py-1 border rounded-lg flex items-center gap-1 ${t.btnOutline}`}><Download className="w-3 h-3" /></button>
        </div>
      </header>

      {/* ===== 浮动搜索 + 总览 ===== */}
      <div className="relative z-10 pointer-events-none flex-1">
        {/* 搜索悬浮框 */}
        <div className="absolute top-4 left-4 w-80 pointer-events-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input type="text" placeholder="搜索节点…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none 500/40 transition-all backdrop-blur-2xl shadow-xl ${t.inputBg}`} />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={14} /></button>}
          </div>
          {searchQuery && filteredNodes.length > 0 && (
            <div className={`mt-2 backdrop-blur-3xl border rounded-2xl max-h-[40vh] overflow-y-auto shadow-2xl ${t.menuBg}`}>
              {filteredNodes.slice(0, 15).map(n => (
                <button key={n.id} onClick={() => { setSelectedNode(n); setSearchQuery(''); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-indigo-600/10 text-left transition-colors border-b border-white/5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: (n.props as any)?.color || TYPE_COLORS[n.type] || '#6366f1' }}>{n.label[0]}</div>
                  <div className="flex-1 overflow-hidden">
                    <p className={`text-sm font-semibold truncate ${lightTheme ? 'text-gray-800' : 'text-gray-200'}`}>{n.label}</p>
                    <p className={`text-[10px] ${t.textDim}`}>{TYPE_NAMES[n.type] || n.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 总览计数器 */}
        <div className={`absolute top-4 right-4 backdrop-blur-2xl border px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-auto flex items-center gap-3 ${t.cardBg}`}>
          <div className="bg-indigo-600/20 p-1.5 rounded-lg"><Users size={16} className="text-indigo-400" /></div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textDim}`}>节点 · 连线</p>
            <p className={`text-xl font-black leading-none ${t.textMain}`}>{allNodes.length}<span className={`text-sm mx-1 ${t.textDim}`}>·</span>{allEdges.length}</p>
          </div>
        </div>

        {/* 节点详情面板（右侧滑入） */}
        {selectedNode && (
          <div className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-20 md:right-4 md:w-80 pointer-events-auto">
            <NodeDetailPanel
              node={selectedNode} nodes={allNodes} edges={allEdges} lightTheme={lightTheme}
              onClose={() => setSelectedNode(null)} onEdit={openEditNode} onDelete={deleteNode}
              onSelectNode={(id) => { const n = allNodes.find(x => x.id === id); if (n) setSelectedNode(n); }}
            />
          </div>
        )}
      </div>

      {/* ===== 新建/编辑节点弹窗 ===== */}
      {showNodeDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowNodeDialog(false)}>
          <div className={`backdrop-blur-2xl border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 ${t.dialogBg}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h3 className={`text-sm font-bold ${t.textMain}`}>{nodeMode === 'create' ? '新建节点' : '编辑节点'}</h3><button onClick={() => setShowNodeDialog(false)}><X className="w-5 h-5 text-gray-500 hover:text-white" /></button></div>
            <div className="space-y-3">
              <div><label className={`block text-xs mb-1 ${t.dialogLabel}`}>名称 *</label><input value={nodeEdit.label} onChange={e => setNodeEdit(p => ({ ...p, label: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-xs 500/40 outline-none ${t.dialogInput}`} placeholder="输入节点名称" autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`block text-xs mb-1 ${t.dialogLabel}`}>类型</label><select value={nodeEdit.type} onChange={e => setNodeEdit(p => ({ ...p, type: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${t.dialogInput}`}>{types.map(t => <option key={t} value={t}>{TYPE_NAMES[t] || t}</option>)}</select></div>
                <div><label className={`block text-xs mb-1 ${t.dialogLabel}`}>颜色</label><input type="color" value={nodeEdit.color} onChange={e => setNodeEdit(p => ({ ...p, color: e.target.value }))} className={`w-full h-9 border rounded-lg p-1 ${t.dialogInput}`} /></div>
              </div>
              <div><label className={`block text-xs mb-1 ${t.dialogLabel}`}>描述</label><textarea value={nodeEdit.desc} onChange={e => setNodeEdit(p => ({ ...p, desc: e.target.value }))} rows={3} className={`w-full border rounded-lg px-3 py-2 text-xs 500/40 outline-none resize-none ${t.dialogInput}`} placeholder="可选描述" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/10">
              <button onClick={() => setShowNodeDialog(false)} className={`px-4 py-2 text-xs border rounded-lg ${t.dialogCancel}`}>取消</button>
              <button onClick={saveNode} disabled={!nodeEdit.label.trim()} className="px-4 py-2 text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 rounded-lg hover:bg-indigo-600/50 disabled:opacity-40 flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新建连线弹窗 ===== */}
      {showEdgeDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowEdgeDialog(false)}>
          <div className={`backdrop-blur-2xl border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto p-6 ${t.dialogBg}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h3 className={`text-lg font-bold ${t.textMain}`}>新建连线</h3><button onClick={() => setShowEdgeDialog(false)}><X className="w-5 h-5 text-gray-500 hover:text-white" /></button></div>
            <div className="space-y-4">
              {[['from', '父节点（来源）', edgeFromSearch, setEdgeFromSearch, filteredFrom], ['to', '子节点（目标）', edgeToSearch, setEdgeToSearch, filteredTo]].map(([key, label, search, setSearch, list]) => (
                <div key={key as string}>
                  <label className="block text-xs text-gray-400 mb-1">{label as string}</label>
                  <input value={search as string} onChange={e => (setSearch as any)(e.target.value)} placeholder="输入名称搜索…" className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100 500/40 outline-none mb-1" />
                  <div className="max-h-28 overflow-y-auto bg-gray-800/20 rounded-xl divide-y divide-white/5">
                    {(list as any[]).map((n: any) => (
                      <button key={n.id} onClick={() => { setEdgeEdit(p => ({ ...p, [key as string]: n.id })); (setSearch as any)(n.label); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-600/20 transition-colors ${(edgeEdit as any)[key as string] === n.id ? 'bg-indigo-600/10 text-indigo-300 font-medium' : 'text-gray-400'}`}>{n.label}<span className="text-gray-600 ml-2">({TYPE_NAMES[n.type] || n.type})</span></button>
                    ))}
                    {(list as any[]).length === 0 && <p className="px-3 py-2 text-xs text-gray-600">无匹配节点</p>}
                  </div>
                </div>
              ))}
              {edgeEdit.from && edgeEdit.to && <div className="bg-indigo-500/10 rounded-xl p-2 text-xs text-gray-300">已选: <b className="text-indigo-300">{allNodes.find(n => n.id === edgeEdit.from)?.label || edgeEdit.from} → {allNodes.find(n => n.id === edgeEdit.to)?.label || edgeEdit.to}</b></div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">标签</label><input value={edgeEdit.label} onChange={e => setEdgeEdit(p => ({ ...p, label: e.target.value }))} className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-100 outline-none" placeholder="如: 所属项目" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">颜色</label><input type="color" value={edgeEdit.color} onChange={e => setEdgeEdit(p => ({ ...p, color: e.target.value }))} className="w-full h-9 bg-gray-800/50 border border-white/10 rounded-xl p-1" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">粗细: {edgeEdit.width}px</label><input type="range" min="1" max="8" value={edgeEdit.width} onChange={e => setEdgeEdit(p => ({ ...p, width: Number(e.target.value) }))} className="w-full" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">字号: {edgeEdit.fontSize}px</label><input type="range" min="8" max="24" value={edgeEdit.fontSize} onChange={e => setEdgeEdit(p => ({ ...p, fontSize: Number(e.target.value) }))} className="w-full" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-white/10">
              <button onClick={() => setShowEdgeDialog(false)} className={`px-5 py-2.5 text-xs border rounded-xl ${t.dialogCancel}`}>取消</button>
              <button onClick={saveEdge} disabled={!edgeEdit.from || !edgeEdit.to} className="px-5 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-40 flex items-center gap-1.5"><Save className="w-4 h-4" />保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 字体设置面板 ===== */}
      {showFontPanel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowFontPanel(false)}>
          <div className={`backdrop-blur-2xl border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 ${t.dialogBg}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h3 className={`text-sm font-bold ${t.textMain}`}>节点字体设置</h3><button onClick={() => setShowFontPanel(false)}><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs mb-2 ${t.dialogLabel}`}>字体大小</label>
                <div className="flex gap-2">
                  {[{k:'sm',l:'小'},{k:'md',l:'中'},{k:'lg',l:'大'}].map(s => (
                    <button key={s.k} onClick={() => { setFontSize(s.k as any); localStorage.setItem('kg-font-size', s.k); }}
                      className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${fontSize === s.k ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 font-bold' : `border-white/10 ${t.textSub}`} ${t.hoverBg}`}>{s.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-2 ${t.dialogLabel}`}>字体颜色</label>
                <div className="flex items-center gap-2 mb-2">
                  <input type="color" value={fontColor} onChange={e => { setFontColor(e.target.value); localStorage.setItem('kg-font-color', e.target.value); }} className="w-10 h-9 border rounded-lg p-0.5" />
                  <span className={`text-xs ${t.textSub}`}>自定义</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['#f8fafc','#1e3a5f','#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#000000','#ffffff'].map(c => (
                    <button key={c} onClick={() => { setFontColor(c); localStorage.setItem('kg-font-color', c); }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${fontColor === c ? 'border-indigo-400 scale-110' : 'border-transparent'}`}
                      style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
              <button onClick={() => { setFontColor(''); localStorage.removeItem('kg-font-color'); setFontSize('md'); localStorage.setItem('kg-font-size', 'md'); }}
                className={`w-full py-2 text-xs border rounded-lg ${t.dialogCancel}`}>恢复默认</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 保存图谱版本弹窗 ===== */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
          <div className={`backdrop-blur-2xl border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 ${t.dialogBg}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h3 className={`text-lg font-bold ${t.textMain}`}>保存当前图谱</h3><button onClick={() => setShowSaveDialog(false)}><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-3">
              <div><label className={`block text-xs mb-1 ${t.dialogLabel}`}>版本名称</label><input value={saveName} onChange={e => setSaveName(e.target.value)} className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none ${t.dialogInput}`} placeholder="如: 默认布局 / 项目展示版" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveGraph()} /></div>
              {Object.keys(savedGraphs).length > 0 && (
                <div>
                  <label className={`block text-xs mb-1 ${t.dialogLabel}`}>已有版本 ({Object.keys(savedGraphs).length})</label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {Object.keys(savedGraphs).map(name => (
                      <div key={name} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-white/5">
                        <span className={t.textSub}>{name}</span>
                        <button onClick={() => handleDeleteSaved(name)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/10">
              <button onClick={() => setShowSaveDialog(false)} className={`px-4 py-2 text-xs border rounded-xl ${t.dialogCancel}`}>取消</button>
              <button onClick={handleSaveGraph} disabled={!saveName.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-40 flex items-center gap-1.5"><Save className="w-4 h-4" />保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphView;
