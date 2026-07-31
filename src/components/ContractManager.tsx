import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Plus, Search, Shield, Bookmark, Download, BookOpen } from 'lucide-react';
import { toast } from './Toast';

interface ContractItem {
  id: number; project_name: string; contract_name: string; contract_type: string;
  party_a: string; party_b: string; amount: number; sign_date: string;
  review_result: string; risk_level: string; risk_items: any[]; template_id: number | null;
  content_text: string; created_at: string;
}
interface TemplateItem { id: number; name: string; category: string; description: string; created_at: string; }

const RISK_COLORS: Record<string, string> = { high: 'bg-red-100 text-red-700 border-red-300', medium: 'bg-amber-100 text-amber-700 border-amber-300', low: 'bg-green-100 text-green-700 border-green-300' };

const ContractManager: React.FC<{ projectName: string; onBack: () => void }> = ({ projectName, onBack }) => {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'contracts' | 'templates'>('contracts');
  const [showAdd, setShowAdd] = useState(false);
  const [filterProject, setFilterProject] = useState(projectName || '');
  const [aiReviewing, setAiReviewing] = useState<number | null>(null);

  // 新建表单
  const [form, setForm] = useState({ contract_name: '', contract_type: '施工合同', party_a: '', party_b: '', amount: '', sign_date: '', content_text: '' });

  const token = () => {
    const a = localStorage.getItem('doc-system-auth');
    return a ? `Bearer ${JSON.parse(a)?.token || ''}` : '';
  };

  const fetchContracts = async () => {
    const url = filterProject ? `/api/contracts/list?project=${encodeURIComponent(filterProject)}` : '/api/contracts/list';
    const r = await fetch(url, { headers: { Authorization: token() } });
    if (r.ok) setContracts(await r.json());
  };

  const fetchTemplates = async () => {
    const r = await fetch('/api/contracts/templates/list', { headers: { Authorization: token() } });
    if (r.ok) setTemplates(await r.json());
  };

  useEffect(() => { fetchContracts(); fetchTemplates(); setLoading(false); }, []);

  const handleCreate = async () => {
    if (!form.contract_name) { toast('请输入合同名称', 'error'); return; }
    const r = await fetch('/api/contracts/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token() },
      body: JSON.stringify({ project_name: filterProject || '未指定项目', ...form, amount: Number(form.amount) || 0 }),
    });
    if (r.ok) { toast('合同已添加', 'success'); setShowAdd(false); setForm({ contract_name: '', contract_type: '施工合同', party_a: '', party_b: '', amount: '', sign_date: '', content_text: '' }); fetchContracts(); }
  };

  const handleAIReview = async (contract: ContractItem) => {
    setAiReviewing(contract.id);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token() },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `请审查以下合同条款，按JSON输出风险点:\n合同名称:${contract.contract_name}\n类型:${contract.contract_type}\n甲方:${contract.party_a}\n乙方:${contract.party_b}\n金额:${contract.amount}万元\n内容:\n${contract.content_text.slice(0, 5000)}\n\n输出格式:[{"clause":"条款名","risk":"high|medium|low","issue":"问题描述","suggestion":"修改建议"}]` }],
          model: 'auto',
        }),
      });
      const d = await r.json();
      const reply = d.reply || '';
      const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, reply];
      const riskItems = JSON.parse(jsonMatch[1]?.trim() || '[]');

      const overallRisk = riskItems.filter((ri: any) => ri.risk === 'high').length > 0 ? 'high'
        : riskItems.filter((ri: any) => ri.risk === 'medium').length > 2 ? 'medium' : 'low';

      await fetch(`/api/contracts/${contract.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token() },
        body: JSON.stringify({ review_result: reply.slice(0, 2000), risk_level: overallRisk, risk_items: riskItems }),
      });
      toast('AI审查完成', 'success');
      fetchContracts();
    } catch (e: any) { toast('审查失败: ' + (e.message || '网络错误'), 'error'); }
    finally { setAiReviewing(null); }
  };

  const handleMakeTemplate = async (contract: ContractItem) => {
    const name = prompt('模板名称:', contract.contract_name + '模板');
    if (!name) return;
    const r = await fetch(`/api/contracts/${contract.id}/template`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token() },
      body: JSON.stringify({ name, category: contract.contract_type }),
    });
    if (r.ok) { toast('模板已生成', 'success'); fetchContracts(); fetchTemplates(); }
  };

  const handleDepositKnowledge = async (contract: ContractItem) => {
    const r = await fetch('/api/contracts/knowledge/deposit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token() },
      body: JSON.stringify({ contract_id: contract.id }),
    });
    if (r.ok) { toast('合同知识已沉淀到经验库', 'success'); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <BookOpen className="w-6 h-6 text-violet-600" />
            <h1 className="text-lg font-bold text-gray-800">合同管理</h1>
            <span className="text-sm text-gray-400">{filterProject}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setTab('contracts')} className={`px-3 py-1 text-xs rounded-md ${tab === 'contracts' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>合同列表</button>
              <button onClick={() => setTab('templates')} className={`px-3 py-1 text-xs rounded-md ${tab === 'templates' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>模板库({templates.length})</button>
            </div>
            <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-violet-500 text-white rounded-lg text-xs flex items-center gap-1"><Plus size={12} />添加合同</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'templates' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition">
                <div className="flex items-center gap-2 mb-2"><Bookmark size={16} className="text-violet-500" /><h3 className="font-semibold text-gray-800 text-sm">{t.name}</h3></div>
                <p className="text-xs text-gray-500 mb-1">{t.category} · {t.description}</p>
                <p className="text-xs text-gray-400">{t.created_at?.slice(0, 10)}</p>
              </div>
            ))}
            {templates.length === 0 && <p className="text-gray-400 text-sm col-span-3 text-center py-8">暂无模板，AI审查合同后可生成模板</p>}
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                <input value={filterProject} onChange={e => { setFilterProject(e.target.value); }} onKeyDown={e => e.key === 'Enter' && fetchContracts()}
                  placeholder="按项目筛选..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg" />
              </div>
              <button onClick={fetchContracts} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">刷新</button>
            </div>
            {loading ? <p className="text-gray-400 text-sm">加载中…</p> : contracts.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">暂无合同，点击"添加合同"开始</p> : (
              <div className="space-y-3">
                {contracts.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={18} className="text-violet-500" />
                        <div>
                          <h3 className="font-semibold text-gray-800">{c.contract_name}</h3>
                          <p className="text-xs text-gray-400">{c.project_name} · {c.contract_type} · {c.party_a} ↔ {c.party_b} · {c.amount > 0 ? c.amount + '万元' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.review_result && <span className={`px-2 py-0.5 rounded-full text-xs border ${RISK_COLORS[c.risk_level] || RISK_COLORS.medium}`}>
                          {c.risk_level === 'high' ? '高风险' : c.risk_level === 'medium' ? '中风险' : '低风险'}
                        </span>}
                        {c.template_id && <span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700">已模板化</span>}
                      </div>
                    </div>
                    {(c.risk_items as any[])?.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {(c.risk_items as any[]).slice(0, 3).map((ri, i) => (
                          <div key={i} className={`text-xs p-2 rounded ${ri.risk === 'high' ? 'bg-red-50 text-red-700' : ri.risk === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                            <span className="font-medium">{ri.clause || '条款'}: </span>{ri.issue} → {ri.suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleAIReview(c)} disabled={aiReviewing === c.id}
                        className="px-3 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 flex items-center gap-1">
                        <Shield size={12} />{aiReviewing === c.id ? '审查中…' : 'AI审查'}
                      </button>
                      <button onClick={() => handleMakeTemplate(c)} className="px-3 py-1.5 text-xs bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 flex items-center gap-1">
                        <Bookmark size={12} />生成模板
                      </button>
                      <button onClick={() => handleDepositKnowledge(c)} className="px-3 py-1.5 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 flex items-center gap-1">
                        <Download size={12} />沉淀知识
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 mb-4">添加合同</h2>
            <div className="space-y-3">
              {[
                { label: '合同名称*', key: 'contract_name', type: 'text' },
                { label: '合同类型', key: 'contract_type', type: 'text' },
                { label: '甲方', key: 'party_a', type: 'text' },
                { label: '乙方', key: 'party_b', type: 'text' },
                { label: '金额(万元)', key: 'amount', type: 'number' },
                { label: '签订日期', key: 'sign_date', type: 'date' },
              ].map(f => (
                <div key={f.key}><label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              ))}
              <div><label className="block text-xs text-gray-500 mb-1">合同内容(粘贴条款)</label>
                <textarea value={form.content_text} onChange={e => setForm({ ...form, content_text: e.target.value })} rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="粘贴合同核心条款…" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 text-sm border rounded-lg">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 text-sm bg-violet-500 text-white rounded-lg">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManager;
