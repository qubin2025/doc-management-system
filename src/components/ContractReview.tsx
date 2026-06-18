import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, FileText, Loader, Download, Shield, X, GitBranch, History, FolderOpen, Trash2, Eye, Clock, FileDown } from 'lucide-react';
import * as api from '../data/api';
import { parseDocument } from '../data/documentParser';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const RISK_CLAUSES = ['违约责任', '工期延误', '付款条件', '争议解决', '不可抗力', '索赔', '变更', '解除合同'];

interface HistoryItem {
  id: string;
  fileName: string;
  projectName: string;
  time: string;
  clauses: { clause: string; risk: 'low'|'medium'|'high'; issue: string; suggestion: string }[];
  report: string;
}

const HISTORY_KEY = 'contract-review-history';

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50))); // 最多50条
}

const ContractReview: React.FC<Props> = ({ projectName, onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [reviewing, setReviewing] = useState(false);
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
  useEffect(() => {(async()=>{try{const t=localStorage.getItem('doc-system-token')||'';const r=await fetch('/api/ai/models',{headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`}});if(r.ok){const d=await r.json();setAvailableModels(d.models||availableModels);setAiStatus(d.models?.some((m:any)=>m.status==='online')?'online':'offline')}}catch{}})()},[]);
  const [clauses, setClauses] = useState<{ clause: string; risk: 'low'|'medium'|'high'; issue: string; suggestion: string }[]>([]);
  const [report, setReport] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<HistoryItem | null>(null);
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('contract-output-folder') || '');

  const handleFile = async (f: File) => {
    setFile(f); setFileContent(''); setClauses([]); setReport('');
    try {
      const text = await parseDocument(f);
      if (!text || text.length < 10) { toast('文件内容过短或无法解析，请检查文件格式', 'warning'); return; }
      setFileContent(text.slice(0, 40000));
      toast(`已解析 ${text.length} 字符`, 'success');
      import('../data/ragService').then(m => m.indexDocument(f, projectName).catch(() => {}));
    } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); setFile(null); }
  };

  const saveToHistory = (c: typeof clauses, rpt: string) => {
    const item: HistoryItem = {
      id: Date.now().toString(),
      fileName: file?.name || '',
      projectName,
      time: new Date().toLocaleString('zh-CN'),
      clauses: c,
      report: rpt,
    };
    const updated = [item, ...history];
    setHistory(updated);
    saveHistory(updated);
  };

  const startReview = async () => {
    if (!fileContent) { toast('请先上传有效合同文件并确保解析成功', 'warning'); return; }
    setReviewing(true); setClauses([]); setReport('');
    let localClauses: typeof clauses = [];
    let localReport = '';

    try {
      const prompt = `你是全过程工程咨询管理系统合同审查专家。请审查以下合同文件。
项目: ${projectName}
重点审查条款类型: ${RISK_CLAUSES.join(', ')}

审查要求：
1. 提取合同关键条款（价款、工期、违约责任、争议解决等）
2. 识别风险条款并按风险等级标记（low/medium/high）
3. 对照法规和招标文件检查合规性
4. 给出每条风险的修改建议

请按以下JSON格式输出（只输出JSON）：
[{"clause":"条款名","risk":"low|medium|high","issue":"存在的问题","suggestion":"修改建议"}]

合同内容：
${fileContent}`;

      const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: aiModel });
      try {
        const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
        if (Array.isArray(parsed)) localClauses = parsed;
        else throw new Error('格式错误');
      } catch { localClauses = [{ clause: '全文', risk: 'medium', issue: 'AI输出解析异常', suggestion: reply.slice(0, 300) }]; }
      setClauses(localClauses);

      const stats = localClauses.length;
      const highRisk = localClauses.filter(c => c.risk === 'high').length;
      const rptPrompt = `请基于以下审查结果生成综合审查报告（Markdown格式）：\n# 合同审查报告\n\n## 项目信息\n- 项目名称: ${projectName}\n- 审查时间: ${new Date().toLocaleString('zh-CN')}\n\n## 审查概要\n共审查 ${stats} 项条款，高风险 ${highRisk} 项，中风险 ${localClauses.filter(c=>c.risk==='medium').length} 项，低风险 ${localClauses.filter(c=>c.risk==='low').length} 项。\n\n## 审查详情\n${localClauses.map(c => `- [${c.risk==='high'?'🔴高':c.risk==='medium'?'🟡中':'🟢低'}] **${c.clause}**: ${c.issue} → ${c.suggestion}`).join('\n')}`;
      const rpt = await api.aiChat([{ role: 'user', content: rptPrompt }], '', { projectName, model: aiModel });
      localReport = rpt;
      setReport(rpt);
      saveToHistory(localClauses, rpt);
    } catch (e: any) {
      localReport = `# 审查异常\n\nAI服务响应失败: ${e.message}\n\n请检查 backend/.env 中的 DEEPSEEK_API_KEY。`;
      setReport(localReport);
      // 仍然保存基本记录
      localClauses = [{ clause: '审查失败', risk: 'high', issue: e.message || '未知错误', suggestion: '请重试' }];
      setClauses(localClauses);
      saveToHistory(localClauses, localReport);
      toast('审查失败: ' + e.message, 'error');
    }
    finally { setReviewing(false); }
  };

  const exportDOCX = () => {
    const highCount = clauses.filter(c => c.risk === 'high').length;
    const midCount = clauses.filter(c => c.risk === 'medium').length;
    const lowCount = clauses.filter(c => c.risk === 'low').length;
    const rows = clauses.map((c, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td><b>${c.clause}</b></td>
        <td style="text-align:center;color:${{high:'#dc2626',medium:'#d97706',low:'#16a34a'}[c.risk]}">${{high:'高风险',medium:'中风险',low:'低风险'}[c.risk]}</td>
        <td>${c.issue}</td>
        <td>${c.suggestion}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>合同审查报告</title>
<style>
  body{font-family:SimSun,"Microsoft YaHei",sans-serif;margin:60px 72px;font-size:11pt;line-height:1.8}
  h1{font-size:18pt;text-align:center;margin-bottom:30px}
  h2{font-size:14pt;border-bottom:2px solid #2563eb;padding-bottom:6px;margin-top:28px}
  h3{font-size:12pt;margin-top:16px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #cbd5e1;padding:8px 12px;font-size:10pt}
  th{background:#eff6ff;font-weight:bold;text-align:center}
  .meta{color:#64748b;font-size:10pt;text-align:center;margin-bottom:24px}
  .summary{padding:16px;background:#f8fafc;border-radius:8px;margin:16px 0}
  .summary span{margin-right:20px;font-weight:bold}
  @page{margin:25mm}
</style></head><body>
<h1>合同审查报告</h1>
<p class="meta">项目: ${projectName} | 文件: ${file?.name || '-'} | 时间: ${new Date().toLocaleString('zh-CN')} | 模型: ${aiModel}</p>

<div class="summary">
  <span style="color:#dc2626">高风险: ${highCount}</span>
  <span style="color:#d97706">中风险: ${midCount}</span>
  <span style="color:#16a34a">低风险: ${lowCount}</span>
  <span>总计: ${clauses.length}</span>
</div>

<h2>综合审查报告</h2>
<div>${report.replace(/\n/g, '<br>').replace(/^#+\s/gm, '<b>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>

<h2>条款审查详情</h2>
<table>
  <tr><th style="width:5%">#</th><th style="width:20%">条款</th><th style="width:10%">风险</th><th style="width:35%">问题</th><th style="width:30%">建议</th></tr>
  ${rows}
</table>

<p style="text-align:center;color:#94a3b8;margin-top:40px;font-size:9pt">全过程工程咨询管理服务平台 · 合同审查模块 v2.5.0 · 自动生成</p>
</body></html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `合同审查报告_${projectName}.doc`);
  };

  const exportHTML = () => {
    const highCount = clauses.filter(c => c.risk === 'high').length;
    const midCount = clauses.filter(c => c.risk === 'medium').length;
    const lowCount = clauses.filter(c => c.risk === 'low').length;
    const rows = clauses.map((c, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td><b>${c.clause}</b></td>
        <td style="text-align:center;color:${{high:'#dc2626',medium:'#d97706',low:'#16a34a'}[c.risk]}">${{high:'高风险',medium:'中风险',low:'低风险'}[c.risk]}</td>
        <td>${c.issue}</td>
        <td>${c.suggestion}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>合同审查报告 — ${projectName}</title>
<style>
  :root{--p:#2563eb;--bg:#f8fafc;--card:#fff;--tx:#1e293b;--mu:#64748b;--bd:#e2e8f0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--tx);line-height:1.9;max-width:900px;margin:0 auto;padding:40px 20px}
  h1{font-size:1.8em;text-align:center;color:var(--p);margin-bottom:8px}
  .meta{text-align:center;color:var(--mu);font-size:.85em;margin-bottom:24px}
  .summary{display:flex;justify-content:center;gap:24px;padding:16px;background:#fff;border-radius:12px;border:1px solid var(--bd);margin:20px 0}
  .summary-item{text-align:center}.summary-item .n{font-size:1.8em;font-weight:800}.summary-item .l{font-size:.75em;color:var(--mu)}
  section{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:28px 32px;margin:20px 0}
  h2{color:var(--p);border-bottom:2px solid var(--p);padding-bottom:8px;margin-bottom:16px;font-size:1.3em}
  table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid var(--bd);padding:8px 12px;font-size:.88em}th{background:#eff6ff;color:#1e40af;font-weight:600}
  .report-body{white-space:pre-wrap;font-size:.9em;line-height:1.9}
  .report-body h1,.report-body h2,.report-body h3{margin:12px 0 6px;color:#334155}
  .report-body strong,.report-body b{color:#1e40af}
  footer{text-align:center;color:var(--mu);font-size:.8em;margin-top:32px;padding-top:16px;border-top:1px solid var(--bd)}
  @media print{body{padding:20px;background:#fff}section{border:none;box-shadow:none}}
</style></head><body>
<h1>合同审查报告</h1>
<p class="meta">项目: ${projectName} | 文件: ${file?.name || '-'} | ${new Date().toLocaleString('zh-CN')}</p>
<div class="summary">
  <div class="summary-item"><div class="n" style="color:#dc2626">${highCount}</div><div class="l">高风险</div></div>
  <div class="summary-item"><div class="n" style="color:#d97706">${midCount}</div><div class="l">中风险</div></div>
  <div class="summary-item"><div class="n" style="color:#16a34a">${lowCount}</div><div class="l">低风险</div></div>
  <div class="summary-item"><div class="n">${clauses.length}</div><div class="l">总计</div></div>
</div>
<section><h2>综合审查报告</h2><div class="report-body">${report.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}</div></section>
<section><h2>条款审查详情</h2><table><tr><th>#</th><th>条款</th><th>风险</th><th>问题</th><th>建议</th></tr>${rows}</table></section>
<footer>全过程工程咨询管理服务平台 · 合同审查模块 v2.5.0 · 自动生成</footer>
</body></html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `合同审查报告_${projectName}.html`);
  };

  const exportTXT = () => {
    const text = `合同审查报告\n${'='.repeat(40)}\n项目: ${projectName}\n文件: ${file?.name || '-'}\n时间: ${new Date().toLocaleString('zh-CN')}\n\n一、审查概要\n高风险: ${clauses.filter(c=>c.risk==='high').length} | 中风险: ${clauses.filter(c=>c.risk==='medium').length} | 低风险: ${clauses.filter(c=>c.risk==='low').length} | 总计: ${clauses.length}\n\n二、综合审查报告\n${report}\n\n三、条款审查详情\n${clauses.map((c,i) => `${i+1}. [${c.risk==='high'?'高风险':c.risk==='medium'?'中风险':'低风险'}] ${c.clause}\n   问题: ${c.issue}\n   建议: ${c.suggestion}`).join('\n\n')}`;
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `合同审查报告_${projectName}.txt`);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFolder ? outputFolder + '/' + fileName : fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    if (viewingHistory?.id === id) setViewingHistory(null);
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setViewingHistory(item);
    setClauses(item.clauses);
    setReport(item.report);
    setFile(null);
    setFileContent('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 历史审查侧边栏 — 固定定位，仅鼠标悬停时内部可滚动 */}
      <div className={`${showHistory ? 'w-72' : 'w-0'} bg-white border-r overflow-hidden transition-all duration-200 shrink-0 sticky top-0 h-screen`}>
        {showHistory && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-3 border-b flex items-center justify-between shrink-0">
              <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><History className="w-3.5 h-3.5"/>历史审查</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
            </div>
            {/* 输出文件夹 */}
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
              <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><FolderOpen className="w-3 h-3"/>输出文件夹(本地)</label>
              <input value={outputFolder} onChange={e => { setOutputFolder(e.target.value); localStorage.setItem('contract-output-folder', e.target.value); }} placeholder="如: D:\报告\合同审查" className="w-full px-2 py-1 text-xs border rounded"/>
            </div>
            <div className="flex-1 overflow-hidden hover:overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">暂无历史记录</p>
              ) : (
                history.map(item => (
                  <div key={item.id} className={`px-3 py-2 border-b border-gray-50 cursor-pointer hover:bg-blue-50 ${viewingHistory?.id === item.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`} onClick={() => loadHistoryItem(item)}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700 truncate flex-1">{item.fileName}</p>
                      <button onClick={e => { e.stopPropagation(); deleteHistoryItem(item.id); }} className="text-gray-300 hover:text-red-500 ml-1"><Trash2 className="w-3 h-3"/></button>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5"/>{item.time}</p>
                    <div className="flex gap-1 mt-1">
                      <span className="text-xs px-1 py-0.5 rounded bg-red-50 text-red-500">{item.clauses.filter(c=>c.risk==='high').length}高</span>
                      <span className="text-xs px-1 py-0.5 rounded bg-amber-50 text-amber-500">{item.clauses.filter(c=>c.risk==='medium').length}中</span>
                      <span className="text-xs px-1 py-0.5 rounded bg-green-50 text-green-500">{item.clauses.filter(c=>c.risk==='low').length}低</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t text-xs text-gray-400 shrink-0">
              数据仅保存在浏览器本地
            </div>
          </div>
        )}
      </div>

      {/* 主区域 */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm border-b sticky top-0 z-30"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-sky-500 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5 text-white"/></div>
            <div className="flex items-center gap-2">
              <div><h1 className="text-sm font-bold text-gray-800">合同审查</h1><p className="text-xs text-gray-500">项目: {projectName} | 关键条款提取 · 风险识别</p></div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"><span className={`w-2 h-2 rounded-full ${aiStatus==='online'?'bg-green-500 animate-pulse':aiStatus==='offline'?'bg-amber-500':'bg-gray-400 animate-pulse'}`}/><span className={`text-xs font-medium ${aiStatus==='online'?'text-green-600':aiStatus==='offline'?'text-amber-600':'text-gray-400'}`}>{aiStatus==='online'?'AI在线':aiStatus==='offline'?'离线分析':'检测中'}</span></div>
              <select value={aiModel} onChange={e => setAiModel(e.target.value)} className="px-2 py-1 border rounded-full text-xs bg-white font-medium text-gray-600"><option value="auto">自动</option>{availableModels.map(m=><option key={m.id} value={m.id} disabled={m.status==='offline'}>{m.status==='offline'?'❌':''}{m.name}</option>)}</select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHistory(!showHistory)} className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${showHistory ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}><History className="w-3.5 h-3.5"/>历史({history.length})</button>
            {clauses.length > 0 && (<>
              <button onClick={async () => {
                const nodes = [
                  { id: 'contract-' + Date.now(), type: 'contract', label: file?.name || '合同文件', props: { project: projectName, time: new Date().toLocaleString() } },
                  ...clauses.map((c, i) => ({ id: `risk-${Date.now()}-${i}`, type: c.risk === 'high' ? 'risk-point' : 'review-item', label: c.clause, props: { risk: c.risk, issue: c.issue } })),
                ];
                const edges = [
                  { from: 'contract-' + Date.now(), to: 'proj-' + projectName, type: 'belongs-to', label: '合同' },
                  ...clauses.map((_, i) => ({ from: `risk-${Date.now()}-${i}`, to: 'contract-' + Date.now(), type: 'references', label: '审查' })),
                ];
                try { await api.syncKnowledgeGraph(nodes, edges); toast('已同步到知识图谱', 'success'); } catch { toast('同步失败', 'error'); }
              }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5"/></button>
              <div className="flex rounded-lg border overflow-hidden">
                <button onClick={exportHTML} className="px-2.5 py-1.5 text-xs bg-white text-gray-500 hover:bg-gray-50 flex items-center gap-1" title="HTML报告"><FileDown className="w-3 h-3"/>HTML</button>
                <button onClick={exportDOCX} className="px-2.5 py-1.5 text-xs bg-white text-blue-500 hover:bg-gray-50 border-l flex items-center gap-1" title="Word文档(.doc)"><Download className="w-3 h-3"/>DOC</button>
                <button onClick={exportTXT} className="px-2.5 py-1.5 text-xs bg-white text-gray-500 hover:bg-gray-50 border-l" title="纯文本">TXT</button>
              </div>
            </>)}
          </div>
        </div></header>

        <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
          {!file && !viewingHistory && (
            <div className="bg-white rounded-xl border-2 border-dashed border-blue-300 p-12 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4"/>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">上传合同文件</h3>
              <p className="text-xs text-gray-500 mb-4">支持 .txt .pdf .doc .docx 格式</p>
              <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
              <span className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs">选择文件</span>
            </div>
          )}

          {file && !reviewing && clauses.length === 0 && !viewingHistory && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4"><FileText className="w-8 h-8 text-blue-500"/><div><p className="font-semibold">{file.name}</p><p className="text-xs text-gray-500">{(file.size/1024).toFixed(0)}KB · 已解析{fileContent.length}字 · 审查{RISK_CLAUSES.slice(0,4).join(', ')}等</p></div>
                <button onClick={() => { setFile(null); setFileContent(''); }} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
              </div>
              <button onClick={startReview} className="w-full py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium flex items-center justify-center gap-2">开始AI审查</button>
            </div>
          )}

          {reviewing && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Loader className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4"/>
              <p className="text-gray-600">AI正在逐条审查合同条款...</p>
              <p className="text-xs text-gray-400 mt-2">提取关键条款 · 识别风险项 · 生成修改建议</p>
            </div>
          )}

          {clauses.length > 0 && (
            <div className="space-y-4">
              {viewingHistory && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
                  <p className="text-xs text-blue-700 flex items-center gap-1"><Eye className="w-3.5 h-3.5"/>查看历史: {viewingHistory.fileName} ({viewingHistory.time})</p>
                  <button onClick={() => setViewingHistory(null)} className="text-xs text-blue-500 hover:underline">返回当前</button>
                </div>
              )}
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500"/>条款审查结果</h3>
                <div className="space-y-2">
                  {clauses.map((c, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${c.risk==='low'?'bg-green-50':c.risk==='medium'?'bg-amber-50':'bg-red-50'}`}>
                      <span className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${c.risk==='low'?'bg-green-500':c.risk==='medium'?'bg-amber-500':'bg-red-500'}`}/>
                      <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-xs">{c.clause}</span><span className={`text-xs px-1.5 py-0.5 rounded ${c.risk==='low'?'bg-green-100 text-green-600':c.risk==='medium'?'bg-amber-100 text-amber-600':'bg-red-100 text-red-600'}`}>{c.risk==='low'?'低风险':c.risk==='medium'?'中风险':'高风险'}</span></div>
                        <p className="text-xs text-gray-600">{c.issue}</p><p className="text-xs text-blue-600 mt-0.5">{c.suggestion}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {report && (
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-gray-800 mb-3">综合审查报告</h3>
                  <div className="text-xs text-gray-700 leading-relaxed report-text" dangerouslySetInnerHTML={{__html:
                    report.replace(/^### (.+)$/gm,'<h3 class="text-sm font-semibold text-gray-800 mt-4 mb-2">$1</h3>')
                         .replace(/^## (.+)$/gm,'<h2 class="text-lg font-bold text-blue-600 mt-4 mb-2 border-b pb-1">$1</h2>')
                         .replace(/^# (.+)$/gm,'<h1 class="text-base font-bold text-blue-700 mt-4 mb-3">$1</h1>')
                         .replace(/\*\*(.+?)\*\*/g,'<b class="text-gray-900">$1</b>')
                         .replace(/^- (.+)$/gm,'<li class="ml-4">$1</li>')
                         .replace(/\n/g, '<br>')
                  }}/>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 pb-8">
                <button onClick={() => { setFile(null); setFileContent(''); setClauses([]); setReport(''); setViewingHistory(null); }} className="px-4 py-2 text-xs border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50">重新审查</button>
                <button onClick={exportHTML} className="px-4 py-2 text-xs bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1"><FileDown className="w-3.5 h-3.5"/>HTML报告</button>
                <button onClick={exportDOCX} className="px-4 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>DOC报告</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractReview;
