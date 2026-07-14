import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2, Clock, FileText, ShieldCheck, Zap } from 'lucide-react';
import { computeIndicators, ProjectIndicators, getAllProjectIndicators } from '../data/indicatorEngine';

interface Props { projectName: string; onBack: () => void; onNavigate?: (view: string) => void; }

const gaugeColor = (v: number, thresholds: [number, number] = [0.6, 0.85]): string =>
  v >= thresholds[1] ? 'text-green-500' : v >= thresholds[0] ? 'text-amber-500' : 'text-red-500';

const barColor = (v: number): string =>
  v >= 80 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500';

const Dashboard: React.FC<Props> = ({ projectName, onBack, onNavigate }) => {
  const alertNavMap: Record<string, string> = { cost: 'baseline', schedule: 'plan-manager', completeness: 'standard-select', quality: 'construction-review' };
  const [indicators, setIndicators] = useState<ProjectIndicators | null>(null);
  const [allIndicators, setAllIndicators] = useState<ProjectIndicators[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setIndicators(computeIndicators(projectName));
    setAllIndicators(getAllProjectIndicators());
  }, [projectName, refreshKey]);

  const alertCount = indicators?.alerts.filter(a => a.level === 'danger').length || 0;
  const warnCount = indicators?.alerts.filter(a => a.level === 'warning').length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center"><span className="text-white font-black text-[10px]">ZHJK</span></div>
            <h1 className="text-lg font-bold text-gray-800">项目仪表盘</h1>
            <span className="text-sm text-gray-400 ml-2">{projectName}</span>
          </div>
          <button onClick={() => setRefreshKey(k => k + 1)}
            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">刷新</button>
          {onNavigate && (
            <button onClick={() => onNavigate('workflow')}
              className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 flex items-center gap-1">
              <Zap size={12} /> 工作流
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 指标卡片行 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: '成本绩效 CPI', value: indicators?.cpi ?? 0, unit: '', icon: <TrendingUp className="w-5 h-5" />, desc: '≤1.0正常', thresholds: [0.9, 1.0] as [number, number], reverse: true },
            { label: '进度绩效 SPI', value: indicators?.spi ?? 0, unit: '', icon: <CheckCircle2 className="w-5 h-5" />, desc: '完成/总计', thresholds: [0.5, 0.8] as [number, number] },
            { label: '资料完整度', value: (indicators?.completeness ?? 0), unit: '%', icon: <FileText className="w-5 h-5" />, desc: '上传/基准', thresholds: [30, 60] as [number, number] },
            { label: '审核均分', value: indicators?.qualityScore ?? 0, unit: '', icon: <ShieldCheck className="w-5 h-5" />, desc: '综合质量', thresholds: [60, 75] as [number, number] },
          ].map((card) => {
            const color = card.reverse
              ? (card.value > 1.05 ? 'text-red-500' : card.value > 0.95 ? 'text-amber-500' : 'text-green-500')
              : gaugeColor(card.value, card.thresholds);
            const bg = card.reverse
              ? (card.value > 1.05 ? 'bg-red-50 border-red-200' : card.value > 0.95 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200')
              : gaugeColor(card.value, card.thresholds) === 'text-green-500' ? 'bg-green-50 border-green-200'
                : gaugeColor(card.value, card.thresholds) === 'text-amber-500' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
            return (
              <div key={card.label} className={`rounded-xl p-5 border ${bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{card.label}</span>
                  <span className={color}>{card.icon}</span>
                </div>
                <div className={`text-3xl font-black ${color}`}>
                  {card.value}{card.unit}
                </div>
                <div className="text-xs text-gray-400 mt-2">{card.desc}</div>
              </div>
            );
          })}
        </div>

        {/* 预警 + 进度条 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 异常预警 */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />异常预警
              {alertCount > 0 && <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">{alertCount}严重</span>}
              {warnCount > 0 && <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-600 rounded-full">{warnCount}提示</span>}
            </h3>
            {indicators?.alerts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">✅ 所有指标正常</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {indicators?.alerts.map((a, i) => (
                  <button key={i} onClick={() => onNavigate?.(alertNavMap[a.type] || 'homepage')}
                    className={`w-full text-left flex items-start gap-2 p-2.5 rounded-lg text-xs transition hover:shadow-sm cursor-pointer ${
                    a.level === 'danger' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}>
                    {a.level === 'danger' ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>{a.message} → 点击查看</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 进度条面板 */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">关键指标进度</h3>
            {[
              { label: 'CPI', value: Math.min(100, ((indicators?.cpi ?? 0) * 80)), color: (indicators?.cpi ?? 0) > 1.05 ? 'bg-red-500' : (indicators?.cpi ?? 0) > 0.95 ? 'bg-amber-500' : 'bg-green-500' },
              { label: 'SPI', value: (indicators?.spi ?? 0) * 100, color: barColor((indicators?.spi ?? 0) * 100) },
              { label: '完整度', value: indicators?.completeness ?? 0, color: barColor(indicators?.completeness ?? 0) },
              { label: '质量分', value: indicators?.qualityScore ?? 0, color: barColor(indicators?.qualityScore ?? 0) },
            ].map(item => (
              <div key={item.label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{item.label}</span>
                  <span className="font-bold">{item.value}{item.label === 'CPI' ? '%' : item.label === 'SPI' ? '%' : item.label === '完整度' ? '%' : ''}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all ${item.color}`} style={{ width: `${Math.min(100, item.value)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 多项目对比 */}
        {allIndicators.length > 1 && (
          <div className="mt-6 bg-white rounded-xl border p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">项目对比</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase">
                    <th className="pb-2">项目</th><th className="pb-2 text-center">CPI</th><th className="pb-2 text-center">SPI</th><th className="pb-2 text-center">完整度</th><th className="pb-2 text-center">质量</th><th className="pb-2">风险</th>
                  </tr>
                </thead>
                <tbody>
                  {allIndicators.map(ind => (
                    <tr key={ind.projectName} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-700">{ind.projectName}</td>
                      <td className={`py-2 text-center font-bold ${ind.cpi > 1.05 ? 'text-red-500' : ind.cpi > 0.95 ? 'text-amber-500' : 'text-green-500'}`}>{ind.cpi}</td>
                      <td className={`py-2 text-center font-bold ${gaugeColor(ind.spi, [0.5, 0.8])}`}>{ind.spi}</td>
                      <td className={`py-2 text-center font-bold ${gaugeColor(ind.completeness / 100, [0.3, 0.6])}`}>{ind.completeness}%</td>
                      <td className="py-2 text-center font-bold">{ind.qualityScore || '-'}</td>
                      <td className="py-2">
                        {ind.alerts.filter(a => a.level === 'danger').length > 0 && <span className="text-[10px] text-red-500">⚠{ind.alerts.filter(a => a.level === 'danger').length}</span>}
                        {ind.alerts.filter(a => a.level === 'danger').length === 0 && <span className="text-[10px] text-green-500">✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 mt-8">
          数据基于本地存储实时计算 · {indicators?.computedAt ? new Date(indicators.computedAt).toLocaleString('zh-CN') : ''}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
