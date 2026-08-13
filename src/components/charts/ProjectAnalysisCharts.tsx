/**
 * 项目看板分析图表 — P1 资金执行 / P2 资料归档 / AI-P2 审查成果
 *
 * 数据来源：financeMetrics + localStorage(doc-mgmt-upload/review-result)
 */
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getProjectFinance } from '../../data/financeMetrics';

interface Props {
  projectName: string;
  dark?: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const CATEGORY_LABELS: Record<string, string> = { A: 'A类决策', B: 'B类监理', C: 'C类施工', D: 'D类竣工' };

const ProjectAnalysisCharts: React.FC<Props> = ({ projectName }) => {
  // P1: 资金执行对比
  const financeData = useMemo(() => {
    const f = getProjectFinance(projectName);
    return [
      { name: '概算', 金额: f.approvedBudget, 颜色: COLORS[0] },
      { name: '合同', 金额: f.contractAmount, 颜色: COLORS[1] },
      { name: '产值', 金额: f.outputValue, 颜色: COLORS[2] },
      { name: '结算', 金额: f.expectedSettlement, 颜色: COLORS[3] },
    ];
  }, [projectName]);

  // P2: 资料归档进度（按类别）
  const archiveData = useMemo(() => {
    const result: { name: string; 已上传: number; 待上传: number }[] = [];
    try {
      const uploads = JSON.parse(localStorage.getItem('doc-mgmt-upload-DB11/T695-2025') || '{}');
      const projectUploads = uploads[projectName] || {};
      const categories = ['A', 'B', 'C', 'D'];
      categories.forEach(cat => {
        let uploaded = 0;
        let total = 100; // 附录A每类约100项
        Object.entries(projectUploads).forEach(([key, val]: [string, any]) => {
          if (key.startsWith(cat) && Array.isArray(val) && val.length > 0) uploaded++;
        });
        result.push({ name: CATEGORY_LABELS[cat], 已上传: uploaded, 待上传: Math.max(0, total - uploaded) });
      });
    } catch {}
    return result;
  }, [projectName]);

  // AI-P2: AI 审查成果
  const reviewData = useMemo(() => {
    const result: { name: string; 通过: number; 问题: number; 警告: number }[] = [];
    const reviewTypes = [
      { key: 'construction-review', name: '施工审查' },
      { key: 'contract-review', name: '合同审查' },
      { key: 'bid-review', name: '招投标审查' },
    ];
    reviewTypes.forEach(rt => {
      let passed = 0, issues = 0, warnings = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`review-result-`) && key.includes(rt.key)) {
          try {
            const r = JSON.parse(localStorage.getItem(key) || '{}');
            if (r.score >= 80) passed++;
            else if (r.score >= 60) warnings++;
            else issues++;
          } catch {}
        }
      }
      result.push({ name: rt.name, 通过: passed, 问题: issues, 警告: warnings });
    });
    return result;
  }, [projectName]);

  const chartColors = { text: '#64748b', grid: '#e2e8f0', tooltip: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b' } };

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
  const emptyCls = 'text-xs text-slate-400 dark:text-slate-500 text-center py-8';

  return (
    <div className="space-y-6">
      {/* P1: 资金执行对比 */}
      <div className={cardCls}>
        <h3 className={titleCls}>💰 资金执行对比（万元）</h3>
        {financeData.some(d => d.金额 > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={financeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="金额" radius={[4, 4, 0, 0]}>
                {financeData.map((d, i) => <rect key={i} fill={d.颜色} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className={emptyCls}>暂无资金数据。请录入投资概算和造价数据。</p>
        )}
      </div>

      {/* P2 + AI-P2 并排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* P2: 资料归档进度 */}
        <div className={cardCls}>
          <h3 className={titleCls}>📁 资料归档进度</h3>
          {archiveData.some(d => d.已上传 > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={archiveData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis tick={{ fontSize: 10, fill: chartColors.text }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="已上传" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="待上传" stackId="a" fill={COLORS[3]} fillOpacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className={emptyCls}>暂无归档数据。上传资料后自动统计。</p>
          )}
        </div>

        {/* AI-P2: 审查成果 */}
        <div className={cardCls}>
          <h3 className={titleCls}>🔍 AI 审查成果</h3>
          {reviewData.some(d => d.通过 + d.问题 + d.警告 > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={reviewData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis tick={{ fontSize: 10, fill: chartColors.text }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="通过" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="警告" stackId="a" fill={COLORS[2]} />
                <Bar dataKey="问题" stackId="a" fill={COLORS[3]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className={emptyCls}>AI 审查能力已就绪。<br />使用审查功能后自动生成分析。</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectAnalysisCharts;
