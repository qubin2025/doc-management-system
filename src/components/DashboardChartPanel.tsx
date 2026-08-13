// Dashboard 图表分析面板 — 基于 Recharts 的 4 类图表
import React, { useMemo } from 'react';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { DesktopDailyReport } from '../data/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const DARK_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'];

interface Props {
  reports: DesktopDailyReport[];
  dark?: boolean;
}

const DashboardChartPanel: React.FC<Props> = ({ reports, dark }) => {
  const palette = dark ? DARK_COLORS : COLORS;

  // 1. 施工资源投入趋势数据
  const resourceData = useMemo(() => {
    return reports.slice(0, 14).reverse().map(r => ({
      date: (r.reportDate || '').slice(5),
      workers: r.workersTotal || 0,
      machines: r.machineryTotal || 0,
      materials: (r.materials || []).length,
      managersMain: (r.managersMain || 0) + (r.managersLabor || 0) + (r.managersSpecialty || 0),
      managersSubcon: (r.tasks || []).reduce((sum: number, t: any) => sum + (t.contractor ? 1 : 0), 0),
    }));
  }, [reports]);

  // 2. 分包单位进度对比 — 从 tasks 中提取 contractor
  const contractorData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    reports.forEach(r => {
      const tasks = r.tasks || [];
      tasks.forEach(t => {
        if (t.contractor) {
          const name = t.contractor.slice(0, 12);
          if (!map[name]) map[name] = { total: 0, count: 0 };
          map[name].total += r.machineryTotal + (t.workers || 0);
          map[name].count += 1;
        }
      });
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, value: Math.round(d.total / Math.max(d.count, 1)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [reports]);

  // 3. 施工区域分布 — 从 tasks 中提取 area
  const areaData = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach(r => {
      const tasks = r.tasks || [];
      tasks.forEach(t => {
        if (t.area) {
          map[t.area] = (map[t.area] || 0) + 1;
        }
      });
      if (tasks.length === 0) {
        map['其他'] = (map['其他'] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [reports]);

  // 4. 安全/问题影响分析
  const issueData = useMemo(() => {
    return reports
      .filter(r => r.issues && r.issues.length > 0)
      .map(r => ({
        x: r.issues.reduce((sum, iss) => sum + (iss.problem || '').length, 0),
        y: r.workersTotal || 1,
        z: r.machineryTotal || 1,
        name: (r.reportDate || '').slice(5),
      }));
  }, [reports]);

  const chartColors = dark
    ? { bg: 'transparent', text: '#94a3b8', grid: '#334155', tooltip: { bg: '#1e293b', border: '#334155', text: '#e2e8f0' } }
    : { bg: 'transparent', text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

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

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
        暂无日报数据。请先在手机端提交项目日报，数据将自动同步到此处分析。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 图1: 施工资源投入趋势 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">施工资源投入趋势</h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
          分包活跃指数 = 该单位(机械总数 + 任务工人数) / 日报天数
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={resourceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.text }} />
            <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="materials" name="材料进场" fill={palette[2]} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="workers" name="工人数" stroke={palette[0]} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="machines" name="机械台数" stroke={palette[1]} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="managersMain" name="管理人员" stroke={palette[4]} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="managersSubcon" name="分包管理(估)" stroke={palette[5]} strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 图2 + 图3 并排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 图2: 分包进度对比 */}
        {contractorData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">📋 分包单位活跃度</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contractorData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: chartColors.text }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="活跃指数" radius={[0, 4, 4, 0]}>
                  {contractorData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 图3: 施工区域分布 */}
        {areaData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">🏗️ 施工区域分布</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={areaData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                  {areaData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 图4: 安全问题影响分析 */}
      {issueData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">⚠️ 安全问题分布</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis type="number" dataKey="x" name="安全提及字数" tick={{ fontSize: 10, fill: chartColors.text }} />
              <YAxis type="number" dataKey="y" name="当日工人数" tick={{ fontSize: 10, fill: chartColors.text }} />
              <ZAxis type="number" dataKey="z" range={[40, 200]} name="机械规模" />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={issueData} fill={palette[3]}>
                {issueData.map((_, i) => <Cell key={i} fill={palette[3]} opacity={0.7} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DashboardChartPanel;
