import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, FileText, Loader, Download, Shield, AlertTriangle, CheckCircle, X, Search, GitBranch, BookOpen } from 'lucide-react';
import * as api from '../data/api';
import { parseDocument } from '../data/documentParser';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020', 'GB50300', 'JGJ59'];

const ConstructionReview: React.FC<Props> = ({ projectName, onBack }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileContent, setFileContent] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [results, setResults] = useState<{ section: string; status: 'pass'|'warn'|'fail'; standard: string; comment: string }[]>([]);
  const [report, setReport] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (flist: FileList) => {
    const arr = Array.from(flist);
    setFiles(prev => [...prev, ...arr]);
    if (arr.length > 0) {
      const f = arr[0];
      setCurrentFileName(f.name);
      try {
        const text = await parseDocument(f);
        setFileContent(text.slice(0, 40000));
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
    } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
  };

  // RAG 标准条款检索
  const [ragClauses, setRagClauses] = useState<{ clause: string; standard: string; relevance: string }[]>([]);

  const startReview = async () => {
    if (!fileContent) { toast('请先上传方案文件', 'warning'); return; }
    setReviewing(true);
    setResults([]); setReport(''); setRagClauses([]);

    // Step 0: RAG检索相关标准条款
    try {
      const ragPrompt = `请从以下标准规范中，提取与施工方案内容最相关的10条标准条款。只输出条款编号和条款内容，每条一行。格式："条文X.X: 内容"。\n\n方案内容:\n${fileContent.slice(0, 6000)}`;
      const ragReply = await api.aiChat([{ role: 'user', content: ragPrompt }], '', { projectName, model: 'auto' });
      const parsed = ragReply.split('\n').filter(l => l.match(/条文|条款|第.*条|\d+\.\d+/)).map(l => {
        const m = l.match(/(.+?)[:：](.+)/);
        return { clause: (m?.[1] || l).trim(), standard: 'DB11/T695-2025', relevance: (m?.[2] || '').trim().slice(0, 100) };
      }).slice(0, 10);
      if (parsed.length > 0) setRagClauses(parsed);
    } catch {}

    try {
      const prompt = `你是全过程工程咨询管理系统AI审查专家。请审查以下施工方案/施工组织设计文件。
项目: ${projectName} | 适用标准: ${STANDARDS.join(', ')}

审查要求：
1. 逐章检查是否符合上述标准规范要求
2. 标记缺失的关键章节（如缺编制依据、施工部署、安全措施等）
3. 检查标准条款引用是否正确
4. 识别技术方案中的风险点

请按以下JSON格式输出（只输出JSON，不要其他文字）：
[{"section":"章节名","status":"pass|warn|fail","standard":"引用的标准条款","comment":"审查意见"}]

文档内容：
${fileContent}`;

      const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: 'auto' });
      try {
        const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
        if (Array.isArray(parsed)) setResults(parsed);
        else throw new Error('格式错误');
      } catch { setResults([{ section: '全文', status: 'warn', standard: '—', comment: reply.slice(0, 300) }]); }

      // 生成综合报告
      const reportPrompt = `请基于以下审查结果生成一份施工方案审查综合报告。包括：总体评价、主要问题、修改建议、标准合规率。项目: ${projectName}。审查结果: ${JSON.stringify(results)}`;
      const rpt = await api.aiChat([{ role: 'user', content: reportPrompt }], '', { projectName, model: 'auto' });
      setReport(rpt);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
        // Fallback: 本地分析（不依赖AI）
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
        const localResults = [
          ...hasKeywords.map(k => ({ section: k, status: 'pass' as const, standard: '本地关键词检测', comment: `方案中包含"${k}"相关内容` })),
          ...missingKeywords.map(k => ({ section: k, status: 'fail' as const, standard: '本地关键词检测', comment: `方案中未检测到"${k}"关键词，建议补充` })),
        ];
        setResults(localResults);
        setReport(`【离线分析模式】\nAI服务未配置或不可用。以下是基于关键词检测的方案完整性分析：\n\n✅ 包含章节: ${hasKeywords.join('、') || '无'}\n❌ 缺失章节: ${missingKeywords.join('、') || '无'}\n\n💡 如需AI智能审查，请在 backend/.env 中配置有效的 DEEPSEEK_API_KEY 并重启后端。`);
        toast('AI不可用，已切换为本地关键词分析', 'warning');
        setReviewing(false);
        return;
      }
      toast('审查失败: ' + (msg || '请重试'), 'error');
    }
    finally { setReviewing(false); }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5 text-white"/></div>
          <div><h1 className="text-lg font-bold text-gray-800">施工组织设计审查</h1><p className="text-xs text-gray-500">项目: {projectName} | 含专项方案审查</p></div>
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
                  <button key={idx} onClick={() => switchFile(idx)} className={`px-2 py-1 text-[10px] rounded-full ${f.name === currentFileName ? 'bg-amber-100 text-amber-700 font-medium' : 'bg-gray-50 text-gray-500'}`}>{f.name.slice(0, 20)}{f.name.length > 20 ? '…' : ''}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mb-4"><FileText className="w-8 h-8 text-amber-500"/><div><p className="font-semibold">{currentFileName || files[0]?.name}</p><p className="text-xs text-gray-500">{files.length}个文件 · 适用标准: {STANDARDS.join(', ')}</p></div>
              <button onClick={() => { setFiles([]); setFileContent(''); setCurrentFileName(''); }} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
            </div>
            <button onClick={startReview} className="w-full py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium flex items-center justify-center gap-2"><Search className="w-4 h-4"/>开始AI审查</button>
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
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.standard}</p>
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
                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{r.section}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${r.status==='pass'?'bg-green-100 text-green-600':r.status==='warn'?'bg-amber-100 text-amber-600':'bg-red-100 text-red-600'}`}>{r.status==='pass'?'合规':r.status==='warn'?'注意':'不合格'}</span></div>
                      <p className="text-xs text-gray-600">{r.comment}</p><p className="text-[10px] text-gray-400 mt-0.5">依据: {r.standard}</p></div>
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
  );
};

export default ConstructionReview;
