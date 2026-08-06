import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, FileText, Loader, Download, Shield, AlertTriangle, CheckCircle, X, Search, GitBranch, BookOpen } from 'lucide-react';
import * as api from '../data/api';
import { parseDocument } from '../data/documentParser';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020', 'GB50300', 'JGJ59'];
interface ReviewRecord { id: string; fileName: string; time: string; results: any[]; report: string; }
const REVIEW_HISTORY = 'construction-review-history';
const loadReviewHistory = () => { try { return JSON.parse(localStorage.getItem(REVIEW_HISTORY) || '[]'); } catch { return []; } };
const saveReviewHistory = (items: ReviewRecord[]) => { localStorage.setItem(REVIEW_HISTORY, JSON.stringify(items.slice(0, 30))); };

const ConstructionReview: React.FC<Props> = ({ projectName, onBack }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewRecord[]>(loadReviewHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem('constr-output-dir') || '');
  const [fileContent, setFileContent] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
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
      } catch { /*保持默认*/ }
    })();
  }, []);
  const [reviewing, setReviewing] = useState(false);
  const [results, setResults] = useState<{ section: string; status: 'pass'|'warn'|'fail'; standard: string; comment: string }[]>([]);
  const [report, setReport] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 审查完成→自动回写知识图谱 + 保存审查历史 (闭环)
  useEffect(() => {
    if (results.length === 0) return;
    const nodes = results.map((r, i) => ({
      id: `review-${projectName.replace(/\s/g, '')}-${Date.now()}-${i}`,
      type: 'review-item', label: `${r.section}: ${r.status}`,
      props: { standard: r.standard, comment: r.comment, status: r.status, project: projectName },
    }));
    const token = localStorage.getItem('doc-system-token') ||
      JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
    fetch('/api/kg/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ nodes, edges: [] }),
    }).catch(() => {});
    // 保存审查历史
    if (report) {
      fetch('/api/ai/review/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ projectName, reviewType: 'construction', fileName: files[0]?.name || '', results, report: report.slice(0, 5000) }),
      }).catch(() => {});
    }
  }, [results, report]);

  const handleFiles = async (flist: FileList) => {
    const arr = Array.from(flist);
    setFiles(prev => [...prev, ...arr]);
    if (arr.length > 0) {
      const f = arr[0];
      setCurrentFileName(f.name);
      try {
        const text = await parseDocument(f);
        setFileContent(text.slice(0, 40000));
        import('../data/ragService').then(m => m.indexDocument(f, projectName).catch(() => {}));
      } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
    }
  };

  const switchFile = async (idx: number) => {
    if (idx >= files.length) return;
    const f = files[idx];
    setCurrentFileName(f.name);
    try {
      const text = await parseDocument(f);
      setFileContent(text.slice(0, 40000));
      import('../data/ragService').then(m => m.indexDocument(f, projectName).catch(() => {}));
    } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
  };

  // RAG 标准条款检索
  const [ragClauses, setRagClauses] = useState<{ clause: string; standard: string; relevance: string }[]>([]);

  const startReview = async () => {
    if (!fileContent) { toast('请先上传方案文件', 'warning'); return; }
    setReviewing(true);
    setResults([]); setReport(''); setRagClauses([]);

    // 本地变量，避免React异步state竞态
    let localResults: { section: string; status: 'pass'|'warn'|'fail'; standard: string; comment: string }[] = [];
    let localReport = '';
    let aiSuccess = false;

    // Step 0: RAG检索
    try {
      const ragPrompt = `请列出与以下施工方案最相关的10条标准条款编号和内容。每行一条，格式"条文X: 内容"。

方案内容:
${fileContent.slice(0, 6000)}`;
      const ragReply = await api.aiChat([{ role: 'user', content: ragPrompt }], '', { projectName, model: aiModel });
      const parsed = ragReply.split('\n').filter(l => l.match(/条文|条款|第.*条|\d+\.\d+/)).map(l => {
        const m = l.match(/(.+?)[:：](.+)/);
        return { clause: (m?.[1] || l).trim(), standard: 'DB11/T695-2025', relevance: (m?.[2] || '').trim().slice(0, 100) };
      }).slice(0, 10);
      if (parsed.length > 0) setRagClauses(parsed);
    } catch {}

    // 核心审查 + 报告
    try {
      // 第一步：AI逐章审查
      const reviewPrompt = `你是全过程工程咨询管理系统AI审查专家。请审查以下施工方案/施工组织设计文件。

项目: ${projectName}
适用标准: ${STANDARDS.join(', ')}

审查要求：
1. 逐章检查是否符合上述标准规范
2. 标记缺失的关键章节
3. 检查标准条款引用是否正确
4. 识别风险点

请按JSON格式输出（只输出JSON）：
[{"section":"章节名","status":"pass|warn|fail","standard":"标准条款","comment":"审查意见"}]

文档内容：
${fileContent}`;

      const reply = await api.aiChat([{ role: 'user', content: reviewPrompt }], '', { projectName, model: aiModel });
      try {
        const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
        if (Array.isArray(parsed)) localResults = parsed;
        else localResults = [{ section: '全文', status: 'warn', standard: '—', comment: reply.slice(0, 300) }];
      } catch { localResults = [{ section: '全文', status: 'warn', standard: '—', comment: reply.slice(0, 300) }]; }
      setResults(localResults);
      aiSuccess = true;

      // 第二步：基于实际审查结果生成报告（使用本地变量，不依赖React state）
      const rptPrompt = `请基于以下审查结果生成施工方案审查综合报告。包含：总体评价、主要问题、修改建议、标准合规率。

项目: ${projectName}
审查结果: ${JSON.stringify(localResults)}`;
      const rpt = await api.aiChat([{ role: 'user', content: rptPrompt }], '', { projectName, model: aiModel });
      localReport = rpt;
      setReport(rpt);
    } catch (e: any) {
      const errMsg = e.message || '';
      console.warn('AI审查异常:', errMsg);
      if (!aiSuccess) {
        // AI完全不可用 → 离线关键词分析
        const hasKeywords: string[] = [];
        const missingKeywords: string[] = [];
        const checks = [
          { kw: ['编制依据','依据','标准','规范','DB','GB'], name: '编制依据' },
          { kw: ['工程概况','项目概况','概况','概述'], name: '工程概况' },
          { kw: ['施工部署','部署','方案','技术'], name: '施工部署' },
          { kw: ['进度计划','工期','进度','节点','里程碑'], name: '进度计划' },
          { kw: ['质量','验收','检测','试验'], name: '质量控制' },
          { kw: ['安全','防护','危险','事故','应急'], name: '安全措施' },
        ];
        checks.forEach(c => {
          if (c.kw.some(k => fileContent.includes(k))) hasKeywords.push(c.name);
          else missingKeywords.push(c.name);
        });
        localResults = [
          ...hasKeywords.map(k => ({ section: k, status: 'pass' as const, standard: '本地检测', comment: `方案中包含"${k}"相关内容` })),
          ...missingKeywords.map(k => ({ section: k, status: 'fail' as const, standard: '本地检测', comment: `方案中未检测到"${k}"关键词，建议补充` })),
        ];
        setResults(localResults);
        localReport = `【离线关键词分析】
AI服务未能响应(${errMsg.slice(0,60)})，已切换为本地关键词分析：

✅ 包含: ${hasKeywords.join('、') || '无'}
❌ 缺失: ${missingKeywords.join('、') || '无'}

💡 提示: AI当前可用但本次请求失败，请重试或检查网络。`;
        setReport(localReport);
        toast('AI本次调用失败，已切换本地分析', 'warning');
      } else {
        // AI审查成功但报告生成失败 → 保留审查结果
        localReport = `【AI审查完成，报告生成失败】\n${errMsg}\n\n审查结果已正常显示，请查看上方逐章审查详情。`;
        setReport(localReport);
        toast('审查完成，报告生成失败', 'warning');
      }
    }
    finally { setReviewing(false); saveReview(); }
  };

  // 批量审查所有文件
  const startBatchReview = async () => {
    if (files.length === 0) return;
    setReviewing(true); setResults([]); setReport('');

    let allResults: { section: string; status: 'pass'|'warn'|'fail'; standard: string; comment: string; file?: string }[] = [];
    let batchReport = `【批量审查报告】\n共审查 ${files.length} 个文件\n\n`;

    for (let fi = 0; fi < files.length; fi++) {
      const f = files[fi];
      setCurrentFileName(f.name);
      toast(`正在审查: ${f.name} (${fi+1}/${files.length})`, 'info');

      // 解析文件
      let content = '';
      try {
        content = (await parseDocument(f)).slice(0, 40000);
      } catch { content = `[无法解析: ${f.name}]`; }

      if (!content || content.length < 10) {
        batchReport += `## ${f.name}\n文件无法解析，已跳过\n\n`;
        allResults.push({ section: f.name, status: 'warn' as const, standard: '—', comment: '文件无法解析' });
        continue;
      }

      // AI审查当前文件
      let localResults: typeof allResults = [];
      let aiSuccess = false;
      try {
        const prompt = `你是AI审查专家。审查以下施工方案。

项目: ${projectName}
适用标准: ${STANDARDS.join(', ')}

按JSON输出（只输出JSON）：
[{"section":"章节名","status":"pass|warn|fail","standard":"标准条款","comment":"审查意见"}]

文档内容(${f.name})：
${content}`;

        const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: aiModel });
        try {
          const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
          if (Array.isArray(parsed)) {
            localResults = parsed.map((r: any) => ({ ...r, file: f.name }));
            aiSuccess = true;
          }
        } catch {}
      } catch {}

      if (!aiSuccess) {
        // 离线关键词检测
        const checks = [
          { kw: ['编制依据','标准','规范','DB','GB'], name: '编制依据' },
          { kw: ['工程概况','概况'], name: '工程概况' },
          { kw: ['施工部署','部署'], name: '施工部署' },
          { kw: ['进度','工期'], name: '进度计划' },
          { kw: ['质量','验收'], name: '质量控制' },
          { kw: ['安全','防护'], name: '安全措施' },
        ];
        localResults = checks.map(c => ({
          section: c.name, file: f.name,
          status: c.kw.some(k=>content.includes(k)) ? 'pass' as const : 'fail' as const,
          standard: '本地检测', comment: c.kw.some(k=>content.includes(k)) ? '包含相关内容' : '未检测到'
        }));
      }

      allResults = [...allResults, ...localResults];
      batchReport += `## ${f.name}\n审查${localResults.length}项，${localResults.filter(r=>r.status==='fail').length}项不合格\n`;
      // 填充关键词摘要
      const hasItems = localResults.filter(r => r.status !== 'fail').map(r => r.section);
      const missingItems = localResults.filter(r => r.status === 'fail').map(r => r.section);
      batchReport += `✅ ${hasItems.join('、') || '无'}\n`;
      if (missingItems.length > 0) batchReport += `❌ ${missingItems.join('、')}\n`;
      batchReport += `\n`;
    }

    setResults(allResults);
    setReport(batchReport + `\n---\n总计${allResults.length}项，不合格${allResults.filter(r=>r.status==='fail').length}项`);
    setReviewing(false);
    toast(`批量审查完成: ${files.length}个文件`, 'success');
    saveReview();
  };

  const exportReport = (format: 'txt' | 'docx' = 'txt') => {
    if (format === 'docx') {
      const rows = results.map((r, i) => `<tr><td>${i + 1}</td><td>${r.section}</td><td style="color:${r.status === 'pass' ? 'green' : r.status === 'warn' ? 'orange' : 'red'}">${r.status === 'pass' ? '合规' : r.status === 'warn' ? '注意' : '不合格'}</td><td>${r.standard}</td><td>${r.comment}</td></tr>`).join('');
      const ragRows = ragClauses.map(c => `<tr><td>${c.clause}</td><td>${c.standard}</td><td>${c.relevance}</td></tr>`).join('');
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:SimSun;margin:40px}h1{font-size:18pt;text-align:center}h2{font-size:14pt;border-bottom:1px solid #ccc}h3{font-size:12pt}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #999;padding:6px;font-size:10pt}th{background:#f0f0f0}.pass{color:green}.warn{color:orange}.fail{color:red}</style></head><body>
<h1>施工方案审查报告</h1><p>项目: ${projectName} | 时间: ${new Date().toLocaleString('zh-CN')}</p>
<h2>一、综合审查报告</h2><div>${report.replace(/\n/g, '<br>')}</div>
${ragClauses.length > 0 ? `<h2>二、相关标准条款(RAG检索)</h2><table><tr><th>条款</th><th>标准</th><th>内容</th></tr>${ragRows}</table>` : ''}
<h2>${ragClauses.length > 0 ? '三' : '二'}、逐项审查结果</h2><table><tr><th>#</th><th>章节</th><th>结论</th><th>依据</th><th>审查意见</th></tr>${rows}</table>
</body></html>`;
      const b = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `施工方案审查报告_${projectName}.doc`;
      a.click(); return;
    }
    const text = `施工方案审查报告\n项目: ${projectName}\n时间: ${new Date().toLocaleString('zh-CN')}\n\n${report}\n\n逐项审查:\n${results.map(r => `[${r.status==='pass'?'✅':r.status==='warn'?'⚠️':'❌'}] ${r.section} | ${r.standard} | ${r.comment}`).join('\n')}`;
    const b = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '施工方案审查报告.txt'; a.click();
  };

  const saveReview = () => {
    const r: ReviewRecord = { id: Date.now().toString(), fileName: currentFileName || files[0]?.name || '', time: new Date().toLocaleString('zh-CN'), results: results, report };
    const updated = [r, ...reviewHistory];
    setReviewHistory(updated); saveReviewHistory(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 历史审查侧边栏 */}
      <div className={`${showHistory ? 'w-72' : 'w-0'} bg-white border-r overflow-hidden transition-all duration-200 shrink-0 sticky top-0 h-screen`}>
        {showHistory && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-3 border-b flex items-center justify-between shrink-0"><h3 className="text-xs font-semibold text-gray-700">历史审查</h3><button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button></div>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0"><label className="text-xs text-gray-500 mb-1 block">输出文件夹(本地)</label><input value={outputDir} onChange={e=>{setOutputDir(e.target.value);localStorage.setItem('constr-output-dir',e.target.value)}} placeholder="如: D:\报告\施工审查" className="w-full px-2 py-1 text-xs border border-gray-300 rounded"/></div>
            <div className="flex-1 overflow-hidden hover:overflow-y-auto">
              {reviewHistory.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">暂无记录</p> : reviewHistory.map(r => (
                <div key={r.id} className="px-3 py-2 border-b border-gray-50 cursor-pointer hover:bg-amber-50" onClick={() => { setResults(r.results); setReport(r.report); }}>
                  <p className="text-xs font-medium text-gray-700 truncate">{r.fileName}</p><p className="text-xs text-gray-400">{r.time}</p>
                  <div className="flex gap-1 mt-1"><span className="text-xs px-1 py-0.5 rounded bg-red-50 text-red-500">{r.results.filter((c:any)=>c.status==='fail').length}不合格</span><span className="text-xs px-1 py-0.5 rounded bg-green-50 text-green-500">{r.results.filter((c:any)=>c.status==='pass').length}合格</span></div>
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
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5 text-white"/></div>
          <div className="flex items-center gap-2">
            <div><h1 className="text-lg font-bold text-gray-800">施工组织设计审查</h1><p className="text-xs text-gray-500">项目: {projectName} | 含专项方案审查</p></div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" title={aiStatus==='online'?'AI在线':aiStatus==='offline'?'离线关键词分析':'检测中'}>
              <span className={`w-2 h-2 rounded-full ${aiStatus==='online'?'bg-green-500 animate-pulse':aiStatus==='offline'?'bg-amber-500':'bg-gray-400 animate-pulse'}`}/>
              <span className={`text-xs font-medium ${aiStatus==='online'?'text-green-600':aiStatus==='offline'?'text-amber-600':'text-gray-400'}`}>{aiStatus==='online'?'AI在线':aiStatus==='offline'?'离线分析':'检测中'}</span>
            </div>
            <select value={aiModel} onChange={e => setAiModel(e.target.value)} className="px-2 py-1 border border-gray-300 rounded-full text-xs bg-white font-medium text-gray-600">
              <option value="auto">自动</option>
              {availableModels.map(m=><option key={m.id} value={m.id} disabled={m.status==='offline'}>{m.status==='offline'?'❌':''}{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <button onClick={async () => {
              const nodes = [
                { id: 'plan-' + Date.now(), type: 'construction-plan', label: files[0]?.name || '施工方案', props: { project: projectName, time: new Date().toLocaleString() } },
                ...results.map((r, i) => ({ id: `review-${Date.now()}-${i}`, type: r.status === 'fail' ? 'risk-point' : 'review-item', label: r.section, props: { status: r.status, standard: r.standard, comment: r.comment } })),
              ];
              const edges = [
                { from: 'plan-' + Date.now(), to: 'proj-' + projectName, type: 'belongs-to', label: '施工方案' },
                ...results.map((_, i) => ({ from: `review-${Date.now()}-${i}`, to: 'plan-' + Date.now(), type: 'references', label: '审查结果' })),
              ];
              try { await api.syncKnowledgeGraph(nodes, edges); toast('已同步到知识图谱', 'success'); } catch { toast('同步失败', 'error'); }
            }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5"/>同步图谱</button>
          )}
          <button onClick={() => setShowHistory(!showHistory)} className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${showHistory?'bg-amber-50 text-amber-600':'text-gray-500 hover:bg-gray-50'}`}>📋 历史({reviewHistory.length})</button>
          {report && <><button onClick={() => exportReport('docx')} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Word</button><button onClick={() => exportReport('txt')} className="px-3 py-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 flex items-center gap-1">TXT</button></>}
        </div>
      </div></header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 上传区 */}
        {files.length === 0 && (
          <div className="bg-white rounded-xl border-2 border-dashed border-amber-300 p-12 text-center hover:border-amber-400 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
            <Upload className="w-12 h-12 text-amber-400 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">上传施工方案文件</h3>
            <p className="text-sm text-gray-500 mb-4">支持 .txt .pdf .doc .docx 多文件批量上传</p>
            <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" multiple onChange={e => e.target.files && handleFiles(e.target.files)}/>
            <span className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm">选择文件</span>
          </div>
        )}

        {/* 已选文件 */}
        {files.length > 0 && !reviewing && results.length === 0 && (
          <div className="bg-white rounded-xl border p-6">
            {files.length > 1 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {files.map((f, idx) => (
                  <button key={idx} onClick={() => switchFile(idx)} className={`px-2 py-1 text-xs rounded-full ${f.name === currentFileName ? 'bg-amber-100 text-amber-700 font-medium' : 'bg-gray-50 text-gray-500'}`}>{f.name.slice(0, 20)}{f.name.length > 20 ? '…' : ''}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mb-4"><FileText className="w-8 h-8 text-amber-500"/><div><p className="font-semibold">{currentFileName || files[0]?.name}</p><p className="text-xs text-gray-500">{files.length}个文件 · 适用标准: {STANDARDS.join(', ')}</p></div>
              <button onClick={() => { setFiles([]); setFileContent(''); setCurrentFileName(''); setResults([]); setReport(''); }} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex gap-2">
              <button onClick={startReview} className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium flex items-center justify-center gap-2 text-sm"><Search className="w-4 h-4"/>审查当前文件</button>
              {files.length > 1 && <button onClick={() => startBatchReview()} className="flex-1 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium flex items-center justify-center gap-2 text-sm"><Upload className="w-4 h-4"/>审查全部({files.length}个)</button>}
            </div>
          </div>
        )}

        {/* 审查中 */}
        {reviewing && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Loader className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4"/>
            <p className="text-gray-600">AI正在逐章审查方案...</p>
            <p className="text-xs text-gray-400 mt-2">对比标准规范 · 检查章节完整性 · 识别风险点</p>
          </div>
        )}

        {/* RAG标准条款 */}
        {ragClauses.length > 0 && (
          <div className="bg-blue-50/50 rounded-xl border border-blue-200 p-6 mb-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-500"/>知识库匹配: 相关标准条款</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {ragClauses.map((c, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-blue-100 text-xs">
                  <span className="font-mono text-blue-600 font-bold">{c.clause}</span>
                  <p className="text-gray-600 mt-1">{c.relevance}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.standard}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 审查结果 */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500"/>逐项审查结果</h3>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${r.status==='pass'?'bg-green-50':r.status==='warn'?'bg-amber-50':'bg-red-50'}`}>
                    {r.status==='pass'?<CheckCircle className="w-5 h-5 text-green-500 mt-0.5"/>:r.status==='warn'?<AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5"/>:<X className="w-5 h-5 text-red-500 mt-0.5"/>}
                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{r.section}</span><span className={`text-xs px-1.5 py-0.5 rounded ${r.status==='pass'?'bg-green-100 text-green-600':r.status==='warn'?'bg-amber-100 text-amber-600':'bg-red-100 text-red-600'}`}>{r.status==='pass'?'合规':r.status==='warn'?'注意':'不合格'}</span></div>
                      <p className="text-xs text-gray-600">{r.comment}</p><p className="text-xs text-gray-400 mt-0.5">依据: {r.standard}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {report && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-800 mb-3">📋 综合审查报告</h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{report}</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setFiles([]); setFileContent(''); setCurrentFileName(''); setResults([]); setReport(''); }} className="px-4 py-2 text-sm border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50">重新审查</button>
                  <button onClick={() => exportReport('docx')} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>导出Word报告</button>
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

export default ConstructionReview;
