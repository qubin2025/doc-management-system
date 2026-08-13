/**
 * 全局高级图表 — O6 经验库复用Top10 / O7 Agent工具调用桑基图
 *
 * 数据来源：
 *   - O6: listExperiences (project_experiences)
 *   - O7: aiUsageTracker (Agent 工具调用记录)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Sankey } from 'recharts';
import { listExperiences, ExperienceItem } from '../../data/api';
import { aiUsageTracker } from '../../data/aiUsageTracker';

interface Props { dark?: boolean; }

const CATEGORY_COLORS: Record<string, string> = {
  '安全管理': '#EF4444', '质量管理': '#10B981', '成本控制': '#F59E0B', '进度管理': '#3B82F6',
};

const AGENT_COLORS: Record<string, string> = {
  'safety-inspector': '#EF4444', 'quality-engineer': '#10B981', 'contract-analyst': '#3B82F6',
  'cost-analyst': '#F59E0B', 'general-engineer': '#8B5CF6',
};

const TOOL_LABELS: Record<string, string> = {
  ai_chat: 'AI对话', scan_workitems: '扫描工作项', scan_forms: '扫描表单',
  knowledge_search: '知识检索', rag_search: 'RAG检索', compute_kpi: '指标计算',
  index_document: '索引文档', fill_form: '表单填写', health_check: '健康检查',
};

const AGENT_LABELS: Record<string, string> = {
  'safety-inspector': '安全审查员', 'quality-engineer': '质量工程师',
  'contract-analyst': '合同分析师', 'cost-analyst': '造价分析师',
  'general-engineer': '综合工程Agent',
};

const GlobalAdvancedCharts: React.FC<Props> = ({ dark }) => {
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      console.log('[O6-经验库] 开始加载', { timestamp: new Date().toISOString() });
      try {
        const res = await listExperiences({ limit: 100 });
        if (cancelled) return;
        const realItems = res?.items || [];
        console.log('[O6-经验库] API 返回', { count: realItems.length, total: res?.total, categories: res?.categories });
        // 无 mock 兜底，空数据直接显示空状态
        if (!cancelled) setExperiences(realItems);
      } catch (err: any) {
        console.error('[O6-经验库] 加载异常', err?.message || err);
        if (!cancelled) {
          // 加载失败时保持空数据，不注入 mock
          setExperiences([]);
          console.warn('[O6-经验库] 加载异常，已显示空数据');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // O6: 经验库 Top10
  const top10Data = useMemo(() => {
    const sorted = [...experiences].sort((a, b) => (b.referenceCount || 0) - (a.referenceCount || 0)).slice(0, 10);
    const data = sorted.map(e => ({
      name: e.title.length > 14 ? e.title.slice(0, 14) + '…' : e.title,
      fullName: e.title,
      category: e.category,
      refs: e.referenceCount || 0,
      project: e.projectName,
    }));
    console.log('[O6-经验库] Top10 渲染数据', {
      total: experiences.length,
      top10: data.map(d => `${d.name}: ${d.refs}`),
      categoryDist: experiences.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {} as Record<string, number>),
    });
    return data;
  }, [experiences]);

  // O7: Agent 工具调用桑基图
  const sankeyData = useMemo(() => {
    let records = aiUsageTracker.getAllRecords().filter(r => r.serviceType === 'agent');
    console.log('[O7-Agent桑基] aiUsageTracker 记录', { agentRecords: records.length, totalRecords: aiUsageTracker.getAllRecords().length });
    // 无 mock 兜底，空数据直接显示空状态

    // 统计 Agent → Tool 调用次数
    const flow: Record<string, number> = {};
    const agentCount: Record<string, number> = {};
    const toolCount: Record<string, number> = {};
    records.forEach(r => {
      const agent = r.serviceName;
      const tool = (r.metadata?.tool as string) || 'ai_chat';
      const key = `${agent}|${tool}`;
      flow[key] = (flow[key] || 0) + 1;
      agentCount[agent] = (agentCount[agent] || 0) + 1;
      toolCount[tool] = (toolCount[tool] || 0) + 1;
    });

    const agentList = Object.keys(agentCount);
    const toolList = Object.keys(toolCount);
    const nodes = [
      ...agentList.map(id => ({ name: AGENT_LABELS[id] || id })),
      ...toolList.map(id => ({ name: TOOL_LABELS[id] || id })),
    ];
    const links = Object.entries(flow).map(([k, v]) => {
      const [agent, tool] = k.split('|');
      return { source: agentList.indexOf(agent), target: agentList.length + toolList.indexOf(tool), value: v };
    });

    console.log('[O7-Agent桑基] 渲染数据', {
      total: records.length,
      agents: agentList.map(a => `${a}:${agentCount[a]}`),
      tools: toolList.map(t => `${t}:${toolCount[t]}`),
      flows: links.map(l => `${nodes[l.source].name}→${nodes[l.target].name}: ${l.value}`),
    });

    return { nodes, links, total: records.length };
  }, []);

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';
  const emptyCls = 'text-xs text-slate-400 dark:text-slate-500 text-center py-8';

  const ExpTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text, maxWidth: 280 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.fullName}</p>
        <p>分类: {d.category} · 项目: {d.project}</p>
        <p>引用次数: <span style={{ fontWeight: 600, color: '#3B82F6' }}>{d.refs}</span></p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* O6: 经验库复用 Top10 */}
      <div className={cardCls}>
        <h3 className={titleCls}>💡 经验库复用 Top10</h3>
        {!loading && top10Data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={top10Data} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: chartColors.text }} width={120} />
                <Tooltip content={<ExpTooltip />} cursor={{ fill: dark ? '#33415533' : '#e2e8f033' }} />
                <Bar dataKey="refs" radius={[0, 4, 4, 0]}>
                  {top10Data.map((d, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[d.category] || '#3B82F6'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs flex-wrap">
              {Object.entries(CATEGORY_COLORS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: v }} />
                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
              数据来源：项目经验库 · 共 {experiences.length} 条经验 · Top10 按引用次数排序
            </p>
          </>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无经验数据。<br />请在「项目经验库」中提取经验。'}
          </p>
        )}
      </div>

      {/* O7: Agent 工具调用桑基图 */}
      <div className={cardCls}>
        <h3 className={titleCls}>🤖 Agent 工具调用流向</h3>
        {!loading && sankeyData.total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <Sankey
                data={sankeyData}
                nodeWidth={14}
                nodePadding={20}
                linkCurvature={0.5}
              >
                <Tooltip />
              </Sankey>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-3 mt-2 text-xs flex-wrap">
              {Object.entries(AGENT_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: AGENT_COLORS[k] }} />
                  <span className="text-slate-500 dark:text-slate-400">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
              左侧=Agent · 右侧=调用工具 · 流量宽度=调用次数 · 共 {sankeyData.total} 次调用
            </p>
          </>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无 Agent 调用记录。<br />请通过 Agent 控制台执行任务。'}
          </p>
        )}
      </div>
    </div>
  );
};

export default GlobalAdvancedCharts;
