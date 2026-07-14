import React, { useState, useEffect } from 'react';
import { ArrowLeft, History, Trash2, Plus, CheckCircle2, Clock } from 'lucide-react';
import { computeIndicators } from '../data/indicatorEngine';

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  return headers;
};

interface BaselineManagerProps { projectName: string; onBack: () => void; }

interface BaselineItem {
  id: string; projectName: string; baselineType: string;
  version: number; snapshot: any; description: string;
  isActive: boolean; createdAt: string; createdBy: string;
}

const BaselineManager: React.FC<BaselineManagerProps> = ({ projectName, onBack }) => {
  const [baselines, setBaselines] = useState<BaselineItem[]>([]);
  const [currentKpi, setCurrentKpi] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState('scope');
  const [newDesc, setNewDesc] = useState('');

  const loadData = async () => {
    try {
      const res = await fetch(`/api/baselines?project=${encodeURIComponent(projectName)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) setBaselines(await res.json());
    } catch { /* offline */ }
    setCurrentKpi(computeIndicators(projectName));
  };

  useEffect(() => { loadData(); }, [projectName]);

  const handleCreate = async () => {
    const snapshot: any = {};
    if (currentKpi) {
      snapshot.cpi = currentKpi.cpi; snapshot.spi = currentKpi.spi;
      snapshot.completeness = currentKpi.completeness;
      snapshot.qualityScore = currentKpi.qualityScore;
    }
    try {
      const res = await fetch('/api/baselines', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(getAuthHeaders()) },
        body: JSON.stringify({ projectName, baselineType: newType, snapshot, description: newDesc }),
      });
      if (res.ok) { setShowCreate(false); loadData(); }
    } catch { /* offline */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此基线？')) return;
    try {
      await fetch(`/api/baselines/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      loadData();
    } catch { /* offline */ }
  };

  const typeLabel = (t: string) => t === 'scope' ? '范围基线' : t === 'schedule' ? '进度基线' : '成本基线';
  const typeColor = (t: string) => t === 'scope' ? 'bg-blue-500' : t === 'schedule' ? 'bg-green-500' : 'bg-amber-500';

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition"><ArrowLeft size={20} /></button>
            <History size={24} className="text-green-400" />
            <div><h1 className="text-xl font-bold text-[var(--text-primary)]">基线管理</h1><p className="text-sm text-[var(--text-muted)]">{projectName}</p></div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm transition flex items-center gap-1">
            <Plus size={14} /> 创建基线
          </button>
        </div>

        {/* 当前KPI */}
        {currentKpi && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">{currentKpi.cpi?.toFixed(2) || '-'}</div>
              <div className="text-xs text-[var(--text-muted)]">CPI (成本绩效)</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">{currentKpi.spi?.toFixed(2) || '-'}</div>
              <div className="text-xs text-[var(--text-muted)]">SPI (进度绩效)</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">{currentKpi.completeness || 0}%</div>
              <div className="text-xs text-[var(--text-muted)]">完整度</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">{currentKpi.qualityScore || 0}</div>
              <div className="text-xs text-[var(--text-muted)]">质量分</div>
            </div>
          </div>
        )}

        {/* 基线列表 */}
        <div className="space-y-3">
          {baselines.length === 0 ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-12 text-center text-[var(--text-muted)]">
              <History size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">还没有基线</p>
              <p className="text-sm">创建基线快照以跟踪项目范围/进度/成本的基准变化</p>
            </div>
          ) : baselines.map(bl => (
            <div key={bl.id} className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4 hover:border-[var(--border-accent)]/30 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${typeColor(bl.baselineType)}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--text-primary)]">{typeLabel(bl.baselineType)}</span>
                      <span className="text-[10px] bg-[var(--bg-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">V{bl.version}</span>
                      {bl.isActive && <CheckCircle2 size={14} className="text-green-400" />}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{bl.description || '无描述'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-[var(--text-muted)]">
                    <div>CPI: {bl.snapshot?.cpi?.toFixed(2) || '-'}</div>
                    <div>SPI: {bl.snapshot?.spi?.toFixed(2) || '-'}</div>
                  </div>
                  <div className="text-right text-xs text-[var(--text-muted)]">
                    <div>{bl.createdBy}</div>
                    <div><Clock size={10} className="inline mr-0.5" />{new Date(bl.createdAt).toLocaleString('zh-CN')}</div>
                  </div>
                  <button onClick={() => handleDelete(bl.id)}
                    className="p-1 text-red-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 创建弹窗 */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">创建基线</h3>
              <div className="space-y-3">
                <select value={newType} onChange={e => setNewType(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
                  <option value="scope">范围基线</option>
                  <option value="schedule">进度基线</option>
                  <option value="cost">成本基线</option>
                </select>
                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="基线描述" className="w-full bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm text-[var(--text-primary)]">取消</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm">创建</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaselineManager;
