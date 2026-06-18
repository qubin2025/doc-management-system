import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader, Download, Sparkles, FileText, GitBranch, Printer, AlertTriangle, CheckCircle, Upload, Database, X } from 'lucide-react';
import * as api from '../data/api';
import { getPlanSchema, checkCompleteness, CompletenessReport } from '../data/planSchema';
import { parseDocument } from '../data/documentParser';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const PLAN_TEMPLATES = ['施工组织设计', '深基坑专项方案', '塔吊安拆方案', '模板支架方案', '脚手架方案', '临时用电方案', '消防方案'];
const CHAPTERS_DEFAULT = ['编制依据', '工程概况', '施工部署', '施工进度计划', '施工准备与资源配置', '主要施工方法', '质量管理措施', '安全管理措施', '文明施工与环境保护', '应急预案'];

// 各模板类型的章节预设
const TEMPLATE_CHAPTERS: Record<string, string[]> = {
  '施工组织设计': CHAPTERS_DEFAULT,
  '深基坑专项方案': ['编制依据', '工程概况', '支护方案', '降水方案', '土方开挖', '监测方案', '安全管理措施', '应急预案'],
  '塔吊安拆方案': ['编制依据', '工程概况', '塔吊选型', '基础施工', '安装方案', '拆除方案', '安全管理措施', '应急预案'],
  '模板支架方案': ['编制依据', '工程概况', '支架选型', '搭设方案', '验收标准', '拆除方案', '安全管理措施', '应急预案'],
};

interface Chapter { name: string; content: string; loading: boolean; auto: boolean; }
interface PlanRecord { id: string; planType: string; projectName: string; time: string; chapters: Chapter[]; completeness: any; }
const PLAN_HISTORY = 'plan-generator-history';
const loadPlanHistory = () => { try { return JSON.parse(localStorage.getItem(PLAN_HISTORY) || '[]'); } catch { return []; } };
const savePlanHistory = (items: PlanRecord[]) => { localStorage.setItem(PLAN_HISTORY, JSON.stringify(items.slice(0, 30))); };

