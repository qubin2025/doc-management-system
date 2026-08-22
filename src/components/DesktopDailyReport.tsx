import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Sparkles, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchDailyReports, DesktopDailyReport } from '../data/api';
import { deleteDailyReport } from '../mobile/data/mobileApi';
import PromptConfigDialog from './PromptConfigDialog';
import { logColorConfig } from '../data/colorDebug';
import ModuleHeader from './ModuleHeader';

interface Props { onBack: () => void; }

const DesktopDailyReportView: React.FC<Props> = ({ onBack }) => {
  const [reports, setReports] = useState<DesktopDailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => { fetchDailyReports().then(d => setReports(d || [])).catch(() => setReports([])).finally(() => setLoading(false)); }, []);

  // 颜色调试日志：记录当前颜色配置与变更历史（仅开发模式）
  useEffect(() => { logColorConfig('DesktopDailyReportView'); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('确认删除？手机端将标注为已失效。')) return;
    try { await deleteDailyReport(id); setReports(p => p.map(r => r.id === id ? { ...r, deleted: 1 } : r)); } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleAI = async () => {
    setAiLoading(true); setAiResult(null);
    const data = list.length > 0 ? list : reports;
    if (data.length === 0) { setAiResult('暂无日报数据可供分析'); setAiLoading(false); return; }
    const dates = [...new Set(data.map(r => r.reportDate))].sort();
    const maxW = data.reduce((m, r) => Math.max(m, r.workersTotal || 0), 0);
    const avgW = Math.round(data.reduce((s, r) => s + (r.workersTotal || 0), 0) / data.length);
    const maxM = data.reduce((m, r) => Math.max(m, r.machineryTotal || 0), 0);
    const avgM = Math.round(data.reduce((s, r) => s + (r.machineryTotal || 0), 0) / data.length);
    const taskCount = data.reduce((s, r) => s + (r.tasks || []).length, 0);
    const issueCount = data.reduce((s, r) => s + (r.issues || []).length, 0);
    const safetyCount = data.filter(r => (r.safetyIssues || '').trim() || (r.issues || []).length > 0).length;
    const weathers: Record<string, number> = {};
    data.forEach(r => { const w = r.weatherDay || '晴'; weathers[w] = (weathers[w] || 0) + 1; });
    const topWeather = Object.entries(weathers).sort((a, b) => b[1] - a[1])[0] || ['晴', 0];
    const projects = [...new Set(data.map(r => r.projectName || '').filter(Boolean))];

    try {
      const apiKey = (window as any).__env?.VITE_DEEPSEEK_API_KEY || '';
      if (apiKey) {
        const tasksPreview = data.slice(0, 5).flatMap(r => (r.tasks || []).slice(0, 2).map(t => t.description || '')).join('；');
        const prompt = `分析${data.length}份工程日报（${dates[0]}至${dates[dates.length-1]}，${projects.length}个项目）：\n日均工人${avgW}人(高峰${maxW}人)，日均机械${avgM}台(高峰${maxM}台)，施工任务${taskCount}项，安全问题${issueCount}次，主要天气${topWeather[0]}(${topWeather[1]}天)。${tasksPreview ? '任务包括：'+tasksPreview : ''}\n请给出：1.资源投入趋势分析 2.安全风险关注点 3.施工进度总体判断 4.一句话管理建议。150字以内。`;
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 300 }), signal: AbortSignal.timeout(30000) });
        if (res.ok) { const d = await res.json(); const text = d.choices?.[0]?.message?.content || ''; if (text) { setAiResult(text); setAiLoading(false); return; } }
      }
    } catch {}
    // Fallback: local comprehensive analysis
    setAiResult(`【${dates[0]} 至 ${dates[dates.length-1]} · ${data.length}份日报 · ${projects.length}个项目】\n\n📊 资源投入：日均工人${avgW}人，高峰${maxW}人；日均机械${avgM}台，高峰${maxM}台。${avgW > 30 ? '人力投入较高，建议关注用工成本和效率。' : '人力处于正常水平。'}\n\n⚠️ 安全风险：${safetyCount}天涉及安全问题/隐患（${issueCount}项），${safetyCount > data.length * 0.3 ? '安全形势需重点关注，建议增加巡检频次。' : '整体安全形势可控。'}\n\n📋 施工进度：共完成${taskCount}项施工任务，日均${Math.round(taskCount/data.length)}项。\n\n☁️ 天气影响：主要天气为${topWeather[0]}（${topWeather[1]}天/${data.length}天）。\n\n💡 建议：继续保持日报提交及时性，关注工人和机械使用效率，加强安全巡检。`);
    setAiLoading(false);
  };

  const names = [...new Set(reports.map(r => r.projectName || '未知').filter(Boolean))].sort();

  // CHANGE 8: Date range filter
  const list = useMemo(() => {
    let filtered = projectFilter ? reports.filter(r => (r.projectName || '') === projectFilter) : reports;
    if (startDate) {
      filtered = filtered.filter(r => r.reportDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.reportDate <= endDate);
    }
    return filtered;
  }, [reports, projectFilter, startDate, endDate]);

  // CHANGE 5: Stats — replace "累计人次" and "机械设备" with new cards
  const maxWorkers = useMemo(() => list.reduce((max, r) => Math.max(max, r.workersTotal || 0), 0), [list]);
  const avgWorkers = useMemo(() => list.length > 0 ? Math.round(list.reduce((s, r) => s + (r.workersTotal || 0), 0) / list.length) : 0, [list]);

  // Machinery: daily peak / daily average, per-type
  const machineryStats = useMemo(() => {
    const perDay: Record<string, number[]> = {};
    list.forEach(r => {
      const dayCounts: Record<string, number> = {};
      (r.machinery || []).forEach(m => {
        const name = m.name || '未知';
        if (!name) return;
        dayCounts[name] = (dayCounts[name] || 0) + (m.count || 0);
      });
      Object.entries(dayCounts).forEach(([name, count]) => {
        if (!perDay[name]) perDay[name] = [];
        perDay[name].push(count);
      });
    });
    const targetTypes = ['塔吊', '施工升降机', '电动吊篮', '铲车'];
    const result: { name: string; peak: number; avg: number }[] = [];
    targetTypes.forEach(t => {
      const daily = perDay[t] || [];
      if (daily.length > 0) result.push({ name: t, peak: Math.max(...daily), avg: Math.round(daily.reduce((a,b)=>a+b,0) / daily.length) });
    });
    return { items: result, totalTypes: Object.keys(perDay).length };
  }, [list]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <ModuleHeader
        title="工程日报管理"
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        subtitle={`${list.length}篇 · ${names.length}个项目`}
        onBack={onBack}
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200" />
            </label>
            <span className="text-xs text-slate-400 dark:text-slate-500">至</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200" />
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200">
              <option value="">全部项目</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={() => setShowPrompt(true)} disabled={aiLoading || reports.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5" /> {aiLoading ? '分析中...' : 'AI分析'}
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* CHANGE 5: Redesigned stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{list.length}</div>
            <div className="text-xs text-slate-400 mt-1">日报总数</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{names.length}</div>
            <div className="text-xs text-slate-400 mt-1">覆盖项目</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{maxWorkers}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500">/</span>
              <span className="text-xl font-bold text-orange-500 dark:text-orange-300">{avgWorkers}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">高峰/平均人数</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            {machineryStats.items.length === 0 ? (
              <div className="text-sm text-slate-400 dark:text-slate-500">-</div>
            ) : (
              <div className="space-y-1">
                {machineryStats.items.map(m => (
                  <div key={m.name} className="text-xs">
                    <span className="font-medium text-purple-600 dark:text-purple-400">{m.name}</span>
                    <span className="text-slate-400 ml-1">日均{m.avg}台</span>
                    <span className="text-xs text-slate-300 ml-0.5">(峰{m.peak})</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-slate-400 mt-1">机械设备（日均/单日高峰）</div>
          </div>
        </div>

        {/* CHANGE 6: AI result moved to second row (right after stats, before report list) */}
        {aiResult && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300">AI分析结果</h3>
              <button onClick={() => setAiResult(null)} className="ml-auto text-xs text-gray-400">关闭</button>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-200">{aiResult}</div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-24 text-slate-400 text-sm">加载中...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm">暂无日报</div>
        ) : (
          <div className="space-y-3">
            {list.map(r => {
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {/* Report summary row */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{r.reportDate}</span>
                        {/* CHANGE 7: Expand toggle button */}
                        <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="p-1 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="ml-0.5">{isExpanded ? '收起' : 'A4预览'}</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.deleted ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">已失效</span>
                        ) : (
                          <button onClick={() => handleDelete(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-xs text-slate-400 dark:text-slate-500">{r.projectName || ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>工人{r.workersTotal || 0}人</span>
                      <span>机械{r.machineryTotal || 0}台</span>
                      <span>任务{(r.tasks || []).length}项</span>
                    </div>
                  </div>

                  {/* CHANGE 7: A4-like print preview */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-6 flex justify-center">
                      <div className="w-full max-w-[210mm] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-md p-6" style={{ minHeight: 'auto' }}>
                        {/* A4 Title */}
                        <h2 className="text-base font-bold text-center text-gray-900 dark:text-slate-100 mb-4 pb-3 border-b border-slate-300 dark:border-slate-600">
                          项目工作情况日报
                        </h2>

                        {/* Basic info table */}
                        <table className="w-full text-xs border-collapse mb-4 table-fixed">
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400 w-16">日期</td>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-slate-800 dark:text-slate-200">{r.reportDate}</td>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400 w-16">天气</td>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-slate-800 dark:text-slate-200">
                                白天: {r.weatherDay || '-'} / 夜间: {r.weatherNight || '-'}
                                {r.weatherAlert && <span className="ml-2 text-red-500">{r.weatherAlert}({r.weatherAlertLevel || '-'})</span>}
                              </td>                            </tr>                            <tr>                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400">天气预警</td>                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5" colSpan={3}>                                {(r.weatherAlert && r.weatherAlert.trim() && r.weatherAlert.trim() !== '无' && r.weatherAlert.trim() !== '-') ? (                                  <span className="text-red-600 dark:text-red-400 font-medium text-xs">                                    ⚠ {r.weatherAlert}{r.weatherAlertLevel ? `（${r.weatherAlertLevel}级）` : ''}                                  </span>                                ) : (                                  <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓ 无预警</span>                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400">填报人</td>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-slate-800 dark:text-slate-200">{r.reportedBy || '-'}</td>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400">项目</td>
                              <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-slate-800 dark:text-slate-200">{r.projectName || '-'}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Personnel breakdown */}
                        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">人员情况</h3>
                        <table className="w-full text-xs border-collapse mb-4 table-fixed">
                          <colgroup><col style={{width:"60%"}} /><col style={{width:"40%"}} /></colgroup>
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700">
                              <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-left text-slate-500 dark:text-slate-400">类别</th>
                              <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-right text-slate-500 dark:text-slate-400">人数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: '总包管理人员', value: r.managersMain },
                              { label: '劳务管理人员', value: r.managersLabor },
                              { label: '专业分包管理', value: r.managersSpecialty },
                              { label: '总包工人', value: r.workersMain },
                              { label: '劳务工人', value: r.workersLabor },
                              { label: '专业分包工人', value: r.workersSpecialty },
                              { label: '特殊工种', value: r.workersSpecial },
                              { label: '合计', value: r.workersTotal, bold: true },
                            ].filter(p => p.value > 0 || p.label === '合计').map(p => (
                              <tr key={p.label} className={p.bold ? 'font-bold bg-slate-50 dark:bg-slate-700' : ''}>
                                <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{p.label}</td>
                                <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-right text-slate-800 dark:text-slate-200">{p.value || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* <table className="w-full text-xs border-collapse mb-4 table-fixed">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-700">
                                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-left text-slate-500 dark:text-slate-400">名称</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-left text-slate-500 dark:text-slate-400">规格</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-right text-slate-500 dark:text-slate-400">数量</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.machinery.map((m, mi) => (
                                  <tr key={mi}>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{m.name || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{m.spec || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-right text-slate-800 dark:text-slate-200">{m.count}</td>
                                  </tr>
                                ))}
                                <tr className="font-bold bg-slate-50 dark:bg-slate-700">
                                  <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">合计</td>
                                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1"></td>
                                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1 text-right text-slate-800 dark:text-slate-200">{r.machineryTotal}</td>
                                </tr>
                              </tbody>
                            </table>
                          </>
                        )}

                        {/* Task progress table — A4 width, word-wrap, auto-height */}
                        {r.tasks && r.tasks.length > 0 && (
                          <>
                            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">施工任务进度</h3>
                            <table className="w-full text-xs border-collapse mb-4 table-fixed">
                              <colgroup>
                                <col style={{width:'10%'}} /><col style={{width:'35%'}} />
                                <col style={{width:'7%'}} /><col style={{width:'8%'}} /><col style={{width:'8%'}} />
                                <col style={{width:'32%'}} />
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-700">
                                  <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-left text-slate-500 dark:text-slate-400 align-top">区域</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-left text-slate-500 dark:text-slate-400 align-top">施工内容</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-500 dark:text-slate-400 align-top">工人</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-500 dark:text-slate-400 align-top">今日</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-500 dark:text-slate-400 align-top">累计</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-left text-slate-500 dark:text-slate-400 align-top">分包单位</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.tasks.map((t, ti) => (
                                  <tr key={ti}>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{t.area || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{t.description || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-800 dark:text-slate-200 align-top">{t.workers || 0}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-800 dark:text-slate-200 align-top">{t.todayPct || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-800 dark:text-slate-200 align-top">{t.totalPct || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{t.contractor || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}

                        {/* Issues list — A4 width, word-wrap, auto-height */}
                        {r.issues && r.issues.length > 0 && (
                          <>
                            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">存在问题与措施</h3>
                            <table className="w-full text-xs border-collapse mb-4 table-fixed">
                              <colgroup>
                                <col style={{width:'28%'}} /><col style={{width:'28%'}} />
                                <col style={{width:'8%'}} /><col style={{width:'36%'}} />
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-700">
                                  <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-left text-slate-500 dark:text-slate-400 align-top">问题</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-left text-slate-500 dark:text-slate-400 align-top">原因</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-500 dark:text-slate-400 align-top">延误</th>
                                  <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-left text-slate-500 dark:text-slate-400 align-top">已采取措施</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.issues.map((iss, ii) => (
                                  <tr key={ii}>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{iss.problem || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{iss.cause || '-'}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-center text-slate-800 dark:text-slate-200 align-top">{iss.delayDays || 0}</td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-slate-600 dark:text-slate-400 align-top break-all">{iss.measures || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}

                        {/* Notes */}
                        {r.notes && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                            <span className="font-medium">备注：</span>{r.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPrompt ? (
        <PromptConfigDialog open={showPrompt} onClose={() => setShowPrompt(false)} onStartAnalysis={handleAI} isAdmin={true} />
      ) : null}
    </div>
  );
};

export default DesktopDailyReportView;
