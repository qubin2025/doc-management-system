import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, FileText, Loader, Download, Shield, X, GitBranch } from 'lucide-react';
import * as api from '../data/api';
import { parseDocument } from '../data/documentParser';
import { toast } from './Toast';

interface Props { projectName: string; onBack: () => void; }
const RISK_CLAUSES = ['违约责任', '工期延误', '付款条件', '争议解决', '不可抗力', '索赔', '变更', '解除合同'];

const ContractReview: React.FC<Props> = ({ projectName, onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [clauses, setClauses] = useState<{ clause: string; risk: 'low'|'medium'|'high'; issue: string; suggestion: string }[]>([]);
  const [report, setReport] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const text = await parseDocument(f);
      setFileContent(text.slice(0, 40000));
    } catch (e: any) { toast('文件解析失败: ' + e.message, 'error'); }
  };

  const startReview = async () => {
    if (!fileContent) { toast('请先上传合同文件', 'warning'); return; }
    setReviewing(true); setClauses([]); setReport('');
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

      const reply = await api.aiChat([{ role: 'user', content: prompt }], '', { projectName, model: 'auto' });
      try {
        const parsed = JSON.parse(reply.replace(/```json\n?|\n?```/g, '').trim());
        if (Array.isArray(parsed)) setClauses(parsed);
        else throw new Error('格式错误');
      } catch { setClauses([{ clause: '全文', risk: 'medium', issue: '无法解析AI输出', suggestion: reply.slice(0, 300) }]); }

      const stats = clauses.length;
      const highRisk = clauses.filter(c => c.risk === 'high').length;
      const reportPrompt = `请基于以下合同审查结果生成综合审查报告。包括：总体评价、风险等级统计（高风险${highRisk}项/总计${stats}项）、主要风险点、修改建议汇总。项目: ${projectName}。`;
      const rpt = await api.aiChat([{ role: 'user', content: reportPrompt }], '', { projectName, model: 'auto' });
      setReport(rpt);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
        const found = RISK_CLAUSES.filter(k => fileContent.includes(k));
        const missing = RISK_CLAUSES.filter(k => !fileContent.includes(k));
        const localClauses = [
          ...found.map(k => ({ clause: k, risk: 'low' as const, issue: '已检测到相关条款', suggestion: '建议详细审查具体内容' })),
          ...missing.map(k => ({ clause: k, risk: 'high' as const, issue: '合同中未提及此项条款', suggestion: '建议补充完整条款内容' })),
        ];
        setClauses(localClauses);
        setReport(`【离线分析模式】\nAI服务未配置或不可用。以下是基于关键词检测的条款完整性分析：\n\n✅ 已提及: ${found.join('、') || '无'}\n❌ 缺失: ${missing.join('、') || '无'}\n\n💡 如需AI智能审查，请在 backend/.env 中配置有效的 DEEPSEEK_API_KEY 并重启后端。`);
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
      const rows = clauses.map((c, i) => `<tr><td>${i + 1}</td><td>${c.clause}</td><td style="color:${c.risk === 'high' ? 'red' : c.risk === 'medium' ? 'orange' : 'green'}">${c.risk === 'high' ? '高风险' : c.risk === 'medium' ? '中风险' : '低风险'}</td><td>${c.issue}</td><td>${c.suggestion}</td></tr>`).join('');
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:SimSun;margin:40px}h1{font-size:18pt;text-align:center}h2{font-size:14pt}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;font-size:10pt}th{background:#f0f0f0}</style></head><body>
<h1>合同审查报告</h1><p>项目: ${projectName} | 时间: ${new Date().toLocaleString('zh-CN')}</p><h2>一、审查报告</h2><div>${report.replace(/\n/g, '<br>')}</div><h2>二、条款审查</h2><table><tr><th>#</th><th>条款</th><th>风险</th><th>问题</th><th>建议</th></tr>${rows}</table></body></html>`;
      const b = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `合同审查报告_${projectName}.doc`; a.click(); return;
    }
    const text = `合同审查报告\n项目: ${projectName}\n时间: ${new Date().toLocaleString('zh-CN')}\n\n${report}\n\n条款审查详情:\n${clauses.map(c => `[${c.risk==='high'?'🔴':c.risk==='medium'?'🟡':'🟢'}] ${c.clause}\n  问题: ${c.issue}\n  建议: ${c.suggestion}`).join('\n\n')}`;
    const b = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '合同审查报告.txt'; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-sky-500 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5 text-white"/></div>
          <div><h1 className="text-lg font-bold text-gray-800">合同审查</h1><p className="text-xs text-gray-500">项目: {projectName} | 关键条款提取 · 风险识别</p></div>
        </div>
        {clauses.length > 0 && (
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
          }} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5"/>同步图谱</button>
        )}
        {report && <><button onClick={() => exportReport('docx')} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Word</button><button onClick={() => exportReport('txt')} className="px-3 py-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 flex items-center gap-1">TXT</button></>}
      </div></header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {!file && (
          <div className="bg-white rounded-xl border-2 border-dashed border-blue-300 p-12 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
            <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">上传合同文件</h3>
            <p className="text-sm text-gray-500 mb-4">支持 .txt .pdf .doc .docx 格式</p>
            <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
            <span className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">选择文件</span>
          </div>
        )}

        {file && !reviewing && clauses.length === 0 && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-3 mb-4"><FileText className="w-8 h-8 text-blue-500"/><div><p className="font-semibold">{file.name}</p><p className="text-xs text-gray-500">{(file.size/1024).toFixed(0)}KB · 重点审查: {RISK_CLAUSES.slice(0,4).join(', ')}等</p></div>
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
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500"/>条款审查结果</h3>
              <div className="space-y-2">
                {clauses.map((c, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${c.risk==='low'?'bg-green-50':c.risk==='medium'?'bg-amber-50':'bg-red-50'}`}>
                    <span className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${c.risk==='low'?'bg-green-500':c.risk==='medium'?'bg-amber-500':'bg-red-500'}`}/>
                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{c.clause}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${c.risk==='low'?'bg-green-100 text-green-600':c.risk==='medium'?'bg-amber-100 text-amber-600':'bg-red-100 text-red-600'}`}>{c.risk==='low'?'低风险':c.risk==='medium'?'中风险':'高风险'}</span></div>
                      <p className="text-xs text-gray-600">⚠ {c.issue}</p><p className="text-xs text-blue-600 mt-0.5">💡 {c.suggestion}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {report && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold text-gray-800 mb-3">📋 综合审查报告</h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{report}</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setFile(null); setFileContent(''); setClauses([]); setReport(''); }} className="px-4 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50">重新审查</button>
                  <button onClick={() => exportReport('docx')} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>导出Word报告</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractReview;
