/**
 * 项目运营图表 — O1 人员投入堆叠柱状图 / O2 目标WBS矩形树图
 *
 * 数据来源：
 *   - O1: fetchDailyReports (daily_workers)
 *   - O2: fetchObjectives (objectives WBS)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Treemap } from 'recharts';
import { fetchDailyReports, fetchObjectives, DesktopDailyReport } from '../../data/api';

interface Props {
  projectName: string;
  dark?: boolean;
}

const COLORS = { 主体: '#3B82F6', 劳务: '#10B981', 专业: '#F59E0B', 特种: '#EF4444' };
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', 'in-progress': '#3B82F6', 'not-started': '#94A3B8',
};
const STATUS_LABELS: Record<string, string> = {
  completed: '已完成', 'in-progress': '进行中', 'not-started': '未开始',
};

interface ObjectiveNode {
  id: string; title: string; level: string; parentId: string | null;
  progress: number; status: string; weight: number;
  children?: ObjectiveNode[];
}

const ProjectOperationCharts: React.FC<Props> = ({ projectName, dark }) => {
  const [reports, setReports] = useState<DesktopDailyReport[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      console.log('[O1-人员投入] 开始加载', { projectName, timestamp: new Date().toISOString() });
      try {
        const [r, o] = await Promise.all([
          fetchDailyReports(projectName),
          fetchObjectives(projectName).catch((e) => {
            console.warn('[O2-目标WBS] fetchObjectives 失败', e?.message || e);
            return [];
          }),
        ]);
        if (cancelled) return;

        // ===== O1: 日报数据（无 mock 兜底，空数据直接显示空状态） =====
        const realReports = Array.isArray(r) ? r : [];
        console.log('[O1-人员投入] API 返回', { count: realReports.length, sample: realReports.slice(0, 2) });
        const finalReports = realReports;
        // 数据完整性校验
        const validReports = finalReports.filter(r => r && r.reportDate);
        const invalidCount = finalReports.length - validReports.length;
        if (invalidCount > 0) {
          console.warn('[O1-人员投入] 过滤无效数据', { invalid: invalidCount, kept: validReports.length });
        }
        // 工人数量校验
        const workerStats = validReports.reduce((acc, r) => {
          acc.total主体 += r.workersMain || 0;
          acc.total劳务 += r.workersLabor || 0;
          acc.total专业 += r.workersSpecialty || 0;
          acc.total特种 += r.workersSpecial || 0;
          acc.zeroWorkerDays += (r.workersMain + r.workersLabor + r.workersSpecialty + r.workersSpecial) === 0 ? 1 : 0;
          return acc;
        }, { total主体: 0, total劳务: 0, total专业: 0, total特种: 0, zeroWorkerDays: 0 });
        console.log('[O1-人员投入] 数据统计', {
          days: validReports.length,
          ...workerStats,
          avg主体: validReports.length ? Math.round(workerStats.total主体 / validReports.length) : 0,
          avg劳务: validReports.length ? Math.round(workerStats.total劳务 / validReports.length) : 0,
        });
        setReports(validReports);

        // ===== O2: 目标数据（无 mock 兜底，空数据直接显示空状态） =====
        const realObjectives = Array.isArray(o) ? (o as ObjectiveNode[]) : [];
        console.log('[O2-目标WBS] API 返回', { count: realObjectives.length, levels: realObjectives.reduce((acc, x) => { acc[x.level] = (acc[x.level] || 0) + 1; return acc; }, {} as Record<string, number>) });
        setObjectives(realObjectives);
      } catch (err: any) {
        console.error('[O1/O2] 加载异常', err?.message || err);
        if (!cancelled) {
          // 加载失败时保持空数据，不注入 mock
          setReports([]);
          setObjectives([]);
          console.warn('[O1/O2] 加载异常，已显示空数据');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectName]);

  // O1: 人员投入堆叠柱状图
  const workerData = useMemo(() => {
    const sorted = reports
      .filter(r => !r.deleted)
      .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    const sliced = sorted.slice(-14);
    const mapped = sliced.map(r => ({
      date: r.reportDate.slice(5),
      主体: r.workersMain || 0,
      劳务: r.workersLabor || 0,
      专业: r.workersSpecialty || 0,
      特种: r.workersSpecial || 0,
    }));
    if (mapped.length > 0) {
      console.log('[O1-人员投入] 渲染数据', {
        totalDays: sorted.length,
        renderedDays: mapped.length,
        dateRange: `${mapped[0]?.date} ~ ${mapped[mapped.length - 1]?.date}`,
        maxTotal: Math.max(...mapped.map(d => d.主体 + d.劳务 + d.专业 + d.特种)),
        minTotal: Math.min(...mapped.map(d => d.主体 + d.劳务 + d.专业 + d.特种)),
      });
    }
    return mapped;
  }, [reports]);

  // O2: 目标WBS → Treemap 嵌套结构
  const treeData = useMemo(() => {
    if (objectives.length === 0) return null;
    const nodeMap = new Map<string, ObjectiveNode & { children: any[] }>();
    objectives.forEach(o => {
      nodeMap.set(o.id, { ...o, children: [] });
    });
    let root: any = null;
    nodeMap.forEach(node => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else if (!node.parentId || node.level === 'root') {
        if (!root) root = node;
        else {
          if (!root.children) root.children = [];
          root.children.push(node);
        }
      }
    });
    if (!root && objectives.length > 0) {
      root = { title: projectName, children: Array.from(nodeMap.values()) };
    }
    if (!root) return null;

    // 递归转换为 Treemap 格式
    const convert = (node: any): any => {
      if (!node.children || node.children.length === 0) {
        return {
          name: node.title?.length > 8 ? node.title.slice(0, 8) + '…' : node.title || '未命名',
          size: Math.max(1, node.weight || 1),
          status: node.status || 'not-started',
          progress: node.progress || 0,
          fullName: node.title,
        };
      }
      return {
        name: node.title?.length > 6 ? node.title.slice(0, 6) + '…' : node.title || projectName,
        children: node.children.map(convert),
      };
    };
    return convert(root);
  }, [objectives, projectName]);

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';
  const emptyCls = 'text-xs text-slate-400 dark:text-slate-500 text-center py-8';

  const WorkerTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}人</p>
        ))}
        <p style={{ marginTop: 4, borderTop: `1px solid ${chartColors.tooltip.border}`, paddingTop: 4, fontWeight: 600 }}>合计: {total}人</p>
      </div>
    );
  };

  const TreemapContent = (props: any) => {
    const { x, y, width, height, name, status, progress } = props;
    if (width < 30 || height < 20) return null;
    const fill = STATUS_COLORS[status] || '#94A3B8';
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.7} stroke={dark ? '#1e293b' : '#fff'} strokeWidth={2} />
        <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={Math.min(13, width / 6)} fontWeight={600}>
          {name}
        </text>
        {height > 40 && (
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#fff" fontSize={11}>
            {STATUS_LABELS[status] || status} · {Math.round(progress || 0)}%
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* O1: 人员投入堆叠柱状图 */}
      <div className={cardCls}>
        <h3 className={titleCls}>👷 人员投入趋势（近14天）</h3>
        {!loading && workerData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={workerData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartColors.text }} />
              <YAxis tick={{ fontSize: 10, fill: chartColors.text }} />
              <Tooltip content={<WorkerTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="主体" stackId="a" fill={COLORS.主体} />
              <Bar dataKey="劳务" stackId="a" fill={COLORS.劳务} />
              <Bar dataKey="专业" stackId="a" fill={COLORS.专业} />
              <Bar dataKey="特种" stackId="a" fill={COLORS.特种} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无日报数据。<br />请在「项目日报」中填报每日人员投入。'}
          </p>
        )}
      </div>

      {/* O2: 目标WBS矩形树图 */}
      <div className={cardCls}>
        <h3 className={titleCls}>🎯 目标WBS达成全景</h3>
        {!loading && treeData ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <Treemap
                data={[treeData]}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke={dark ? '#1e293b' : '#fff'}
                content={<TreemapContent />}
                isAnimationActive={false}
              />
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS[k] }} />
                  <span className="text-slate-500 dark:text-slate-400">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
              矩形大小=权重 · 颜色=状态 · 数据来源：目标管理WBS
            </p>
          </>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无目标数据。<br />请在「目标管理」中创建项目目标WBS。'}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProjectOperationCharts;
