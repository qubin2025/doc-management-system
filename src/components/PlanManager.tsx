import React, { useState, useMemo } from 'react';
import { ArrowLeft, GitBranch, BarChart3, FileText, Trash2 } from 'lucide-react';
import { guideChapters } from '../data/guideModules';
import GanttChart from './GanttChart';
import NetworkDiagram from './NetworkDiagram';
import { toast } from './Toast';

interface PlanFile { id: string; fileName: string; uploadTime: string; data: any; }

const PlanManager: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab] = useState<'overview' | 'gantt' | 'network'>('overview');
  const [cpmResult, setCpmResult] = useState<any>(null);
  const [planFiles, setPlanFiles] = useState<PlanFile[]>(() => {
    try { return JSON.parse(localStorage.getItem('plan-files') || '[]'); } catch { return []; }
  });
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const saveFiles = (fs: PlanFile[]) => { setPlanFiles(fs); localStorage.setItem('plan-files', JSON.stringify(fs)); };

  const delFile = (id: string) => { saveFiles(planFiles.filter(f => f.id !== id)); if (activeFileId === id) { setActiveFileId(null); setCpmResult(null); } };

  const openFile = (f: PlanFile) => { setActiveFileId(f.id); setCpmResult(f.data); setTab('gantt'); };

  // 概览数据
  const allItems = useMemo(() => {
    const items: { id: string; name: string; chapter: string; chTitle: string; startDate: string; endDate: string; duration: number; completed: boolean }[] = [];
    for (const ch of guideChapters) {
      const done = new Set(JSON.parse(localStorage.getItem(`guide-chapter-${ch.id}-done`) || '[]') as string[]);
      for (const sm of ch.subModules) for (const wi of sm.workItems) {
        const savedPlanned = wi.plannedDate || '';
        let start, end, dur;
        if (savedPlanned) {
          start = savedPlanned;
          const savedDur = wi.duration || '';
          dur = parseInt(savedDur) || (savedDur.includes('周') ? (parseInt(savedDur) || 1) * 7 : savedDur.includes('月') ? (parseInt(savedDur) || 1) * 30 : 7);
          end = new Date(new Date(savedPlanned).getTime() + dur * 86400000).toISOString().split('T')[0];
        } else {
          const idx = items.length;
          start = new Date(new Date('2025-03-01').getTime() + idx * 5 * 86400000).toISOString().split('T')[0];
          dur = 5; end = new Date(new Date(start).getTime() + dur * 86400000).toISOString().split('T')[0];
        }
        items.push({ id: wi.id, name: wi.name, chapter: ch.id, chTitle: ch.title, startDate: start, endDate: end, duration: dur, completed: done.has(wi.id) });
      }
    }
    return items;
  }, []);

  const filtered = allItems;
  const completedCount = filtered.filter(i => i.completed).length;

  // 标题
  const tabTitle = tab === 'overview' ? '项目总体概览' : tab === 'gantt' ? '各子项推进计划（甘特图）' : '各子项工作计划（网络图）';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center"><span className="text-white font-black text-[10px]">ZHJK</span></div>
            <h1 className="text-lg font-bold text-gray-800">计划管理</h1>
            <span className="text-sm text-gray-400">| {tabTitle}</span>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[
              { k: 'overview' as const, l: '项目总体概览' },
              { k: 'gantt' as const, l: '各子项推进计划' },
              { k: 'network' as const, l: '各子项工作计划' },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${tab === t.k ? 'bg-white shadow text-gray-800 font-semibold' : 'text-gray-500'}`}>{t.l}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ── 首页：计划文件列表 ── */}
        {tab === 'overview' && (
          <>
            {/* 数据来源说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">ℹ️</span>
              <div>
                <p className="font-semibold mb-1">数据来源说明</p>
                <p>完成状态来自指南工作模块实际勾选；日期与工期优先读取用户设置的计划日期，未设置按默认推算。✏ 修改计划日期请前往首页 → <b>指南工作模块</b> → 编辑工作项。</p>
              </div>
            </div>

            {/* 项目总体概览卡片 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">总工作项</div><div className="text-2xl font-black text-gray-800">{allItems.length}</div></div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4"><div className="text-xs text-gray-500">已完成</div><div className="text-2xl font-black text-green-600">{completedCount}</div><div className="text-xs text-gray-400 mt-1">{allItems.length>0?Math.round(completedCount/allItems.length*100):0}%</div></div>
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><div className="text-xs text-gray-500">进行中</div><div className="text-2xl font-black text-amber-600">{allItems.length-completedCount}</div><div className="text-xs text-gray-400 mt-1">待完成</div></div>
            </div>

            {/* 上传的计划文件列表 */}
            <div className="bg-white rounded-xl border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" />已上传的各子项推进计划 ({planFiles.length})</h3>
              </div>
              {planFiles.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>暂无计划文件</p>
                  <p className="text-xs mt-1">切换到"各子项推进计划"标签 → 导入 xlsx 文件 → 数据自动回传首页</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase"><tr><th className="px-4 py-3 w-16">序号</th><th className="px-4 py-3">文件名称</th><th className="px-4 py-3 w-40">上传时间</th><th className="px-4 py-3 w-16">任务数</th><th className="px-4 py-3 w-32 text-center">操作</th></tr></thead>
                  <tbody className="divide-y">
                    {planFiles.map((f, i) => (
                      <tr key={f.id} className={`hover:bg-gray-50 ${activeFileId === f.id ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{f.fileName}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(f.uploadTime).toLocaleString('zh-CN')}</td>
                        <td className="px-4 py-3">{f.data?.tasks?.length || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openFile(f)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="打开甘特图"><BarChart3 className="w-3 h-3 inline mr-0.5" />甘特图</button>
                            <button onClick={() => { setActiveFileId(f.id); setCpmResult(f.data); setTab('network'); }} className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded hover:bg-purple-100" title="打开网络图"><GitBranch className="w-3 h-3 inline mr-0.5" />网络图</button>
                            <button onClick={() => delFile(f.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 章节进度 */}
            <div className="mt-6 bg-white rounded-xl border p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">各章节进度</h3>
              <div className="space-y-3">
                {guideChapters.map(ch => {
                  const chItems = allItems.filter(i => i.chapter === ch.id);
                  const chDone = chItems.filter(i => i.completed).length;
                  const pct = chItems.length>0 ? Math.round(chDone/chItems.length*100) : 0;
                  return (
                    <div key={ch.id}><div className="flex justify-between text-xs text-gray-600 mb-1"><span className="font-bold">{ch.number}.{ch.title}</span><span>{chDone}/{chItems.length}</span></div>
                      <div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{width:`${pct}%`}}/></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── 甘特图Tab ── */}
        {tab === 'gantt' && (
          <GanttChart onCpmUpdate={(r) => { setCpmResult(r); if (r) { const f: PlanFile = { id: Date.now().toString(), fileName: `计划_${new Date().toLocaleDateString('zh-CN')}`, uploadTime: new Date().toISOString(), data: r }; setPlanFiles(p => { const n = [f, ...p]; localStorage.setItem('plan-files', JSON.stringify(n)); return n; }); setActiveFileId(f.id); toast('计划已同步到首页文件列表', 'success'); } }} initialResult={cpmResult} />
        )}

        {/* ── 网络图Tab ── */}
        {tab === 'network' && (cpmResult ? (
          <NetworkDiagram cpmResult={cpmResult} onTasksChange={(tasks) => {
            const updated = { ...cpmResult, tasks };
            setCpmResult(updated);
            if (activeFileId) {
              setPlanFiles(p => { const n = p.map(f => f.id === activeFileId ? { ...f, data: updated } : f); localStorage.setItem('plan-files', JSON.stringify(n)); return n; });
            }
            toast('网络图修改已同步到甘特图', 'success');
          }} />
        ) : (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">请先在"各子项推进计划"中导入 xlsx 或从首页文件列表打开</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface Props { onBack: () => void; }

export default PlanManager;
