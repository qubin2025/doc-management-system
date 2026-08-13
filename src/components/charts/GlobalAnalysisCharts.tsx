/**
 * 全局看板分析图表 — G1 投资对比 / G3 进度雷达
 *
 * 数据来源：financeMetrics + indicatorEngine
 */
import React, { useMemo, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ProjectInfo } from '../../data/projectAggregator';
import { ProjectIndicators } from '../../data/indicatorEngine';
import { getAllProjectsFinance } from '../../data/financeMetrics';

interface Props {
  projects: ProjectInfo[];
  indicators: Map<string, ProjectIndicators>;
  dark?: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const GlobalAnalysisCharts: React.FC<Props> = ({ projects, indicators, dark }) => {
  // G1: 投资对比数据
  const financeData = useMemo(() => {
    return getAllProjectsFinance().map(f => ({
      name: f.projectName.length > 8 ? f.projectName.slice(0, 8) + '…' : f.projectName,
      概算: f.approvedBudget,
      合同: f.contractAmount,
      产值: f.outputValue,
      结算: f.expectedSettlement,
    }));
  }, [projects]);

  // G3: 进度雷达 — 可见项目控制（点击图例切换显隐）
  const [visibleProjects, setVisibleProjects] = useState<Set<string>>(new Set());

  const radarProjects = useMemo(() => projects.slice(0, 5), [projects]);

  React.useEffect(() => {
    setVisibleProjects(new Set(radarProjects.map(p => p.name)));
  }, [radarProjects.map(p => p.name).join(',')]);

  const toggleProject = useCallback((name: string) => {
    setVisibleProjects(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // G3: 进度雷达数据（含数值分离度，避免重叠）
  const radarData = useMemo(() => {
    const metrics = ['CPI', 'SPI', '完整度', '质量'];
    return metrics.map((metric, metricIdx) => {
      const point: Record<string, number | string> = { metric };
      radarProjects.forEach((p, pIdx) => {
        const ind = indicators.get(p.name);
        if (!ind) return;
        const shortName = p.name.length > 6 ? p.name.slice(0, 6) + '…' : p.name;
        let raw = 0;
        if (metric === 'CPI') raw = Math.min(100, Math.round(ind.cpi * 100));
        else if (metric === 'SPI') raw = Math.min(100, Math.round(ind.spi * 100));
        else if (metric === '完整度') raw = ind.completeness;
        else if (metric === '质量') raw = ind.qualityScore;
        const jitter = (pIdx - 2) * 3 + (metricIdx % 2 === 0 ? 1 : -1) * 2;
        point[shortName] = Math.max(0, Math.min(100, raw + jitter));
      });
      return point;
    });
  }, [radarProjects, indicators]);

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name === '完成率' ? '%' : '万'}</p>
        ))}
      </div>
    );
  };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';

  return (
    <div className="space-y-6">
      {/* G1: 投资对比 */}
      <div className={cardCls}>
        <h3 className={titleCls}>💰 项目投资对比（万元）</h3>
        {financeData.some(d => d.概算 > 0 || d.合同 > 0) ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={financeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="概算" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="合同" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="产值" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="结算" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
            暂无投资数据。<br />请在项目概况中录入投资额，在造价管理中录入合同数据。
          </p>
        )}
      </div>

      {/* G3: 进度雷达 */}
      <div className={cardCls}>
        <h3 className={titleCls}>🎯 项目进度雷达</h3>
        {radarProjects.length > 0 && indicators.size > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={chartColors.grid} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: chartColors.text }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} />
                {radarProjects.map((p, i) => {
                  const shortName = p.name.length > 6 ? p.name.slice(0, 6) + '…' : p.name;
                  const visible = visibleProjects.has(p.name);
                  return (
                    <Radar
                      key={p.name}
                      name={shortName}
                      dataKey={shortName}
                      stroke={COLORS[i % COLORS.length]}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={visible ? 0.35 : 0}
                      strokeWidth={visible ? 2 : 0.5}
                      strokeOpacity={visible ? 1 : 0.2}
                    />
                  );
                })}
                <Legend
                  wrapperStyle={{ fontSize: 10, cursor: 'pointer' }}
                  onClick={(e: any) => {
                    const fullName = radarProjects.find(p =>
                      (p.name.length > 6 ? p.name.slice(0, 6) + '…' : p.name) === e.value
                    )?.name || e.value;
                    toggleProject(fullName);
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">点击图例可切换项目显隐</p>
          </>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">暂无项目数据</p>
        )}
      </div>
    </div>
  );
};

export default GlobalAnalysisCharts;
