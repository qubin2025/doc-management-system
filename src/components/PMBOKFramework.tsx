import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { KNOWLEDGE_AREAS, PERFORMANCE_DOMAINS, computePMBOKCoverage, type ProcessGroup } from '../data/pmbokData';

interface PMBOKFrameworkProps { projectName: string; onBack: () => void; }

const PROCESS_GROUPS: { id: ProcessGroup; label: string; color: string }[] = [
  { id: 'initiating', label: '启动', color: 'bg-green-500/20 text-green-400' },
  { id: 'planning', label: '规划', color: 'bg-sky-500/20 text-sky-400' },
  { id: 'executing', label: '执行', color: 'bg-amber-500/20 text-amber-400' },
  { id: 'monitoring', label: '监控', color: 'bg-purple-500/20 text-purple-400' },
  { id: 'closing', label: '收尾', color: 'bg-red-500/20 text-red-400' },
];

const PMBOKFramework: React.FC<PMBOKFrameworkProps> = ({ projectName, onBack }) => {
  const [activeTab, setActiveTab] = useState<'areas' | 'domains' | 'matrix' | 'assessment'>('areas');
  const [coverage, setCoverage] = useState<ReturnType<typeof computePMBOKCoverage>>([]);

  useEffect(() => {
    // 读取工作项完成状态
    const completedSet = new Set<string>();
    for (let ch = 1; ch <= 4; ch++) {
      try {
        const key = `guide-${projectName}-chapter-ch${ch}-done`;
        const raw = localStorage.getItem(key);
        if (raw) JSON.parse(raw).forEach((id: string) => completedSet.add(id));
      } catch {}
    }
    setCoverage(computePMBOKCoverage(Array.from(completedSet)));
  }, [projectName]);

  const scoreColor = (score: number) => score >= 80 ? 'text-green-400' : score >= 40 ? 'text-sky-400' : score > 0 ? 'text-amber-400' : 'text-gray-600';
  const barColor = (score: number) => score >= 80 ? 'bg-green-400' : score >= 40 ? 'bg-sky-400' : score > 0 ? 'bg-amber-400' : 'bg-gray-700';

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition"><ArrowLeft size={20} /></button>
          <BookOpen size={24} className="text-blue-400" />
          <div><h1 className="text-xl font-bold">PMBOK 知识领域框架</h1><p className="text-sm text-[var(--text-muted)]">{projectName}</p></div>
        </div>

        {/* Tab切换 */}
        <div className="flex gap-2 mb-6">
          {(['areas', 'domains', 'matrix', 'assessment'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-lg transition ${activeTab === tab ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-700'}`}>
              {{ areas: '10大知识领域', domains: '8大绩效域', matrix: '过程组矩阵', assessment: '项目评估' }[tab]}
            </button>
          ))}
        </div>

        {/* 知识领域视图 */}
        {activeTab === 'areas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {KNOWLEDGE_AREAS.map(area => {
              const cov = coverage.find(c => c.areaId === area.id);
              const score = cov?.score || 0;
              return (
                <div key={area.id} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 hover:border-blue-500/30 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold">{area.name}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{area.nameEn}</p>
                    </div>
                    <span className={`text-2xl font-bold ${scoreColor(score)}`}>{score}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-secondary)] rounded-full mb-3">
                    <div className={`h-2 rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-3">{area.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {area.processes.map(p => (
                      <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-[var(--text-secondary)]">
                        {p.id} {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 绩效域视图 */}
        {activeTab === 'domains' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {PERFORMANCE_DOMAINS.map(d => (
              <div key={d.id} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5">
                <h3 className="font-bold mb-1">{d.name}</h3>
                <p className="text-xs text-[var(--text-muted)] mb-2">{d.nameEn}</p>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{d.description}</p>
                <div className="flex flex-wrap gap-1">
                  {d.principles.map((p, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 过程组矩阵 */}
        {activeTab === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-secondary)]">知识领域</th>
                  {PROCESS_GROUPS.map(g => (
                    <th key={g.id} className="p-2 bg-[var(--bg-card)] border border-[var(--border-primary)] text-center text-[var(--text-secondary)]">{g.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KNOWLEDGE_AREAS.map(area => (
                  <tr key={area.id}>
                    <td className="p-2 border border-gray-800 font-medium text-xs">{area.name}</td>
                    {PROCESS_GROUPS.map(g => {
                      const processes = area.processes.filter(p => p.processGroup === g.id);
                      return (
                        <td key={g.id} className="p-2 border border-gray-800 text-center">
                          {processes.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-0.5">
                              {processes.map(p => (
                                <span key={p.id} className={`text-[9px] px-1 py-0.5 rounded ${g.color}`} title={p.name}>{p.id}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-700">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 项目评估 */}
        {activeTab === 'assessment' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{coverage.filter(c => c.score >= 80).length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">高覆盖(≥80%)</div>
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-sky-400">{coverage.filter(c => c.score >= 40 && c.score < 80).length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">中覆盖(40-79%)</div>
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">{coverage.filter(c => c.score > 0 && c.score < 40).length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">低覆盖(&lt;40%)</div>
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-gray-600">{coverage.filter(c => c.score === 0).length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">未覆盖</div>
              </div>
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{coverage.length > 0 ? Math.round(coverage.reduce((s, c) => s + c.score, 0) / coverage.length) : 0}%</div>
                <div className="text-[10px] text-[var(--text-muted)]">综合评分</div>
              </div>
            </div>
            {coverage.map(c => {
              const area = KNOWLEDGE_AREAS.find(a => a.id === c.areaId);
              return (
                <div key={c.areaId} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{area?.name}</span>
                    <span className={`text-sm font-bold ${scoreColor(c.score)}`}>{c.score}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full mb-2">
                    <div className={`h-1.5 rounded-full ${barColor(c.score)}`} style={{ width: `${c.score}%` }} />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {c.score >= 80 ? <CheckCircle2 size={12} className="text-green-400" /> : <AlertCircle size={12} className="text-amber-400" />}
                    <span className="text-[var(--text-muted)]">{c.covered}/{c.total} 过程已覆盖</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PMBOKFramework;
