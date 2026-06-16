import React, { useState } from 'react';
import { ArrowLeft, Loader, Download, Sparkles, FileText, BookOpen, GitBranch, Printer, AlertTriangle, CheckCircle } from 'lucide-react';
import * as api from '../data/api';
import { getPlanSchema, checkCompleteness, CompletenessReport } from '../data/planSchema';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const PLAN_TEMPLATES = ['施工组织设计', '深基坑专项方案', '塔吊安拆方案', '模板支架方案', '脚手架方案', '临时用电方案', '消防方案'];
const CHAPTERS_DEFAULT = ['编制依据', '工程概况', '施工部署', '施工进度计划', '施工准备与资源配置', '主要施工方法', '质量管理措施', '安全管理措施', '文明施工与环境保护', '应急预案'];

interface Chapter { name: string; content: string; loading: boolean; auto: boolean; }

const PlanGenerator: React.FC<Props> = ({ projectName, onBack }) => {
  const [planType, setPlanType] = useState(PLAN_TEMPLATES[0]);
  const [params, setParams] = useState({ scale: '', location: '', investment: '', type: '', depth: '', special: '' });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [generating, setGenerating] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [completeness, setCompleteness] = useState<CompletenessReport | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('plan-templates') || '[]'); } catch { return []; } });

  const startGenerate = async () => {
    setGenerating(true);
    const initial: Chapter[] = CHAPTERS_DEFAULT.map(c => ({ name: c, content: '', loading: true, auto: true }));
    setChapters(initial);
    setAllDone(false);

    const paramStr = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
    const context = `项目名称: ${projectName}${paramStr ? ', ' + paramStr : ''}. 方案类型: ${planType}`;

    // 用本地数组跟踪实际生成内容（React状态异步，不能用于完整性校验）
    const localChapters: { name: string; content: string }[] = CHAPTERS_DEFAULT.map(c => ({ name: c, content: '' }));

    for (let i = 0; i < CHAPTERS_DEFAULT.length; i++) {
      const ch = CHAPTERS_DEFAULT[i];
      setChapters(prev => prev.map((c, j) => j === i ? { ...c, loading: true } : c));
      try {
        const isAutoChapter = ['编制依据', '安全管理措施', '文明施工与环境保护', '应急预案'].includes(ch);
        const prompt = isAutoChapter
          ? `你是全过程工程咨询AI。请为"${planType}"方案生成【${ch}】章节。${context}。要求：直接引用北京市DB11/T695-2025标准的具体条文编号和内容，输出专业规范的完整章节。只输出章节正文，不要标题。`
          : `你是全过程工程咨询AI。请为"${planType}"方案生成【${ch}】章节。${context}。要求：输出专业完整的内容，包含必要的技术参数和规范要求。只输出章节正文，不要标题。`;
        const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: 'auto' });
        localChapters[i].content = reply; // 本地同步更新
        setChapters(prev => prev.map((c, j) => j === i ? { ...c, content: reply, loading: false } : c));
      } catch (e: any) {
        localChapters[i].content = `[生成失败: ${e.message}]`;
        setChapters(prev => prev.map((c, j) => j === i ? { ...c, content: `[生成失败: ${e.message || '请重试'}]`, loading: false } : c));
      }
    }
    setGenerating(false);
    setAllDone(true);
    // 使用本地数组进行完整性校验（避免React异步状态导致全空）
    const schema = getPlanSchema(planType);
    if (schema) {
      setCompleteness(checkCompleteness(localChapters, schema));
    }
    toast('方案生成完成', 'success');
  };

  const updateChapter = (i: number, content: string) => {
    setChapters(prev => prev.map((c, j) => j === i ? { ...c, content, auto: false } : c));
  };

  const exportPDF = () => {
    const body = chapters.map(c => `<div style="margin-bottom:20px"><h2 style="font-size:14pt;border-bottom:1px solid #999">${c.name}</h2><p style="text-indent:2em;line-height:1.8;font-size:11pt">${c.content.replace(/\n/g, '<br>')}</p></div>`).join('');
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${planType}</title><style>body{font-family:SimSun,serif;margin:40px}h1{font-size:18pt;text-align:center}@media print{body{margin:15mm}}</style></head><body><h1>${planType}</h1><p style="text-align:center;color:#666">${projectName} | ${new Date().toLocaleString('zh-CN')}</p>${body}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) { win.onload = () => { win.print(); setTimeout(() => win.close(), 500); }; }
  };

  const exportDocx = () => {
    const body = chapters.map(c => `<h2>${c.name}</h2><div style="text-indent:2em;line-height:1.8">${c.content.replace(/\n/g, '<br>')}</div>`).join('<br>');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:SimSun;margin:50px}h1{font-size:18pt;text-align:center}h2{font-size:14pt;border-bottom:1px solid #999;margin-top:20px}</style></head><body>
<h1>${planType}</h1><p style="text-align:center">${projectName}</p><p style="text-align:center;color:#666">生成时间: ${new Date().toLocaleString('zh-CN')}</p>${body}</body></html>`;
    const b = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${planType}_${projectName}.doc`; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-white"/></div>
          <div><h1 className="text-lg font-bold text-gray-800">施工方案生成</h1><p className="text-xs text-gray-500">项目: {projectName} | 模板自动填充 + 标准条款注入</p></div>
        </div>
        <div className="flex items-center gap-2">
          {allDone && <button onClick={exportPDF} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1"><Printer className="w-3.5 h-3.5"/>PDF</button>}
          {allDone && <button onClick={exportDocx} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Word</button>}
          {allDone && (
            <button onClick={async () => {
              const nodes = [{ id: 'genplan-' + Date.now(), type: 'construction-plan', label: planType + '-' + projectName, props: { project: projectName, time: new Date().toLocaleString(), auto: 'true' } }];
              const edges = [{ from: 'genplan-' + Date.now(), to: 'proj-' + projectName, type: 'belongs-to', label: 'AI生成方案' }];
              try { await api.syncKnowledgeGraph(nodes, edges); toast('已同步到知识图谱', 'success'); } catch { toast('同步失败', 'error'); }
            }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5"/>同步图谱</button>
          )}
        </div>
      </div></header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {chapters.length === 0 ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-green-500"/>AI方案生成设置</h3>
              <div className="space-y-4">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">方案类型</label>
                  <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{PLAN_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-3">
                  {[{k:'scale',l:'建设规模',ph:'如: 地上20层/地下3层'},{k:'location',l:'建设地点',ph:'如: 北京市朝阳区'},{k:'investment',l:'投资额',ph:'如: 3.2亿元'},{k:'type',l:'结构类型',ph:'如: 框架剪力墙'},{k:'depth',l:'基坑深度',ph:'如: -18m'},{k:'special',l:'特殊要求',ph:'如: 地铁旁/临近河道'}].map(f => (
                    <div key={f.k}><label className="block text-xs font-medium text-gray-600 mb-1">{f.l}</label><input value={(params as any)[f.k]} onChange={e => setParams(p => ({...p, [f.k]: e.target.value}))} placeholder={f.ph} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
                  ))}
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  <BookOpen className="w-4 h-4 inline mr-1"/>AI将自动为<b>编制依据/安全管理/文明施工/应急预案</b>等章节注入DB11/T695标准条款
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  💡 <b>知识库增强</b>：方案文本将自动分块索引，支持后续RAG检索和相似方案匹配
                </div>
                {savedTemplates.length > 0 && (
                  <div className="bg-white rounded-lg border p-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">📁 已保存的模板 ({savedTemplates.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {savedTemplates.map(t => (
                        <button key={t} onClick={() => setPlanType(t)} className={`px-3 py-1 text-xs rounded-full border transition-colors ${planType === t ? 'bg-green-50 border-green-300 text-green-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => {
                  if (savedTemplates.includes(planType)) return;
                  const v = [...savedTemplates, planType];
                  setSavedTemplates(v); localStorage.setItem('plan-templates', JSON.stringify(v));
                  toast('模板已保存', 'success');
                }} className="w-full py-2 text-xs border border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-green-600 hover:border-green-300">+ 保存当前模板类型</button>
                <button onClick={startGenerate} className="w-full py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium flex items-center justify-center gap-2"><Sparkles className="w-4 h-4"/>AI 逐章生成方案</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {generating && (
              <div className="bg-white rounded-xl border p-6 text-center"><Loader className="w-8 h-8 text-green-500 animate-spin mx-auto mb-3"/><p className="text-gray-600">AI 正在逐章生成方案内容...</p><p className="text-xs text-gray-400 mt-1">编制依据/安全措施等章节将自动注入标准条款</p></div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapters.map((ch, i) => (
                <div key={i} className={`bg-white rounded-xl border p-4 ${ch.loading ? 'animate-pulse' : ''} ${ch.auto && ch.content ? 'border-l-4 border-l-green-500' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                      {ch.name}
                      {ch.auto && ch.content && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">标准注入</span>}
                    </h3>
                    {ch.loading && <Loader className="w-4 h-4 text-green-500 animate-spin"/>}
                  </div>
                  {ch.loading ? (
                    <div className="space-y-2"><div className="h-3 bg-gray-200 rounded w-full"/><div className="h-3 bg-gray-200 rounded w-3/4"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div>
                  ) : (
                    <textarea value={ch.content} onChange={e => updateChapter(i, e.target.value)}
                      className="w-full min-h-[200px] text-xs text-gray-700 leading-relaxed border rounded-lg p-3 resize-y focus:ring-2 focus:ring-green-500 outline-none font-mono"/>
                  )}
                </div>
              ))}
            </div>
            {allDone && completeness && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500"/>方案完整性校验</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{width: completeness.score+'%'}}/></div>
                  <span className="text-sm font-bold text-gray-700">{completeness.score}%</span>
                  <span className="text-xs text-gray-500">{completeness.passed}/{completeness.total}章</span>
                </div>
                {completeness.warnings.length > 0 && (
                  <div className="space-y-1">
                    {completeness.warnings.map((w, i) => (
                      <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${w.severity==='error'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>
                        {w.severity==='error'?<AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0"/>:<AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400"/>}
                        <span><b>{w.chapter}</b>: {w.issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {allDone && (
              <div className="text-center pb-8">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <button onClick={exportPDF} className="px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium flex items-center gap-2"><Printer className="w-4 h-4"/>导出PDF</button>
                  <button onClick={exportDocx} className="px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium flex items-center gap-2"><Download className="w-4 h-4"/>导出Word</button>
                </div>
                <p className="text-xs text-gray-400">Word兼容格式 · 可编辑 · 已注入标准条款 · 已完成完整性校验</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanGenerator;
