/**
 * 项目高级图表 — O5 CPM关键路径甘特图
 *
 * 数据来源：
 *   - O5: localStorage 中的项目计划数据 → cpmEngine.computeCpm
 */
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { computeCpm, CpmTask, CpmResult } from '../../data/cpmEngine';

interface Props {
  projectName: string;
  dark?: boolean;
}

const STATUS_COLORS = {
  done: '#10B981',       // 已完成（progress=100）
  inProgress: '#3B82F6', // 进行中
  notStart: '#94A3B8',   // 未开始
  critical: '#EF4444',   // 关键路径
};

const ProjectAdvancedCharts: React.FC<Props> = ({ projectName, dark }) => {
  const [tasks, setTasks] = useState<CpmTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      console.log('[O5-CPM] 开始加载', { projectName, timestamp: new Date().toISOString() });
      try {
        // 从 localStorage 读取项目计划数据（GanttChart 组件的数据源）
        const storageKey = `schedule-${projectName}`;
        const saved = localStorage.getItem(storageKey);
        let parsedTasks: CpmTask[] = [];
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (Array.isArray(data)) {
              parsedTasks = data.map((t: any) => ({
                id: t.id || String(t.taskId || ''),
                name: t.name || t.taskName || '',
                duration: Number(t.duration || 0),
                predecessors: Array.isArray(t.predecessors) ? t.predecessors : (t.predecessors ? String(t.predecessors).split(',') : []),
                start: t.start || t.startDate,
                end: t.end || t.endDate,
                progress: t.progress || 0,
              })).filter(t => t.id && t.name);
            }
          } catch (e) {
            console.warn('[O5-CPM] localStorage 解析失败', e);
          }
        }
        console.log('[O5-CPM] localStorage 数据', { key: storageKey, count: parsedTasks.length, sample: parsedTasks.slice(0, 2) });

        // 无 mock 兜底，空数据直接显示空状态（提示用户录入项目计划）
        if (parsedTasks.length === 0) {
          console.info('[O5-CPM] localStorage 为空，请先在"进度管理"中录入项目计划数据');
        }
        if (!cancelled) setTasks(parsedTasks);
      } catch (err: any) {
        console.error('[O5-CPM] 加载异常', err?.message || err);
        if (!cancelled) {
          // 加载失败时保持空数据，不注入 mock
          setTasks([]);
          console.warn('[O5-CPM] 加载异常，已显示空数据');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectName]);

  // 计算 CPM
  const cpmResult: CpmResult | null = useMemo(() => {
    if (tasks.length === 0) return null;
    try {
      const result = computeCpm(tasks);
      console.log('[O5-CPM] 计算结果', {
        totalTasks: result.tasks.length,
        criticalPath: result.criticalPath,
        totalDuration: result.totalDuration,
        criticalTasks: result.tasks.filter(t => t.critical).map(t => `${t.id}:${t.name}`),
        floatDistribution: {
          zero: result.tasks.filter(t => t.float === 0).length,
          '1-5d': result.tasks.filter(t => t.float > 0 && t.float <= 5).length,
          '>5d': result.tasks.filter(t => t.float > 5).length,
        },
      });
      return result;
    } catch (err: any) {
      console.error('[O5-CPM] 计算失败', err?.message || err);
      return null;
    }
  }, [tasks]);

  // 甘特图数据：每个任务一行，按 ES 起始，duration 占宽
  const ganttData = useMemo(() => {
    if (!cpmResult) return [];
    const sorted = [...cpmResult.tasks].sort((a, b) => a.es - b.es);
    const data = sorted.map(t => ({
      name: t.name.length > 8 ? t.name.slice(0, 8) + '…' : t.name,
      fullName: t.name,
      id: t.id,
      es: t.es,           // 最早开始（左偏移）
      duration: t.duration,
      ef: t.ef,
      float: t.float,
      critical: t.critical,
      progress: t.progress || 0,
      // 用于堆叠：[空白偏移, 已完成部分, 未完成部分]
      offset: t.es,
      done: t.duration * (t.progress || 0) / 100,
      remaining: t.duration * (1 - (t.progress || 0) / 100),
    }));
    console.log('[O5-CPM] 甘特图渲染数据', {
      tasks: data.length,
      criticalCount: data.filter(d => d.critical).length,
      dateRange: `第${Math.min(...data.map(d => d.es))}天 ~ 第${Math.max(...data.map(d => d.ef))}天`,
    });
    return data;
  }, [cpmResult]);

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';
  const emptyCls = 'text-xs text-slate-400 dark:text-slate-500 text-center py-8';

  const GanttTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text, maxWidth: 280 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.fullName}</p>
        <p>工期: {d.duration}天 · 进度: {d.progress}%</p>
        <p>最早开始: 第{d.es}天 · 最早完成: 第{d.ef}天</p>
        <p>总浮时: {d.float}天 {d.critical ? '· ⚠️ 关键路径' : ''}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <h3 className={titleCls}>🛤️ 关键路径甘特图（CPM）</h3>
        {!loading && ganttData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={Math.max(280, ganttData.length * 32 + 60)}>
              <BarChart
                data={ganttData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 20 }}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: chartColors.text }}
                  label={{ value: '项目第N天', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: chartColors.text } }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: chartColors.text }}
                  width={80}
                />
                <Tooltip content={<GanttTooltip />} cursor={{ fill: dark ? '#33415533' : '#e2e8f033' }} />
                {/* 偏移空白 */}
                <Bar dataKey="offset" stackId="a" fill="transparent" />
                {/* 已完成 */}
                <Bar dataKey="done" stackId="a" radius={[3, 0, 0, 3]}>
                  {ganttData.map((d, i) => (
                    <Cell key={i} fill={d.critical ? '#7F1D1D' : STATUS_COLORS.done} fillOpacity={d.critical ? 0.9 : 0.7} />
                  ))}
                </Bar>
                {/* 未完成 */}
                <Bar dataKey="remaining" stackId="a" radius={[0, 3, 3, 0]}>
                  {ganttData.map((d, i) => (
                    <Cell key={i} fill={d.critical ? STATUS_COLORS.critical : (d.progress > 0 ? STATUS_COLORS.inProgress : STATUS_COLORS.notStart)} fillOpacity={0.5} />
                  ))}
                </Bar>
                {cpmResult && (
                  <ReferenceLine x={cpmResult.totalDuration} stroke={STATUS_COLORS.critical} strokeDasharray="4 4" label={{ value: `总工期:${cpmResult.totalDuration}天`, position: 'top', style: { fontSize: 10, fill: STATUS_COLORS.critical } }} />
                )}
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-center gap-4 mt-3 text-xs flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.critical }} />
                <span className="text-slate-500 dark:text-slate-400">关键路径</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.done }} />
                <span className="text-slate-500 dark:text-slate-400">已完成</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.inProgress }} />
                <span className="text-slate-500 dark:text-slate-400">进行中</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.notStart }} />
                <span className="text-slate-500 dark:text-slate-400">未开始</span>
              </div>
            </div>

            {cpmResult && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded text-xs text-slate-600 dark:text-slate-400">
                <p className="font-semibold mb-1">关键路径（共 {cpmResult.criticalPath.length} 个任务）：</p>
                <p>{cpmResult.tasks.filter(t => t.critical).map(t => t.name).join(' → ')}</p>
                <p className="mt-1">总工期: <span className="font-semibold text-red-500">{cpmResult.totalDuration}天</span> · 关键路径无浮时，延期将直接影响项目交付</p>
              </div>
            )}
          </>
        ) : (
          <p className={emptyCls}>
            {loading ? '加载中...' : '暂无计划数据。<br />请在「进度管理」中录入任务计划。'}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProjectAdvancedCharts;
