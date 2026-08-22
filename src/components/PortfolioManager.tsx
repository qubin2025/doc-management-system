import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { getAllProjectIndicators } from '../data/indicatorEngine';
import type { ProjectIndicators } from '../data/indicatorEngine';
import ModuleHeader from './ModuleHeader';

interface Props { onBack: () => void; }

const PortfolioManager: React.FC<Props> = ({ onBack }) => {
  const [indicators, setIndicators] = useState<ProjectIndicators[]>([]);

  useEffect(() => {
    const all = getAllProjectIndicators();
    setIndicators([...all].sort((a, b) => (b.spi || 0) - (a.spi || 0)));
  }, []);

  const gaugeColor = (v: number, danger = 0.5, warn = 0.8) =>
    v >= warn ? 'text-green-400' : v >= danger ? 'text-amber-400' : 'text-red-400';

  const avgCPI = indicators.length > 0 ? indicators.reduce((s, i) => s + (i.cpi || 0), 0) / indicators.length : 0;
  const avgSPI = indicators.length > 0 ? indicators.reduce((s, i) => s + (i.spi || 0), 0) / indicators.length : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-6xl mx-auto">
        <ModuleHeader title="项目组合管理" icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />} onBack={onBack} subtitle={`${indicators.length} 个项目`} />

        {/* 组合总览 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{indicators.length}</div>
            <div className="text-xs text-[var(--text-muted)]">活跃项目</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${gaugeColor(avgCPI)}`}>{avgCPI.toFixed(2)}</div>
            <div className="text-xs text-[var(--text-muted)]">平均CPI</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${gaugeColor(avgSPI)}`}>{avgSPI.toFixed(2)}</div>
            <div className="text-xs text-[var(--text-muted)]">平均SPI</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{indicators.filter(i => (i.alerts?.length || 0) > 0).length}</div>
            <div className="text-xs text-[var(--text-muted)]">有告警项目</div>
          </div>
        </div>

        {/* 项目列表 */}
        {indicators.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-12 text-center text-[var(--text-muted)]">
            <Target size={48} className="mx-auto mb-4 opacity-30" /><p>暂无项目数据</p>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-[var(--bg-secondary)]"><th className="px-4 py-2 text-xs text-[var(--text-muted)]">项目</th><th className="px-4 py-2 text-xs">CPI</th><th className="px-4 py-2 text-xs">SPI</th><th className="px-4 py-2 text-xs">完整度</th><th className="px-4 py-2 text-xs">质量分</th><th className="px-4 py-2 text-xs">告警</th><th className="px-4 py-2 text-xs">趋势</th></tr></thead>
              <tbody>
                {indicators.map(i => (
                  <tr key={i.projectName} className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium text-xs">{i.projectName}</td>
                    <td className={`px-4 py-2 text-xs font-bold ${i.cpi > 1.0 ? 'text-green-400' : 'text-red-400'}`}>{i.cpi?.toFixed(2) || '-'}</td>
                    <td className={`px-4 py-2 text-xs font-bold ${(i.spi || 0) >= 0.8 ? 'text-green-400' : 'text-red-400'}`}>{i.spi?.toFixed(2) || '-'}</td>
                    <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{i.completeness || 0}%</td>
                    <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{i.qualityScore || 0}</td>
                    <td className="px-4 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${(i.alerts?.length || 0) > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{(i.alerts?.length || 0) > 0 ? `${i.alerts?.length}个` : '正常'}</span></td>
                    <td className="px-4 py-2">{i.spi >= 0.8 ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioManager;