const PlanGenerator: React.FC<Props> = ({ projectName, onBack }) => {
  const [planType, setPlanType] = useState(PLAN_TEMPLATES[0]);
  const [planHistory, setPlanHistory] = useState<PlanRecord[]>(loadPlanHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem('plan-output-dir') || '');
  const [params, setParams] = useState({ scale: '', location: '', investment: '', type: '', depth: '', special: '' });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [generating, setGenerating] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [completeness, setCompleteness] = useState<CompletenessReport | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('plan-templates') || '[]'); } catch { return []; } });
  // 增强功能
  const [wordCount, setWordCount] = useState({ min: 200, max: 800 });
  const [kbContext, setKbContext] = useState('');
  const [stdFiles, setStdFiles] = useState<File[]>([]);
  const [stdContent, setStdContent] = useState('');
  const [useKb, setUseKb] = useState(true);
  const [useProjectData, setUseProjectData] = useState(true);
  const [projectDocs, setProjectDocs] = useState<{name:string;content:string}[]>([]);
  const [aiStatus, setAiStatus] = useState<'checking'|'online'|'offline'>('online');
  const [aiModel, setAiModel] = useState('auto');
  const [availableModels, setAvailableModels] = useState<{id:string;name:string;status:string}[]>([
    {id:'deepseek-chat',name:'DeepSeek-V3',status:'online'},
    {id:'deepseek-r1',name:'DeepSeek-R1',status:'online'},
    {id:'qwen-turbo',name:'通义千问(云端)',status:'online'},
    {id:'glm-4-flash',name:'智谱GLM-4',status:'online'},
    {id:'ollama-qwen',name:'Ollama通义(本地)',status:'optional'},
    {id:'ollama-llama',name:'Ollama Llama3(本地)',status:'optional'},
  ]);

  // 异步同步实际AI状态
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('doc-system-token') || '';
        const r = await fetch('/api/ai/models', { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          setAvailableModels(d.models || availableModels);
          setAiStatus(d.models?.some((m:any)=>m.status==='online') ? 'online' : 'offline');
        }
      } catch { /* 保持默认在线 + 全模型 */ }
    })();
  }, []);

  // 自动从项目数据填充参数
  useEffect(() => {
    if (!useProjectData) return;
    try {
      const proj695 = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]');
      const proj808 = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]');
      const proj = [...proj695, ...proj808].find((p: any) => p.name === projectName);
      if (proj?.details) {
        setParams(p => ({
          scale: p.scale || proj.details.scale || '',
          location: p.location || proj.details.location || '',
          investment: p.investment || proj.details.investment || '',
          type: p.type || proj.details.type || '',
          depth: p.depth || '',
          special: p.special || '',
        }));
      }
    } catch {}
  }, [projectName, useProjectData]);

  // 从知识库检索上下文
  const fetchKbContext = async () => {
    try {
      // 搜索知识图谱
      const kg = await api.fetchKnowledgeGraph();
      const relevantNodes = kg.nodes.filter((n: any) =>
        n.type === 'project' || n.type === 'chapter' || n.type === 'work-item'
      ).slice(0, 5);
      if (relevantNodes.length > 0) {
        setKbContext(`知识库检索到${relevantNodes.length}个相关节点: ${relevantNodes.map((n: any) => n.label).join('、')}`);
        toast('已从知识库获取上下文', 'success');
      } else {
        setKbContext('(知识库暂无相关数据，将基于项目参数生成)');
        toast('知识库暂无相关数据', 'warning');
      }
    } catch { toast('知识库检索失败', 'error'); }
  };

  // 处理项目概况文档上传
  const handleProjectDoc = async (f: File) => {
    try {
      const text = await parseDocument(f);
      setProjectDocs(prev => [...prev, { name: f.name, content: text.slice(0, 5000) }]);
      toast(`已加载: ${f.name}`, 'success');
    } catch (e: any) { toast('文档解析失败: ' + e.message, 'error'); }
  };

  // 处理标准文件上传
  const handleStdFile = async (f: File) => {
    setStdFiles(prev => [...prev, f]);
    try {
      const text = await parseDocument(f);
      setStdContent(prev => prev + '\n' + text.slice(0, 5000));
      toast(`已加载标准文件: ${f.name}`, 'success');
    } catch (e: any) { toast('标准文件解析失败: ' + e.message, 'error'); }
  };

  const startGenerate = async () => {
    const currentChapters = TEMPLATE_CHAPTERS[planType] || CHAPTERS_DEFAULT;
    setGenerating(true);
    const initial: Chapter[] = currentChapters.map(c => ({ name: c, content: '', loading: true, auto: true }));
    setChapters(initial);
    setAllDone(false);

    const paramStr = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
    const kbStr = useKb && kbContext ? `\n知识库上下文: ${kbContext}` : '';
    const stdStr = stdContent ? `\n适用标准规范:\n${stdContent.slice(0, 3000)}` : '';
    const docStr = projectDocs.length > 0 ? `\n项目概况文档:\n${projectDocs.map(d=>d.content).join('\n').slice(0, 5000)}` : '';
    const context = `项目名称: ${projectName}${paramStr ? ', ' + paramStr : ''}. 方案类型: ${planType}. 字数要求: 每章${wordCount.min}-${wordCount.max}字。${kbStr}${stdStr}${docStr}`;

    const localChapters: { name: string; content: string }[] = currentChapters.map(c => ({ name: c, content: '' }));

    for (let i = 0; i < currentChapters.length; i++) {
      const ch = currentChapters[i];
      setChapters(prev => prev.map((c, j) => j === i ? { ...c, loading: true } : c));
      try {
        const isAutoChapter = ['编制依据', '安全管理措施', '文明施工与环境保护', '应急预案'].includes(ch);
        const prompt = isAutoChapter
          ? `你是全过程工程咨询AI。请为"${planType}"方案生成【${ch}】章节。${context}。要求：1.直接引用标准条文编号和内容 2.输出${wordCount.min}-${wordCount.max}字 3.分条详述每条约50-100字 4.只输出正文，不要标题。`
          : `你是全过程工程咨询AI。请为"${planType}"方案生成【${ch}】章节。${context}。要求：1.输出${wordCount.min}-${wordCount.max}字详细内容 2.包含技术参数和规范要求 3.分条列出要点。只输出正文，不要标题。`;
        const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: aiModel });
        localChapters[i].content = reply;
        setChapters(prev => prev.map((c, j) => j === i ? { ...c, content: reply, loading: false } : c));
      } catch (e: any) {
        const offlineTemplates: Record<string, string> = {
          '编制依据': `1. GB/T 50326 建设工程项目管理规范\n2. GB 50300 建筑工程施工质量验收统一标准\n3. JGJ 59 建筑施工安全检查标准\n4. DB11/T695-2025 北京市建筑工程资料管理规程\n5. 施工合同、设计图纸及相关技术文件`,
          '工程概况': `本项目位于${params.location || '[请填写]'}，建设规模${params.scale || '[请填写]'}，结构类型${params.type || '[请填写]'}，基坑深度${params.depth || '[请填写]'}，投资额${params.investment || '[请填写]'}。`,
          '施工部署': `遵循"先地下后地上、先主体后装饰"原则。根据工程特点划分施工段组织流水作业，合理安排各工种穿插施工。`,
          '施工进度计划': `根据合同工期编制网络进度计划，明确关键线路和里程碑节点。基础工程XX天，主体结构XX天，装饰XX天，竣工验收XX天。`,
          '施工准备与资源配置': `1.技术准备：熟悉图纸、技术交底\n2.现场准备：三通一平、临时设施\n3.劳动力准备：工种按计划进场\n4.材料准备：按进度分批进场\n5.机械准备：塔吊/电梯/泵车进场验收`,
          '主要施工方法': `1.测量放线：全站仪控制测量\n2.土方：分层开挖及时支护\n3.钢筋：现场加工绑扎\n4.模板：定型钢模或木模\n5.混凝土：商品砼泵送浇筑\n6.砌体：按规范砌筑`,
          '质量管理措施': `1.建立质量管理体系，落实责任制\n2.执行三检制(自检/互检/交接检)\n3.原材料进场检验\n4.关键工序旁站监督\n5.按GB 50300验收`,
          '安全管理措施': `1.建立安全生产责任制\n2.编制专项安全施工方案\n3.安全教育培训持证上岗\n4.按JGJ 59安全检查\n5.配备安全防护用品`,
          '文明施工与环境保护': `1.现场封闭管理设围挡\n2.材料整齐堆放\n3.扬尘控制：洒水降尘\n4.噪声控制：合理安排时间\n5.按DB11/T695-2025执行`,
          '应急预案': `1.成立应急救援领导小组\n2.编制针对性应急预案\n3.定期组织应急演练\n4.配备应急救援物资\n5.与医院/消防建立联动`,
        };
        localChapters[i].content = offlineTemplates[ch] || `【${ch}】模板。请在 backend/.env 中配置有效 DEEPSEEK_API_KEY。`;
        setChapters(prev => prev.map((c, j) => j === i ? { ...c, content: localChapters[i].content, loading: false } : c));
      }
    }
    setGenerating(false); setAllDone(true);
    const schema = getPlanSchema(planType);
    if (schema) setCompleteness(checkCompleteness(localChapters, schema));
    const isOffline = localChapters.some(c => c.content.startsWith('[生成失败') || c.content.includes('请配置有效的 DEEPSEEK_API_KEY'));
    toast(isOffline ? '离线模板(需AI请配置API Key)' : '方案生成完成', isOffline ? 'warning' : 'success');
    // 保存到历史
    const compReport = schema ? checkCompleteness(localChapters, schema) : null;
    const record: PlanRecord = { id: Date.now().toString(), planType, projectName, time: new Date().toLocaleString('zh-CN'), chapters: localChapters.map(c=>({name:c.name,content:c.content,loading:false,auto:true})), completeness: compReport };
    const updated = [record, ...planHistory];
    setPlanHistory(updated); savePlanHistory(updated);
  };

  const updateChapter = (i: number, content: string) => { setChapters(prev => prev.map((c, j) => j === i ? { ...c, content, auto: false } : c)); };
  const exportPDF = () => {
    const body = chapters.map(c => `<div style="margin-bottom:20px"><h2 style="font-size:14pt;border-bottom:1px solid #999">${c.name}</h2><p style="text-indent:2em;line-height:1.8;font-size:11pt">${c.content.replace(/\n/g, '<br>')}</p></div>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:SimSun;margin:40px}h1{font-size:18pt;text-align:center}@media print{body{margin:15mm}}</style></head><body><h1>${planType}</h1><p style="text-align:center">${projectName}</p>${body}</body></html>`;
    const w = window.open(''); if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.print(); setTimeout(() => w.close(), 500); }; }
  };
  const exportDocx = () => {
    const body = chapters.map(c => `<h2>${c.name}</h2><div style="text-indent:2em;line-height:1.8">${c.content.replace(/\n/g, '<br>')}</div>`).join('<br>');
    const h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:SimSun;margin:50px}h1{font-size:18pt;text-align:center}h2{font-size:14pt}</style></head><body><h1>${planType}</h1><p style="text-align:center">${projectName}</p>${body}</body></html>`;
    const b = new Blob(['\uFEFF' + h], { type: 'application/msword;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${planType}_${projectName}.doc`; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 历史侧边栏 */}
      <div className={`${showHistory ? 'w-72' : 'w-0'} bg-white border-r overflow-hidden transition-all duration-200 shrink-0 sticky top-0 h-screen`}>
        {showHistory && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-3 border-b flex items-center justify-between shrink-0"><h3 className="text-xs font-semibold text-gray-700">方案历史</h3><button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button></div>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0"><label className="text-xs text-gray-500 mb-1 block">输出文件夹(本地)</label><input value={outputDir} onChange={e=>{setOutputDir(e.target.value);localStorage.setItem('plan-output-dir',e.target.value)}} placeholder="如: D:\方案" className="w-full px-2 py-1 text-xs border rounded"/></div>
            <div className="flex-1 overflow-hidden hover:overflow-y-auto">
              {planHistory.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">暂无记录</p> : planHistory.map(r => (
                <div key={r.id} className="px-3 py-2 border-b border-gray-50 cursor-pointer hover:bg-green-50" onClick={() => { setPlanType(r.planType); setChapters(r.chapters); }}>
                  <p className="text-xs font-medium text-gray-700 truncate">{r.planType} — {r.projectName}</p><p className="text-xs text-gray-400">{r.time}</p>
                  <div className="flex gap-1 mt-1"><span className="text-xs px-1 py-0.5 rounded bg-green-50 text-green-600">{r.chapters.length}章节</span>{r.completeness && <span className="text-xs px-1 py-0.5 rounded bg-blue-50 text-blue-600">{r.completeness.score}%</span>}</div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t text-xs text-gray-400 shrink-0">数据仅保存在浏览器本地</div>
          </div>
        )}
      </div>

      <div className="flex-1">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-white"/></div>
          <div className="flex items-center gap-3">
            <div><h1 className="text-lg font-bold text-gray-800">AI方案生成</h1><p className="text-xs text-gray-500">项目: {projectName}</p></div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" title={aiStatus === 'online' ? 'AI大模型在线' : aiStatus === 'offline' ? '离线模式（使用本地模板）' : '检测中...'}>
              <span className={`w-2 h-2 rounded-full ${aiStatus === 'online' ? 'bg-green-500 animate-pulse' : aiStatus === 'offline' ? 'bg-amber-500' : 'bg-gray-400 animate-pulse'}`} />
              <span className={`text-xs font-medium ${aiStatus === 'online' ? 'text-green-600' : aiStatus === 'offline' ? 'text-amber-600' : 'text-gray-400'}`}>
                {aiStatus === 'online' ? 'AI在线' : aiStatus === 'offline' ? '离线模式' : '检测中'}
              </span>
            </div>
            <select value={aiModel} onChange={e => setAiModel(e.target.value)} className="px-2 py-1 border rounded-full text-xs bg-white font-medium text-gray-600">
              <option value="auto">自动</option>
              {availableModels.map(m => <option key={m.id} value={m.id} disabled={m.status==='offline'}>{m.status==='offline'?'❌ ':''}{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${showHistory?'bg-green-50 text-green-600':'text-gray-500 hover:bg-gray-50'}`}>📋 历史({planHistory.length})</button>
          {allDone && <button onClick={exportPDF} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"><Printer className="w-3.5 h-3.5"/>PDF</button>}
          {allDone && <button onClick={exportDocx} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100"><Download className="w-3.5 h-3.5"/>Word</button>}
          {allDone && <button onClick={async () => {
            const nodes = [{ id: 'genplan-' + Date.now(), type: 'construction-plan', label: planType + '-' + projectName, props: { project: projectName, auto: 'true' } }];
            const edges = [{ from: 'genplan-' + Date.now(), to: 'proj-' + projectName, type: 'belongs-to', label: 'AI方案' }];
            try { await api.syncKnowledgeGraph(nodes, edges); toast('已同步图谱', 'success'); } catch { toast('同步失败', 'error'); }
          }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100"><GitBranch className="w-3.5 h-3.5"/>同步图谱</button>}
        </div>
      </div></header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className={`${chapters.length > 0 ? 'hidden' : ''} max-w-2xl mx-auto space-y-6`}>
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-green-500"/>AI方案生成设置</h3>
            <div className="space-y-4">
              {/* 方案类型 */}
              <div><label className="block text-xs font-medium text-gray-600 mb-1">方案类型</label>
                <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{PLAN_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>

              {/* 字数要求 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="block text-xs font-medium text-gray-600 mb-2">每章字数范围</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1"><span className="text-xs text-gray-500">最少</span>
                    <select value={wordCount.min} onChange={e => setWordCount(p => ({ ...p, min: Number(e.target.value) }))} className="w-full px-2 py-1.5 border rounded text-xs mt-0.5">
                      {[100, 200, 300, 500, 800].map(v => <option key={v} value={v}>{v}字</option>)}</select></div>
                  <span className="text-gray-400 pt-4">—</span>
                  <div className="flex-1"><span className="text-xs text-gray-500">最多</span>
                    <select value={wordCount.max} onChange={e => setWordCount(p => ({ ...p, max: Number(e.target.value) }))} className="w-full px-2 py-1.5 border rounded text-xs mt-0.5">
                      {[300, 500, 800, 1200, 2000].map(v => <option key={v} value={v}>{v}字</option>)}</select></div>
                </div>
              </div>

              {/* 项目参数 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">项目参数</label>
                  <button onClick={() => setUseProjectData(!useProjectData)} className={`text-xs px-2 py-0.5 rounded-full border ${useProjectData ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400'}`}>
                    {useProjectData ? '✓ 自动填充' : '手动填写'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{k:'scale',l:'建设规模',ph:'如: 地上20层/地下3层'},{k:'location',l:'建设地点',ph:'如: 北京市朝阳区'},{k:'investment',l:'投资额',ph:'如: 3.2亿元'},{k:'type',l:'结构类型',ph:'如: 框架剪力墙'},{k:'depth',l:'基坑深度',ph:'如: -18m'},{k:'special',l:'特殊要求',ph:'如: 地铁旁'}].map(f => (<div key={f.k}><label className="block text-xs font-medium text-gray-600 mb-1">{f.l}</label><input value={(params as any)[f.k]} onChange={e => setParams(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} className="w-full px-3 py-2 border rounded-lg text-xs"/></div>))}
                </div>
                {/* 项目概况文档上传 */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1"><Upload className="w-3.5 h-3.5"/>项目概况文档（做法说明等）</label>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-1 text-gray-600"><Upload className="w-3 h-3"/>上传文档
                      <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" multiple onChange={e => { Array.from(e.target.files||[]).forEach(f => handleProjectDoc(f)); }}/>
                    </label>
                  </div>
                  {projectDocs.length > 0 && (
                    <div className="space-y-1">
                      {projectDocs.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded px-3 py-1.5">
                          <FileText className="w-3 h-3 text-gray-400"/>{d.name}
                          <button onClick={() => setProjectDocs(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-red-400 hover:text-red-600 text-xs">删除</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 知识库汲取 */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-700 flex items-center gap-1"><Database className="w-3.5 h-3.5"/>知识库汲取</span>
                  <button onClick={() => setUseKb(!useKb)} className={`text-xs px-2 py-0.5 rounded-full border ${useKb ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-400'}`}>
                    {useKb ? '✓ 启用' : '禁用'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={fetchKbContext} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">检索相关知识</button>
                  {kbContext && <p className="text-xs text-blue-600 flex-1">{kbContext.slice(0, 80)}...</p>}
                </div>
              </div>

              {/* 标准规范上传 */}
              <div className="bg-amber-50 rounded-lg p-3">
                <label className="block text-xs font-medium text-amber-700 mb-2 flex items-center gap-1"><Upload className="w-3.5 h-3.5"/>标准规范注入</label>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 cursor-pointer flex items-center gap-1"><Upload className="w-3 h-3"/>上传标准文件
                    <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={e => e.target.files?.[0] && handleStdFile(e.target.files[0])}/>
                  </label>
                  {stdFiles.length > 0 && <span className="text-xs text-amber-600">{stdFiles.length}个文件已加载</span>}
                </div>
              </div>

              {/* 保存模板 */}
              {savedTemplates.length > 0 && (
                <div className="bg-white rounded-lg border p-3">
                  <p className="text-xs text-gray-500 mb-2">已保存模板:</p>
                  <div className="flex flex-wrap gap-1">{savedTemplates.map(t => <button key={t} onClick={() => setPlanType(t)} className={`px-2 py-0.5 text-xs rounded-full ${planType===t?'bg-green-50 text-green-700 font-medium border-green-300':'text-gray-500 border-gray-200'} border`}>{t}</button>)}</div>
                </div>
              )}
              <button onClick={() => { if(!savedTemplates.includes(planType)){const v=[...savedTemplates,planType];setSavedTemplates(v);localStorage.setItem('plan-templates',JSON.stringify(v));toast('模板已保存','success');} }} className="w-full py-1.5 text-xs border border-dashed border-gray-300 rounded text-gray-400 hover:text-green-600">+ 保存当前模板</button>

              {/* 生成按钮 */}
              <button onClick={startGenerate} className="w-full py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium flex items-center justify-center gap-2"><Sparkles className="w-4 h-4"/>AI 逐章生成方案（{TEMPLATE_CHAPTERS[planType]?.length || CHAPTERS_DEFAULT.length}章 · {wordCount.min}-{wordCount.max}字/章）</button>
            </div>
          </div>
        </div>

        {/* 生成结果 */}
        {chapters.length > 0 && (
          <div className="space-y-4">
            {generating && <div className="bg-white rounded-xl border p-6 text-center"><Loader className="w-8 h-8 text-green-500 animate-spin mx-auto mb-3"/><p className="text-gray-600">AI逐章生成中...</p></div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapters.map((ch, i) => (
                <div key={i} className={`bg-white rounded-xl border p-4 ${ch.loading?'animate-pulse':''} ${ch.auto&&ch.content?'border-l-4 border-l-green-500':''}`}>
                  <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm flex items-center gap-1.5">{ch.name}{ch.auto&&ch.content&&<span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">自动</span>}</h3>{ch.loading&&<Loader className="w-4 h-4 text-green-500 animate-spin"/>}</div>
                  {ch.loading?<div className="space-y-2"><div className="h-3 bg-gray-200 rounded w-full"/><div className="h-3 bg-gray-200 rounded w-3/4"/></div>
                  :<textarea value={ch.content} onChange={e=>updateChapter(i,e.target.value)} className="w-full min-h-[180px] text-xs leading-relaxed border rounded-lg p-3 resize-y focus:ring-2 focus:ring-green-500 outline-none font-mono"/>}
                </div>
              ))}
            </div>
            {allDone && completeness && (
              <div className="bg-white rounded-xl border p-6"><h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500"/>完整性校验</h3>
                <div className="flex items-center gap-4 mb-4"><div className="flex-1 bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{width:completeness.score+'%'}}/></div><span className="text-sm font-bold">{completeness.score}%</span><span className="text-xs text-gray-500">{completeness.passed}/{completeness.total}章</span></div>
                {completeness.warnings.map((w,i)=>(<div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${w.severity==='error'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0"/><span><b>{w.chapter}</b>: {w.issue}</span></div>))}
              </div>
            )}
            {allDone && <div className="text-center pb-8 flex items-center justify-center gap-2">
              <button onClick={exportPDF} className="px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium"><Printer className="w-4 h-4 inline mr-1"/>PDF</button>
              <button onClick={exportDocx} className="px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium"><Download className="w-4 h-4 inline mr-1"/>Word</button>
            </div>}
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default PlanGenerator;
