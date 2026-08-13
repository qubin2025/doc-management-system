/**
 * 全局看板对比图表 — G2 资料完成率 / G4 风险分布
 *
 * 数据来源：indicatorEngine（completeness/alerts）
 */
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ProjectInfo } from '../../data/projectAggregator';
import { ProjectIndicators } from '../../data/indicatorEngine';

interface Props {
  projects: ProjectInfo[];
  indicators: Map<string, ProjectIndicators>;
  dark?: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const RISK_COLORS = { normal: '#10B981', warning: '#F59E0B', danger: '#EF4444' };

const GlobalComparisonCharts: React.FC<Props> = ({ projects, indicators, dark }) => {
  // G2: 资料档案完成率数据
  const completenessData = useMemo(() => {
    return projects.map(p => {
      const ind = indicators.get(p.name);
      return {
        name: p.name.length > 8 ? p.name.slice(0, 8) + '…' : p.name,
        fullName: p.name,
        完成率: ind?.completeness || 0,
      };
    }).sort((a, b) => b.完成率 - a.完成率);
  }, [projects, indicators]);

  // G4: 风险预警分布数据
  const riskData = useMemo(() => {
    let normal = 0, warning = 0, danger = 0;
    indicators.forEach(ind => {
      const hasDanger = ind.alerts.some(a => a.level === 'danger');
      const hasWarning = ind.alerts.some(a => a.level === 'warning');
      if (hasDanger) danger++;
      else if (hasWarning) warning++;
      else normal++;
    });
    return [
      { name: '正常', value: normal, color: RISK_COLORS.normal },
      { name: '关注', value: warning, color: RISK_COLORS.warning },
      { name: '风险', value: danger, color: RISK_COLORS.danger },
    ];
  }, [indicators]);

  const chartColors = dark
    ? { text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: chartColors.tooltip.text }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name === '完成率' ? '%' : ''}</p>
        ))}
      </div>
    );
  };

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5';
  const titleCls = 'text-sm font-bold text-slate-800 dark:text-slate-200 mb-4';

  return (
    <div className="space-y-6">
      {/* G2: 资料档案完成率 */}
      <div className={cardCls}>
        <h3 className={titleCls}>📁 资料档案完成率</h3>
        {completenessData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, completenessData.length * 40)}>
            <BarChart data={completenessData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: chartColors.text }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="完成率" name="完成率" radius={[0, 4, 4, 0]}>
                {completenessData.map((d, i) => (
                  <Cell key={i} fill={d.完成率 >= 80 ? COLORS[1] : d.完成率 >= 50 ? COLORS[2] : COLORS[3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">暂无项目数据</p>
        )}
      </div>

      {/* G4: 风险预警分布（自定义引出线标签，避免重叠） */}
      <div className={cardCls}>
        <h3 className={titleCls}>⚠️ 项目风险分布</h3>
        {riskData.some(d => d.value > 0) ? (
          (() => {
            // 预计算各扇区标签位置，按左右两侧分组并对过近的标签做垂直错开
            const RADIAN = Math.PI / 180;
            const validData = riskData.filter(d => d.value > 0);
            const dataCount = validData.length;

            // 动态参数：数据点增多时自动收紧间距并增高容器
            const baseGap = 18;
            const minGap = dataCount > 5 ? Math.max(12, Math.floor(120 / dataCount)) : baseGap;
            const labelOffset = dataCount > 5 ? 22 : 18;
            const containerHeight = dataCount > 5 ? 320 : 260;

            console.log('[G4-Label] 输入数据:', { dataCount, validData });

            const positions = validData.map((d, i, arr) => {
              const total = arr.reduce((s, x) => s + x.value, 0);
              const percent = d.value / total;
              let startAngle = 0;
              for (let j = 0; j < i; j++) startAngle += (arr[j].value / total) * 360;
              const midAngle = startAngle + (d.value / total) * 180;
              return { ...d, percent, midAngle, idx: i };
            });

            console.log('[G4-Label] 角度计算:', positions.map(p => ({ name: p.name, midAngle: p.midAngle.toFixed(1), percent: (p.percent * 100).toFixed(0) + '%' })));

            // 计算 cx/cy/outerRadius 对应的标签初始坐标（以容器中心为原点）
            const cx = 50;
            const cy = 50;
            const outerRadius = 38;
            const raw = positions.map(p => {
              const r = outerRadius + labelOffset / 2;
              const x = cx + r * Math.cos(-p.midAngle * RADIAN);
              const y = cy + r * Math.sin(-p.midAngle * RADIAN);
              return { ...p, x, y, side: (x >= cx ? 'right' : 'left') as 'right' | 'left' };
            });

            console.log('[G4-Label] 初始坐标:', raw.map(p => ({ name: p.name, side: p.side, x: p.x.toFixed(1), y: p.y.toFixed(1) })));

            // 对每侧按 y 排序，过近则向下错开
            (['right', 'left'] as const).forEach(side => {
              const group = raw.filter(p => p.side === side).sort((a, b) => a.y - b.y);
              const adjustments: Array<{ name: string; from: number; to: number }> = [];
              for (let k = 1; k < group.length; k++) {
                const originalY = group[k].y;
                if (group[k].y - group[k - 1].y < minGap) {
                  group[k].y = group[k - 1].y + minGap;
                }
                if (Math.abs(group[k].y - originalY) > 0.1) {
                  adjustments.push({ name: group[k].name, from: originalY, to: group[k].y });
                }
              }
              console.log(`[G4-Label] ${side} 侧错开:`, { count: group.length, minGap, adjustments });
            });

            console.log('[G4-Label] 最终坐标:', raw.map(p => ({ name: p.name, side: p.side, x: p.x.toFixed(1), y: p.y.toFixed(1) })));

            // 标签渲染函数（使用预计算位置）
            const renderLabel = (props: any) => {
              const p = raw.find(x => x.idx === props.index);
              if (!p) {
                console.warn('[G4-Label] 未找到索引', props.index);
                return <></>;
              }
              const sin = Math.sin(-p.midAngle * RADIAN);
              const cos = Math.cos(-p.midAngle * RADIAN);
              const sx = cx + outerRadius * cos;
              const sy = cy + outerRadius * sin;
              const mx = cx + (outerRadius + labelOffset / 2) * cos;
              const my = cy + (outerRadius + labelOffset / 2) * sin;
              const ex = p.x;
              const ey = p.y;
              const textAnchor = p.side === 'right' ? 'start' : 'end';
              const textX = ex + (p.side === 'right' ? 2 : -2);

              if (props.index === 0) {
                console.log('[G4-Label] 渲染第1个标签:', { name: p.name, sx, sy, mx, my, ex, ey, textAnchor });
              }

              return (
                <g>
                  <path
                    d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
                    stroke={dark ? '#64748b' : '#94a3b8'}
                    fill="none"
                    strokeWidth={0.8}
                  />
                  <text x={textX} y={ey} fill={chartColors.text} textAnchor={textAnchor} dominantBaseline="central" fontSize={11}>
                    {`${p.name} ${p.value}个 (${(p.percent * 100).toFixed(0)}%)`}
                  </text>
                </g>
              );
            };

            return (
              <ResponsiveContainer width="100%" height={containerHeight}>
                <PieChart>
                  <Pie data={validData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value"
                    label={renderLabel}
                    labelLine={false}
                    isAnimationActive={false}>
                    {validData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            );
          })()
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">暂无风险数据</p>
        )}
      </div>
    </div>
  );
};

export default GlobalComparisonCharts;
