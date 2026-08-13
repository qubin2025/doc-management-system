/**
 * 全局运营图表 — O3 问题处理桑基图 / O4 审计日志热力图
 *
 * 数据来源：
 *   - O3: fetchAllIssues (mobile_issues)
 *   - O4: fetchAuditLogs (audit_log)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid } from 'recharts';
import { fetchAllIssues, fetchAuditLogs, DesktopIssue, AuditLogEntry } from '../../data/api';

interface Props { dark?: boolean; }

const SEVERITY_MAP: Record<string, string> = { normal: '一般', serious: '严重', urgent: '紧急' };
const STATUS_MAP: Record<string, string> = { reported: '已报告', processing: '处理中', resolved: '已解决', closed: '已关闭' };
const ACTION_MAP: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除', view: '查看', export: '导出', import: '导入',
};

const GlobalOperationCharts: React.FC<Props> = ({ dark }) => {
  const [issues, setIssues] = useState<DesktopIssue[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      console.log('[O3-桑基图] 开始加载', { timestamp: new Date().toISOString() });
      try {
        const [i, l] = await Promise.all([
          fetchAllIssues(),
          fetchAuditLogs({ limit: 500 }),
        ]);
        if (cancelled) return;

        // ===== O3: 问题数据（无 mock 兜底，空数据直接显示空状态） =====
        const realIssues = Array.isArray(i) ? i : [];
        console.log('[O3-桑基图] API 返回', { count: realIssues.length, sample: realIssues.slice(0, 2) });
        const finalIssues = realIssues;
        // 数据完整性校验
        const validIssues = finalIssues.filter(iss => iss && iss.severity && iss.status);
        const invalidCount = finalIssues.length - validIssues.length;
        if (invalidCount > 0) {
          console.warn('[O3-桑基图] 过滤无效数据', { invalid: invalidCount, kept: validIssues.length });
        }
        // 严重度/状态分布校验
        const sevDist = validIssues.reduce((acc, iss) => { acc[iss.severity] = (acc[iss.severity] || 0) + 1; return acc; }, {} as Record<string, number>);
        const statDist = validIssues.reduce((acc, iss) => { acc[iss.status] = (acc[iss.status] || 0) + 1; return acc; }, {} as Record<string, number>);
        console.log('[O3-桑基图] 数据分布', {
          total: validIssues.length,
          bySeverity: sevDist,
          byStatus: statDist,
          projects: Array.from(new Set(validIssues.map(i => i.projectName))),
        });
        setIssues(validIssues);

        // ===== O4: 审计日志（无 mock 兜底，空数据直接显示空状态） =====
        const realLogs = Array.isArray(l) ? l : [];
        console.log('[O4-审计热力] API 返回', { count: realLogs.length, sample: realLogs.slice(0, 2) });
        setLogs(realLogs);
      } catch (err: any) {
        console.error('[O3/O4] 加载异常', err?.message || err);
        if (!cancelled) {
          // 加载失败时保持空数据，不注入 mock
          setIssues([]);
          setLogs([]);
          console.warn('[O3/O4] 加载异常，已显示空数据', { issues: 0, logs: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // O3: 问题桑基图数据
  const sankeyData = useMemo(() => {
    const sevCount: Record<string, number> = {};
    const statCount: Record<string, number> = {};
    const flow: Record<string, number> = {};
    issues.forEach(iss => {
      const sev = SEVERITY_MAP[iss.severity] || '一般';
      const stat = STATUS_MAP[iss.status] || '已报告';
      sevCount[sev] = (sevCount[sev] || 0) + 1;
      statCount[stat] = (statCount[stat] || 0) + 1;
      const key = `${sev}→${stat}`;
      flow[key] = (flow[key] || 0) + 1;
    });
    const sevList = Object.keys(sevCount);
    const statList = Object.keys(statCount);
    const nodes = [...sevList, ...statList].map(name => ({ name }));
    const links = Object.entries(flow).map(([k, v]) => {
      const [sev, stat] = k.split('→');
      return { source: sevList.indexOf(sev), target: sevList.length + statList.indexOf(stat), value: v };
    });
    console.log('[O3-桑基图] 渲染数据', {
      total: issues.length,
      nodes: nodes.map(n => n.name),
      links: links.map(l => `${nodes[l.source].name}→${nodes[l.target].name}: ${l.value}`),
      sevList, statList,
    });
    return { nodes, links, total: issues.length };
  }, [issues]);

  // O4: 审计日志热力图数据
  const heatData = useMemo(() => {
    const userActions: Record<string, Record<string, number>> = {};
    logs.forEach(log => {
      const user = log.userId || '未知';
      const action = ACTION_MAP[log.action] || log.action;
      if (!userActions[user]) userActions[user] = {};
      userActions[user][action] = (userActions[user][action] || 0) + 1;
    });
    const actions = Array.from(new Set(logs.map(l => ACTION_MAP[l.action] || l.action)));
    const users = Object.keys(userActions).sort((a, b) => {
      const ta = Object.values(userActions[a]).reduce((s, x) => s + x, 0);
      const tb = Object.values(userActions[b]).reduce((s, x) => s + x, 0);
      return tb - ta;
    }).slice(0, 10);
    const data: { user: string; action: string; count: number }[] = [];
    users.forEach(u => {
      actions.forEach(a => {
        data.push({ user: u, action: a, count: userActions[u]?.[a] || 0 });
      });
    });
    return { data, users, actions, total: logs.length };
  }, [logs]);

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';
  const emptyCls = 'text-xs text-slate-400 dark:text-slate-500 text-center py-8';

  const HeatTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text }}>
        <p style={{ fontWeight: 600 }}>{d.user}</p>
        <p>{d.action}: {d.count} 次</p>
      </div>
    );
  };

  // 桑基图节点颜色
  const nodeColor = (node: any) => {
    const colors: Record<string, string> = {
      '一般': '#10B981', '严重': '#F59E0B', '紧急': '#EF4444',
      '已报告': '#94A3B8', '处理中': '#3B82F6', '已解决': '#10B981', '已关闭': '#64748B',
    };
    return colors[node.name] || '#8B5CF6';
  };

  return (
    <div className="space-y-6">
      {/* O3: 问题处理桑基图 */}
      <div className={cardCls}>
        <h3 className={titleCls}>🔄 问题处理流向（严重度 → 状态）</h3>
        {!loading && sankeyData.total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <Sankey
                data={sankeyData}
                nodeWidth={14}
                nodePadding={24}
                linkCurvature={0.5}
              >
                <Tooltip />
              </Sankey>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs">
              {Object.entries({ ...SEVERITY_MAP, ...STATUS_MAP }).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: nodeColor({ name: v }) }} />
                  <span className="text-slate-500 dark:text-slate-400">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
              数据来源：现场问题管理 · 共 {sankeyData.total} 个问题
            </p>
          </>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无问题数据。<br />请在「现场问题管理」中记录问题。'}
          </p>
        )}
      </div>

      {/* O4: 审计日志热力图（散点模拟） */}
      <div className={cardCls}>
        <h3 className={titleCls}>📋 用户操作热力图（用户 × 操作类型）</h3>
        {!loading && heatData.total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  type="category"
                  dataKey="action"
                  name="操作类型"
                  tick={{ fontSize: 11, fill: chartColors.text }}
                  allowDuplicatedCategory={false}
                />
                <YAxis
                  type="category"
                  dataKey="user"
                  name="用户"
                  tick={{ fontSize: 10, fill: chartColors.text }}
                  width={80}
                />
                <ZAxis type="number" dataKey="count" range={[0, 800]} name="次数" />
                <Tooltip content={<HeatTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  data={heatData.data}
                  fill="#3B82F6"
                  shape={(props: any) => {
                    const { cx, cy, count } = props;
                    if (count === 0) return null;
                    const radius = 4 + Math.sqrt(count) * 3;
                    const intensity = Math.min(1, count / 20);
                    return <circle cx={cx} cy={cy} r={radius} fill="#3B82F6" fillOpacity={0.2 + intensity * 0.8} stroke="#3B82F6" strokeWidth={1} />;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
              圆点大小=频次 · 颜色深浅=强度 · 共 {heatData.total} 条日志 · Top{heatData.users.length} 用户
            </p>
          </>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无审计日志。<br />后端服务启动后自动记录操作。'}
          </p>
        )}
      </div>
    </div>
  );
};

export default GlobalOperationCharts;
