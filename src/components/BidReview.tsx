import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, FileText, Loader, Download, AlertTriangle, CheckCircle, X, FileSearch, GitBranch } from 'lucide-react';
import * as api from '../data/api';
import { parseDocument } from '../data/documentParser';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const CHECK_ITEMS = ['投标人资格', '评标办法', '合同条款', '技术规范', '工程量清单', '投标保证金', '履约担保'];
interface BidRecord { id: string; fileName: string; time: string; items: any[]; report: string; }
const BID_HISTORY = 'bid-review-history';
const loadBidHistory = () => { try { return JSON.parse(localStorage.getItem(BID_HISTORY) || '[]'); } catch { return []; } };
const saveBidHistory = (items: BidRecord[]) => { localStorage.setItem(BID_HISTORY, JSON.stringify(items.slice(0, 30))); };

const BidReview: React.FC<Props> = ({ projectName, onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [bidHistory, setBidHistory] = useState<BidRecord[]>(loadBidHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem('bid-output-dir') || '');
  const [aiStatus, setAiStatus] = useState<'checking'|'online'|'offline'>('online');
  const [aiModel, setAiModel] = useState('auto');
  const [availableModels, setAvailableModels] = useState<{id:string;name:string;status:string}[]>([
    {id:'deepseek-v4-pro',name:'DeepSeek-V4 Pro',status:'online'},
    {id:'deepseek-chat',name:'DeepSeek-V3',status:'online'},
    {id:'deepseek-r1',name:'DeepSeek-R1',status:'online'},
    {id:'qwen-turbo',name:'通义千问(云端)',status:'online'},
    {id:'glm-4-flash',name:'智谱GLM-4',status:'online'},
    {id:'ollama-qwen',name:'Ollama通义(本地)',status:'optional'},
    {id:'ollama-llama',name:'Ollama Llama3(本地)',status:'optional'},
  ]);
  useEffect(() => {(async()=>{try{const t=localStorage.getItem('doc-system-token')||'';const r=await fetch('/api/ai/models',{headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`}});if(r.ok){const d=await r.json();setAvailableModels(d.models||availableModels);setAiStatus(d.models?.some((m:any)=>m.status==='online')?'online':'offline')}}catch{/*保持默认*/}})()},[]);
  const [items, setItems] = useState<{ item: string; status: 'pass'|'warn'|'fail'; issue: string; regulation: string }[]>([]);
  const [report, setReport] = useState('');

  // 审查完成→持久化到后端
  useEffect(() => {
    if (items.length === 0 || !report) return;
    const token = JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
    fetch('/api/ai/review/history', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify({ projectName, reviewType: 'bid', fileName: file?.name || '', results: items, report: report.slice(0, 5000) }),
    }).catch(() => {});
  }, [items, report]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const text = await parseDocument(f);
      setFileContent(text.slice(0, 40000));
      import('../data/ragService').then(m => m.indexDocument(f, projectName).catch(() => {}));
    } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
  };

  const startReview = async () => {
    if (!fileContent) { toast('请先上传招投标文件', 'warning'); return; }
    setReviewing(true); setItems([]); setReport('');
    try {
      const prompt = `你是全过程工程咨询管理系统招投标审查专家。请审查以下招投标文件。
项目: ${projectName}
需检查的要素: ${CHECK_ITEMS.join(', ')}

审查要求：
1. 逐项检查招投标文件的合规性
2. 识别排他性/倾向性条款
3. 检查投标人资格要求是否合规
4. 评标办法是否公正合理
5. 引用法规依据

请按以下JSON格式输出（只输出JSON）：
[{"item":"检查项","status":"pass|warn|fail","issue":"发现的问题","regulation":"引用的法规依据"}]

文件内容：
${fileContent}`;

      const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: aiModel });
      try {
        const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
        if (Array.isArray(parsed)) setItems(parsed);
        else throw new Error('格式错误');
      } catch { setItems([{ item: '全文', status: 'warn', issue: reply.slice(0, 300), regulation: '—' }]); }

      const failCount = items.filter(i => i.status === 'fail').length;
      const reportPrompt = `请基于以下招投标文件审查结果生成综合审查报告。包括：总体合规评价、不合规项统计(${failCount}项)、修改建议、法规依据汇总。项目: ${projectName}。`;
      const rpt = await api.aiChat([{ role: 'user', content: reportPrompt }], '', { projectName, model: aiModel });
      setReport(rpt);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
        const found = CHECK_ITEMS.filter(k => fileContent.includes(k));
        const missing = CHECK_ITEMS.filter(k => !fileContent.includes(k));
        const localItems = [
          ...found.map(k => ({ item: k, status: 'pass' as const, issue: '已检测到相关内容', regulation: '本地关键词检测' })),
          ...missing.map(k => ({ item: k, status: 'warn' as const, issue: '文件中未明确提及此项', regulation: '本地关键词检测' })),
        ];
        setItems(localItems);
        setReport(`【离线分析模式】\nAI服务未配置或不可用。以下是基于关键词检测的要素完整性分析：\n\n✅ 已包含: ${found.join('、') || '无'}\n⚠️ 缺失: ${missing.join('、') || '无'}\n\n💡 如需AI智能审查，请在 backend/.env 中配置有效的 DEEPSEEK_API_KEY 并重启后端。`);
        toast('AI不可用，已切换为本地关键词分析', 'warning');
        setReviewing(false);
        return;
      }
      toast('审查失败: ' + (msg || '请重试'), 'error');
    }
    finally { setReviewing(false); saveBidToHistory(); }
  };

  const saveBidToHistory = () => {
    const r: BidRecord = { id: Date.now().toString(), fileName: file?.name || '', time: new Date().toLocaleString('zh-CN'), items, report };
    const updated = [r, ...bidHistory];
    setBidHistory(updated); saveBidHistory(updated);
  };

  const exportReport = (format: 'txt' | 'docx' = 'txt') => {
    if (format === 'docx') {
      const rows = items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.item}</td><td style="color:${it.status === 'pass' ? 'green' : it.status === 'warn' ? 'orange' : 'red'}">${it.status === 'pass' ? '合规' : it.status === 'warn' ? '注意' : '不合格'}</td><td>${it.regulation}</td><td>${it.issue}</td></tr>`).join('');
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:SimSun;margin:40px}h1{font-size:18pt;text-align:center}h2{font-size:14pt}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;font-size:10pt}th{background:#f0f0f0}</style></head><body>
<h1>招投标文件审查报告</h1><p>项目: ${projectName} | 时间: ${new Date().toLocaleString('zh-CN')}</p><h2>一、审查报告</h2><div>${report.replace(/\n/g, '<br>')}</div><h2>二、逐项审查</h2><table><tr><th>#</th><th>检查项</th><th>结论</th><th>法规依据</th><th>审查意见</th></tr>${rows}</table></body></html>`;
      const b = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `招投标审查报告_${projectName}.doc`; a.click(); return;
    }
    const text = `招投标文件审查报告\n项目: ${projectName}\n时间: ${new Date().toLocaleString('zh-CN')}\n\n${report}\n\n逐项审查:\n${items.map(i => `[${i.status==='pass'?'✅':i.status==='warn'?'⚠️':'❌'}] ${i.item}\n  问题: ${i.issue}\n  依据: ${i.regulation}`).join('\n\n')}`;
    const b = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '招投标文件审查报告.txt'; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 历史审查侧边栏 */}
      <div className={`${showHistory ? 'w-72' : 'w-0'} bg-white border-r overflow-hidden transition-all duration-200 shrink-0 sticky top-0 h-screen`}>
        {showHistory && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-3 border-b flex items-center justify-between shrink-0"><h3 className="text-xs font-semibold text-gray-700">历史审查</h3><button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button></div>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0"><label className="text-xs text-gray-500 mb-1 block">输出文件夹(本地)</label><input value={outputDir} onChange={e=>{setOutputDir(e.target.value);localStorage.setItem('bid-output-dir',e.target.value)}} placeholder="如: D:\报告\招投标审查" className="w-full px-2 py-1 text-xs border border-gray-300 rounded"/></div>
            <div className="flex-1 overflow-hidden hover:overflow-y-auto">
              {bidHistory.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">暂无记录</p> : bidHistory.map(r => (
                <div key={r.id} className="px-3 py-2 border-b border-gray-50 cursor-pointer hover:bg-blue-50" onClick={() => { setItems(r.items); setReport(r.report); }}>
                  <p className="text-xs font-medium text-gray-700 truncate">{r.fileName}</p><p className="text-xs text-gray-400">{r.time}</p>
                  <div className="flex gap-1 mt-1"><span className="text-xs px-1 py-0.5 rounded bg-red-50 text-red-500">{r.items.filter((c:any)=>c.status==='fail').length}不合格</span><span className="text-xs px-1 py-0.5 rounded bg-green-50 text-green-500">{r.items.filter((c:any)=>c.status==='pass').length}合规</span></div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t text-xs text-gray-400 shrink-0">数据仅保存在浏览器本地</div>
          </div>
        )}
      </div>

      <div className="flex-1">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center"><FileSearch className="w-5 h-5 text-white"/></div>
          <div className="flex items-center gap-3">
            <div><h1 className="text-lg font-bold text-gray-800">招投标文件审查</h1><p className="text-xs text-gray-500">项目: {projectName} | 合规性检查 · 异常条款识别</p></div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"><span className={`w-2 h-2 rounded-full ${aiStatus==='online'?'bg-green-500 animate-pulse':aiStatus==='offline'?'bg-amber-500':'bg-gray-400 animate-pulse'}`}/><span className={`text-xs font-medium ${aiStatus==='online'?'text-green-600':aiStatus==='offline'?'text-amber-600':'text-gray-400'}`}>{aiStatus==='online'?'AI在线':aiStatus==='offline'?'离线分析':'检测中'}</span></div>
            <select value={aiModel} onChange={e => setAiModel(e.target.value)} className="px-2 py-1 border border-gray-300 rounded-full text-xs bg-white font-medium text-gray-600"><option value="auto">自动</option>{availableModels.map(m=><option key={m.id} value={m.id} disabled={m.status==='offline'}>{m.status==='offline'?'❌':''}{m.name}</option>)}</select>
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={async () => {
            const nodes = [
              { id: 'bid-' + Date.now(), type: 'bid-document', label: file?.name || '招投标文件', props: { project: projectName, time: new Date().toLocaleString() } },
              ...items.map((it, i) => ({ id: `bid-item-${Date.now()}-${i}`, type: it.status === 'fail' ? 'risk-point' : 'review-item', label: it.item, props: { status: it.status, regulation: it.regulation } })),
            ];
            const edges = [
              { from: 'bid-' + Date.now(), to: 'proj-' + projectName, type: 'belongs-to', label: '招投标文件' },
              ...items.map((_, i) => ({ from: `bid-item-${Date.now()}-${i}`, to: 'bid-' + Date.now(), type: 'references', label: '审查' })),
            ];
            try { await api.syncKnowledgeGraph(nodes, edges); toast('已同步到知识图谱', 'success'); } catch { toast('同步失败', 'error'); }
          }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5"/>同步图谱</button>
        )}
          <button onClick={() => setShowHistory(!showHistory)} className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${showHistory?'bg-blue-50 text-blue-600':'text-gray-500 hover:bg-gray-50'}`}>📋 历史({bidHistory.length})</button>
        {report && <><button onClick={() => exportReport('docx')} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Word</button><button onClick={() => exportReport('txt')} className="px-3 py-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 flex items-center gap-1">TXT</button></>}
      </div></header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {!file && (
          <div className="bg-white rounded-xl border-2 border-dashed border-indigo-300 p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
            <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">上传招投标文件</h3>
            <p className="text-sm text-gray-500 mb-4">支持 .txt .pdf .doc .docx 格式</p>
            <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
            <span className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm">选择文件</span>
          </div>
        )}

        {file && !reviewing && items.length === 0 && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-3 mb-4"><FileText className="w-8 h-8 text-indigo-500"/><div><p className="font-semibold">{file.name}</p><p className="text-xs text-gray-500">{(file.size/1024).toFixed(0)}KB · 检查要素: {CHECK_ITEMS.slice(0,4).join(', ')}等</p></div>
              <button onClick={() => { setFile(null); setFileContent(''); }} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
            </div>
            <button onClick={startReview} className="w-full py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium flex items-center justify-center gap-2"><FileSearch className="w-4 h-4"/>开始AI审查</button>
          </div>
        )}

        {reviewing && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Loader className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4"/>
            <p className="text-gray-600">AI正在逐项审查招投标文件...</p>
            <p className="text-xs text-gray-400 mt-2">合规检查 · 异常识别 · 法规对照</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><FileSearch className="w-5 h-5 text-indigo-500"/>逐项审查结果</h3>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${it.status==='pass'?'bg-green-50':it.status==='warn'?'bg-amber-50':'bg-red-50'}`}>
                    {it.status==='pass'?<CheckCircle className="w-5 h-5 text-green-500 mt-0.5"/>:it.status==='warn'?<AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5"/>:<X className="w-5 h-5 text-red-500 mt-0.5"/>}
                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{it.item}</span><span className={`text-xs px-1.5 py-0.5 rounded ${it.status==='pass'?'bg-green-100 text-green-600':it.status==='warn'?'bg-amber-100 text-amber-600':'bg-red-100 text-red-600'}`}>{it.status==='pass'?'合规':it.status==='warn'?'注意':'不合格'}</span></div>
                      <p className="text-xs text-gray-600">{it.issue}</p><p className="text-xs text-gray-400 mt-0.5">依据: {it.regulation}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {report && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-800 mb-3">📋 综合审查报告</h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{report}</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setFile(null); setFileContent(''); setItems([]); setReport(''); }} className="px-4 py-2 text-sm border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50">重新审查</button>
                  <button onClick={() => exportReport('docx')} className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>导出Word报告</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default BidReview;
