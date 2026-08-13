/**
 * AI 能力图表 — AI-G1 调用趋势 / AI-G2 Skill分布 / AI-G3 知识图谱规模 / AI-G4 协作网络
 *
 * 数据来源：
 *   - AI-G1: aiUsageTracker
 *   - AI-G2: aiUsageTracker (byService)
 *   - AI-G3: knowledgeGraph.getGraph()
 *   - AI-G4: knowledgeGraph.getGraph()（Agent 节点已注入知识图谱）
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import { aiUsageTracker } from '../../data/aiUsageTracker';
import { getGraph, GraphNode, GraphEdge, TYPE_NAMES } from '../../data/knowledgeGraph';

interface Props { dark?: boolean; }

const COLORS: Record<string, string> = {
  skill: '#3B82F6', agent: '#8B5CF6', rag: '#10B981', review: '#F59E0B', chat: '#EC4899',
};
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Tailwind bg-* 类名 → 实际颜色值（用于 Canvas 渲染）
const COLOR_MAP: Record<string, string> = {
  'bg-red-500': '#EF4444', 'bg-green-500': '#10B981', 'bg-blue-500': '#3B82F6',
  'bg-amber-500': '#F59E0B', 'bg-violet-500': '#8B5CF6',
};

const AiCapabilityCharts: React.FC<Props> = ({ dark }) => {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const graphRef = useRef<any>(null);
  const [kgData, setKgData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);

  // 加载知识图谱数据
  useEffect(() => {
    try {
      const graph = getGraph();
      if (graph) setKgData({ nodes: graph.nodes, edges: graph.edges });
    } catch {}
  }, []);

  // 配置力导向参数（解决视图出界问题）
  useEffect(() => {
    if (graphRef.current && kgData) {
      try {
        graphRef.current.d3Force('link')?.distance(120);
        graphRef.current.d3Force('charge')?.strength(-300);
        graphRef.current.d3Force('center')?.strength(0.05);
        graphRef.current.d3Reheat();
      } catch {}
    }
  }, [kgData]);

  // AI-G1: 近14天调用趋势
  const trendData = useMemo(() => {
    return aiUsageTracker.getTrend(14).map(t => ({
      date: t.date.slice(5),
      skill: 0, agent: 0, rag: 0, review: 0, chat: 0,
      ...aiUsageTracker.getAllRecords()
        .filter(r => r.timestamp.slice(0, 10) === t.date)
        .reduce((acc, r) => { acc[r.serviceType] = (acc[r.serviceType] || 0) + 1; return acc; }, {} as Record<string, number>),
    }));
  }, []);

  // AI-G2: Skill 使用分布
  const skillData = useMemo(() => {
    const stats = aiUsageTracker.getStats();
    const skillEntries = Object.entries(stats.byService)
      .filter(([key]) => key.startsWith('skill:'))
      .map(([key, v]) => ({
        name: key.replace('skill:', ''),
        value: v.count,
      }));
    return skillEntries.length > 0 ? skillEntries : [
      { name: '施工审查', value: 0 }, { name: '合同审查', value: 0 },
      { name: '招投标审查', value: 0 }, { name: '方案生成', value: 0 },
      { name: '表单填写', value: 0 }, { name: '办理指南', value: 0 },
      { name: '拆解任务', value: 0 },
    ];
  }, []);

  // AI-G3: 知识图谱规模
  const kgStats = useMemo(() => {
    if (!kgData) return { nodes: 0, edges: 0, types: [] as { name: string; value: number }[] };
    const typeMap: Record<string, number> = {};
    kgData.nodes.forEach((n: GraphNode) => {
      const t = n.type || 'other';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    return {
      nodes: kgData.nodes.length,
      edges: kgData.edges.length,
      types: Object.entries(typeMap).map(([name, value]) => ({ name: TYPE_NAMES[name] || name, value })),
    };
  }, [kgData]);

  // AI-G4: 从知识图谱提取 Agent 节点和协作关系
  const graphData = useMemo(() => {
    if (!kgData) return { nodes: [], links: [] };

    const stats = aiUsageTracker.getStats();
    const agentNodes = kgData.nodes.filter(n => n.type === 'agent');
    const nodes = agentNodes.map(n => {
      const agentId = n.id.replace('agent-', '');
      const calls = Object.entries(stats.byService)
        .filter(([k]) => k.includes(agentId))
        .reduce((s, [, v]) => s + v.count, 0) || 1;
      const color = COLOR_MAP[n.props?.color || ''] || '#8B5CF6';
      return { id: n.id, name: n.label, role: n.props?.role || '', color, calls };
    });

    const agentIdSet = new Set(nodes.map(n => n.id));
    const links = kgData.edges
      .filter(e => e.type === 'collaborates' && agentIdSet.has(e.from) && agentIdSet.has(e.to))
      .map(e => ({ source: e.from, target: e.to, label: e.label }));

    return { nodes, links };
  }, [kgData]);

  // 自定义节点渲染
  const nodeCanvasObject = (node: any, ctx: any, globalScale: number) => {
    const radius = 8 + Math.sqrt(node.calls || 1) * 2;
    const fontSize = 12 / globalScale;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    if (node === selectedAgent) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = dark ? '#e2e8f0' : '#1e293b';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dark ? '#e2e8f0' : '#1e293b';
    ctx.fillText(node.name, node.x, node.y + radius + fontSize);
  };

  const linkCanvasObject = (link: any, ctx: any, _gs: number) => {
    ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  };

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';

  return (
    <div className="space-y-6">
      {/* AI-G1: 调用趋势 */}
      <div className={cardCls}>
        <h3 className={titleCls}>📈 AI 服务调用趋势（近14天）</h3>
        {trendData.some(d => d.skill + d.agent + d.rag + d.review + d.chat > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartColors.text }} />
              <YAxis tick={{ fontSize: 10, fill: chartColors.text }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="review" stackId="1" stroke={COLORS.review} fill={COLORS.review} fillOpacity={0.6} name="AI审查" />
              <Area type="monotone" dataKey="skill" stackId="1" stroke={COLORS.skill} fill={COLORS.skill} fillOpacity={0.6} name="技能" />
              <Area type="monotone" dataKey="agent" stackId="1" stroke={COLORS.agent} fill={COLORS.agent} fillOpacity={0.6} name="Agent" />
              <Area type="monotone" dataKey="rag" stackId="1" stroke={COLORS.rag} fill={COLORS.rag} fillOpacity={0.6} name="RAG检索" />
              <Area type="monotone" dataKey="chat" stackId="1" stroke={COLORS.chat} fill={COLORS.chat} fillOpacity={0.6} name="AI对话" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
            AI 调用记录为空。<br />使用 AI 功能后自动生成趋势分析。
          </p>
        )}
      </div>

      {/* AI-G2 + AI-G3 并排（等高布局，高度增加50%） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* AI-G2: Skill 使用分布 */}
        <div className={`${cardCls} flex flex-col min-h-[440px]`}>
          <h3 className={titleCls}>⚡ AI 技能使用分布</h3>
          <div className="flex-1 flex flex-col">
            {skillData.some(d => d.value > 0) ? (
              <>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={skillData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={{ strokeWidth: 1 }}
                        style={{ fontSize: '12px' }}>
                        {skillData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2 shrink-0">
                  统计来源：AI 服务调用记录 · 总调用 {skillData.reduce((s, d) => s + d.value, 0)} 次
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 m-auto">
                AI 能力已就绪。<br />使用 AI 审查/生成/填表功能后自动生成分析。
              </p>
            )}
          </div>
        </div>

        {/* AI-G3: 知识图谱规模 */}
        <div className={`${cardCls} flex flex-col min-h-[440px]`}>
          <h3 className={titleCls}>🧠 知识图谱规模</h3>
          <div className="flex-1 flex flex-col">
            {kgStats.nodes > 0 ? (
              <>
                <div className="flex items-baseline gap-4 mb-2 shrink-0">
                  <div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-200">{kgStats.nodes}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">节点</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-200">{kgStats.edges}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">关系</span>
                  </div>
                </div>
                {kgStats.types.length > 0 && (
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={kgStats.types} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                          label={({ name, percent, value }) => `${name}: ${value}个 (${((percent || 0) * 100).toFixed(0)}%)`}
                          labelLine={{ strokeWidth: 1 }}
                          style={{ fontSize: '11px' }}>
                          {kgStats.types.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2 shrink-0">
                  统计来源：节点类型构成 · 关系数已单列上方
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 m-auto">
                知识图谱未构建。<br />使用知识图谱功能后自动生成分析。
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI-G4: 协作网络（数据来自知识图谱） */}
      <div className={cardCls}>
        <h3 className={titleCls}>🌐 Multi-Agent 协作网络</h3>
        {graphData.nodes.length > 0 ? (
          <>
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={680}
              height={320}
              nodeCanvasObject={nodeCanvasObject}
              linkCanvasObject={linkCanvasObject}
              nodeRelSize={8}
              cooldownTicks={100}
              onNodeClick={(node: any) => setSelectedAgent(node)}
              backgroundColor="transparent"
            />
            {selectedAgent && (
              <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAgent.color }} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{selectedAgent.name}</span>
                  <span className="text-xs text-slate-400">（{selectedAgent.role}）</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">调用次数：{selectedAgent.calls}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              数据来源：知识图谱 · 交互：拖拽/缩放/点击 · 节点大小=调用频次
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
            知识图谱未构建。<br />Agent 节点将在构建知识图谱后自动注入。
          </p>
        )}
      </div>
    </div>
  );
};

export default AiCapabilityCharts;
