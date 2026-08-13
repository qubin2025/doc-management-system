/**
 * 项目看板深度图表 — P3 计划vs实际 / P4 质量检查 / AI-P1 Agent推理 / AI-P4 价值雷达
 */
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadialBarChart, RadialBar } from 'recharts';
import { aiUsageTracker } from '../../data/aiUsageTracker';

interface Props { projectName: string; }

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const ProjectDeepCharts: React.FC<Props> = ({ projectName }) => {
  // P3: 计划vs实际进度（各章节散点图）
  const progressData = useMemo(() => {
    const chapters = ['ch1', 'ch2', 'ch3', 'ch4'];
    const data: { x: number; y: number; z: number; name: string }[] = [];
    chapters.forEach((ch, idx) => {
      try {
        const prefix = `guide-${projectName}-chapter-`;
        const done = new Set(JSON.parse(localStorage.getItem(`${prefix}${ch}-done`) || '[]'));
        const modules = JSON.parse(localStorage.getItem(`${prefix}${ch}-modules`) || '[]');
        let total = 0, completed = 0;
        if (Array.isArray(modules)) {
          modules.forEach((sm: any) => sm.workItems?.forEach(() => {
            total++;
          }));
          modules.forEach((sm: any) => sm.workItems?.forEach((wi: any) => {
            if (done.has(wi.id)) completed++;
          }));
        }
        const planRate = 75 + idx * 5; // 计划进度基准
        const actualRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        data.push({ x: planRate, y: actualRate, z: total, name: `第${idx + 1}章` });
      } catch {}
    });
    return data;
  }, [projectName]);

  // P4: 质量检查点达成率
  const qualityData = useMemo(() => {
    let planned = 0, actual = 0;
    const prefix = `guide-${projectName}-chapter-`;
    for (const ch of ['ch1', 'ch2', 'ch3', 'ch4']) {
      try {
        const done = new Set(JSON.parse(localStorage.getItem(`${prefix}${ch}-done`) || '[]'));
        const modules = JSON.parse(localStorage.getItem(`${prefix}${ch}-modules`) || '[]');
        if (Array.isArray(modules)) {
          modules.forEach((sm: any) => sm.workItems?.forEach((wi: any) => {
            if (wi.name && (wi.name.includes('质量') || wi.name.includes('检查') || wi.name.includes('验收'))) {
              planned++;
              if (done.has(wi.id)) actual++;
            }
          }));
        }
      } catch {}
    }
    const rate = planned > 0 ? Math.round((actual / planned) * 100) : 0;
    return [{ name: '达成率', value: rate, fill: rate >= 80 ? COLORS[1] : rate >= 50 ? COLORS[2] : COLORS[3] }];
  }, [projectName]);

  // AI-P4: 价值雷达（5维度）
  const valueRadarData = useMemo(() => {
    const stats = aiUsageTracker.getStats(projectName);
    const byType = aiUsageTracker.getByServiceType(projectName);
    return [
      { metric: '审查效率', value: Math.min(100, byType.review * 10) },
      { metric: '生成质量', value: Math.min(100, stats.successRate) },
      { metric: '填表自动化', value: Math.min(100, byType.skill * 8) },
      { metric: '知识覆盖', value: Math.min(100, byType.rag * 15) },
      { metric: '响应速度', value: Math.min(100, Math.max(0, 100 - stats.avgDuration / 100)) },
    ];
  }, [projectName]);

  // AI-P1: Agent 推理步骤（从 localStorage 获取最近任务）
  const agentSteps = useMemo(() => {
    try {
      const key = `agent-task-${projectName}`;
      const task = JSON.parse(localStorage.getItem(key) || 'null');
      return task?.steps || [];
    } catch { return []; }
  }, [projectName]);

  const chartColors = { text: '#64748b', grid: '#e2e8f0' };
  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';
  const emptyCls = 'text-xs text-slate-400 dark:text-slate-500 text-center py-8';

  return (
    <div className="space-y-6">
      {/* P3 + P4 并排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={cardCls}>
          <h3 className={titleCls}>📈 计划 vs 实际进度</h3>
          {progressData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis type="number" dataKey="x" name="计划%" domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis type="number" dataKey="y" name="实际%" domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} />
                <ZAxis type="number" dataKey="z" range={[40, 200]} name="工作项数" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={progressData} fill={COLORS[0]} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : <p className={emptyCls}>暂无进度数据</p>}
        </div>

        <div className={cardCls}>
          <h3 className={titleCls}>✅ 质量检查达成率</h3>
          {qualityData[0].value > 0 || qualityData[0].value === 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart innerRadius="40%" outerRadius="90%" data={qualityData} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="value" cornerRadius={8} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={chartColors.text} fontSize="20" fontWeight="bold">
                  {qualityData[0].value}%
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          ) : <p className={emptyCls}>暂无质量检查数据</p>}
        </div>
      </div>

      {/* AI-P4: 价值雷达 */}
      <div className={cardCls}>
        <h3 className={titleCls}>🤖 AI 价值贡献雷达</h3>
        {valueRadarData.some(d => d.value > 0) ? (
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={valueRadarData}>
              <PolarGrid stroke={chartColors.grid} />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: chartColors.text }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} />
              <Radar dataKey="value" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.3} strokeWidth={2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <p className={emptyCls}>AI 价值待激活。<br />使用 AI 功能后自动生成贡献分析。</p>
        )}
      </div>

      {/* AI-P1: Agent 推理步骤 */}
      <div className={cardCls}>
        <h3 className={titleCls}>🧠 Agent 推理过程</h3>
        {agentSteps.length > 0 ? (
          <div className="space-y-2">
            {agentSteps.map((step: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <span className="shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-300">{step.thought}</p>
                  {step.actionName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      → {step.actionName} {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '⏳'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={emptyCls}>Agent 推理记录为空。<br />使用 Agent 控制台执行任务后自动记录。</p>
        )}
      </div>
    </div>
  );
};

export default ProjectDeepCharts;
