import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Sparkles, FileText, Loader2, BookOpen, RefreshCw, Zap, Play, Pause } from 'lucide-react';
import { vectorStore, VectorDoc } from '../data/vectorStore';
import * as api from '../data/api';
import { toast } from './Toast';
import lunr from 'lunr';
import ModuleHeader from './ModuleHeader';
import { kbSyncService, SyncResult } from '../data/kbSyncService';
import { processQueueOnce, startQueuePoller, stopQueuePoller, getQueueStats } from '../data/kbQueueProcessor';

interface Props { onBack: () => void; }

const LIBS = ['全部', '规程规范', '政策法规', '项目经验', '方案模板', '工程归档'] as const;
const LIFECYCLES = ['全部', '前期工作', '招标采购', '工程施工', '竣工验收', '项目归档'] as const;
const PROFESSIONS = ['全部', '土建', '机电', '市政', '安全', '造价', '合同', '监理'] as const;

const KnowledgeBase: React.FC<Props> = ({ onBack }) => {
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'fulltext'|'semantic'|'hybrid'>('fulltext');
  const [results, setResults] = useState<VectorDoc[]>([]);
  const [graphResults, setGraphResults] = useState<{nodes:any[];edges:any[]}|null>(null);
  const [graphragTrace, setGraphragTrace] = useState<{nodes:any[];edges:any[];context:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const [allDocs, setAllDocs] = useState<VectorDoc[]>([]);
  const [libFilter, setLibFilter] = useState(0);
  const [lifecycle, setLifecycle] = useState(0);
  const [profession, setProfession] = useState(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [queueStats, setQueueStats] = useState({pending:0, processing:0, done:0, failed:0, total:0});
  const [pollMsg, setPollMsg] = useState('');

  // v5.7 迭代4: 用户权限感知 — 加载当前用户可访问项目 + 最高敏感等级
  const [myProjects, setMyProjects] = useState<api.MyProjectAccess[]>([]);
  const [maxSensitivity, setMaxSensitivity] = useState<number>(2);  // 默认 2=机密（全局 admin 或未登录时）
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    // 读取当前用户信息判断是否 admin
    try {
      const auth = JSON.parse(localStorage.getItem('doc-system-auth') || '{}');
      const user = auth?.user;
      if (user?.role === 'admin') {
        setIsAdmin(true);
        setMaxSensitivity(2);
        return;  // 全局 admin 不需要拉取 my-projects（拥有全部权限）
      }
    } catch {}
    // 非 admin 用户：拉取 my-projects 计算 maxSensitivity
    api.fetchMyProjects().then(projects => {
      setMyProjects(projects);
      // 取用户在所有项目中的最高敏感等级
      const maxSens = projects.length > 0 ? Math.max(...projects.map(p => p.sensitivity)) : 0;
      setMaxSensitivity(maxSens);
    }).catch(() => {
      // 拉取失败：保守起见设为 0（仅公开）
      setMaxSensitivity(0);
    });
  }, []);

  // 方案模板库 → 读取 contract_templates
  useEffect(() => {
    if (libFilter !== 4) { setTemplates([]); return; } // 4 = 方案模板
    const t = JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
    fetch('/api/contracts/templates/list', { headers: { Authorization: 'Bearer ' + (t || '') } })
      .then(r => r.json()).then(d => setTemplates(d || [])).catch(() => {});
  }, [libFilter]);

  useEffect(() => {
    // v5.7 迭代4: 加载文档时按用户权限过滤（admin 不过滤，非 admin 按 maxSensitivity 过滤）
    const all = vectorStore.getAllDocs();
    if (isAdmin) {
      setAllDocs(all);
    } else {
      const allowed = new Set((myProjects.length > 0 ? myProjects : []).map(p => p.name));
      setAllDocs(all.filter(d => {
        const sens = d.metadata?.sensitivity ?? 0;
        if (sens > maxSensitivity) return false;
        // 有项目权限列表时，仅显示用户有访问权的项目文档
        if (myProjects.length > 0) {
          const projName = d.metadata?.projectName;
          return !projName || allowed.has(projName);
        }
        return true;
      }));
    }
  }, [isAdmin, myProjects, maxSensitivity]);

  // Lunr 全文索引
  const lunrIdx = useMemo(() => {
    if (allDocs.length === 0) return null;
    return lunr(function (this: any) {
      this.ref('id');
      this.field('text');
      this.field('fileName');
      allDocs.forEach(d => this.add({ id: d.id, text: d.text, fileName: d.metadata?.fileName || '' }));
    });
  }, [allDocs]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true); setGraphResults(null);
    try {
      if (searchMode === 'hybrid') {
        // 混合检索：优先LightRAG，降级本地
        try {
          const r = await api.lightragSearch(search.trim(), 10, 'hybrid');
          if (r?.results) {
            const docs = r.results.filter((x:any)=>x.type!=='graph').map((x:any) => ({
              id: x.source||'', text: x.content||'', embedding: [0], metadata: {fileName:x.source||'', source:x.source||''}, score: x.score||0
            })) as any;
            setResults(docs);
            const g = r.results.find((x:any)=>x.type==='graph');
            if (g) setGraphResults(g);
            return;
          }
        } catch {}
        // 降级：本地全文+向量融合
        const fulltext: VectorDoc[] = lunrIdx ? lunrIdx.search(search.trim()).map((h:any)=>allDocs.find(d=>d.id===h.ref)!).filter(Boolean) : [];
        const qEmbed = await api.embedText(search.trim(), 'query');
        const vecHits = vectorStore.searchAll(qEmbed, 10);
        // v5.7 迭代4: 向量结果二次按 sensitivity 过滤（非 admin 用户）
        const filteredVecHits = isAdmin ? vecHits : vecHits.filter(d => {
          const sens = d.metadata?.sensitivity ?? 0;
          if (sens > maxSensitivity) return false;
          if (myProjects.length > 0) {
            const projName = d.metadata?.projectName;
            return !projName || myProjects.some(p => p.name === projName);
          }
          return sens <= 0;  // 无项目权限用户仅看公开
        });
        const ids = new Set<string>(); const merged: VectorDoc[] = [];
        for (const d of [...fulltext.slice(0,5), ...filteredVecHits]) { if(!ids.has(d.id)){ids.add(d.id);merged.push(d);} }
        setResults(merged.slice(0,15));
      } else if (searchMode === 'semantic') {
        const qEmbed = await api.embedText(search.trim(), 'query');
        const hits = vectorStore.searchAll(qEmbed, 10);
        // v5.7 迭代4: 按 sensitivity 过滤
        setResults(isAdmin ? hits : hits.filter(d => {
          const sens = d.metadata?.sensitivity ?? 0;
          if (sens > maxSensitivity) return false;
          if (myProjects.length > 0) {
            const projName = d.metadata?.projectName;
            return !projName || myProjects.some(p => p.name === projName);
          }
          return sens <= 0;
        }));
      } else {
        if (!lunrIdx) { setResults([]); setLoading(false); return; }
        setResults(lunrIdx.search(search.trim()).map((h: any) => allDocs.find(d => d.id === h.ref)!).filter(Boolean));
      }
    } catch (e: any) { toast('搜索失败: ' + e.message, 'error'); }
    finally { setLoading(false); }
    // 合规查询→GraphRAG溯源
    if (/标准|规范|GB|JGJ|DB|条款|合规|验收/.test(search.trim())) {
      const token = localStorage.getItem('doc-system-token') || JSON.parse(localStorage.getItem('doc-system-auth')||'{}')?.token;
      fetch('/api/kg/graphrag/search?keyword=' + encodeURIComponent(search.trim()) + '&depth=1&seedLimit=5', { headers: { Authorization: 'Bearer ' + (token||'') } })
        .then(r => r.json()).then(d => { if (d.nodes) setGraphragTrace(d); }).catch(() => {});
    } else { setGraphragTrace(null); }
  };

  // 分类统计
  const categories = useMemo(() => {
    const cats: Record<string, number> = {};
    allDocs.forEach(d => {
      const proj = d.metadata?.projectName || '未分类';
      cats[proj] = (cats[proj] || 0) + 1;
    });
    return cats;
  }, [allDocs]);

  const handleShowAll = () => { setResults(allDocs); setSearch(''); };
  const handleClear = () => { setResults([]); setSearch(''); };

  const handleSync = async (forceFull: boolean) => {
    if (syncing) return;
    setSyncing(true); setSyncMsg('开始同步业务数据...');
    try {
      const result = await kbSyncService.syncAll(forceFull, (msg) => setSyncMsg(msg));
      setLastSync(result);
      if (result.success) {
        toast(`同步完成：日报 ${result.daily.synced} 段 / 问题 ${result.issues.synced} 条 / 经验 ${result.experiences.synced} 条，耗时 ${(result.duration / 1000).toFixed(1)}s`, 'success');
        setAllDocs(vectorStore.getAllDocs()); // 刷新列表
      } else {
        toast(`同步失败：${result.error || '未知错误'}`, 'error');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast('同步异常: ' + msg, 'error');
    } finally {
      setSyncing(false);
      setSyncMsg('');
    }
  };

  // 队列轮询：组件卸载时自动停止
  useEffect(() => () => stopQueuePoller(), []);

  // 轮询中：每 3s 刷新队列统计
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => { getQueueStats().then(setQueueStats); }, 3000);
    return () => clearInterval(t);
  }, [polling]);

  const handleTogglePoll = () => {
    if (polling) {
      stopQueuePoller();
      setPolling(false);
      setPollMsg('已停止轮询');
    } else {
      startQueuePoller((msg) => setPollMsg(msg));
      setPolling(true);
      setPollMsg('轮询已启动');
      getQueueStats().then(setQueueStats);
    }
  };

  const handleProcessOnce = async () => {
    setPollMsg('手动处理一批...');
    const r = await processQueueOnce((msg) => setPollMsg(msg));
    setQueueStats(await getQueueStats());
    setAllDocs(vectorStore.getAllDocs());
    if (r.synced > 0) toast(`处理完成：${r.succeeded}/${r.processed} 成功，入库 ${r.synced} 块`, 'success');
    else if (r.processed > 0) toast(`处理完成：${r.succeeded}/${r.processed} 成功，无新数据入库`, 'info');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ModuleHeader
        title="知识库"
        subtitle={`${allDocs.length} 条索引 · 全文/语义/混合检索`}
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        colorClass="blue"
        onBack={onBack}
        backLabel="返回首页"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              title="增量同步：日报/问题/经验 → 向量库"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? (syncMsg || '同步中...') : '同步业务数据'}
            </button>
            <button
              onClick={handleProcessOnce}
              disabled={syncing || polling}
              title="手动处理一批队列任务（拉取 → 入库 → 标记完成）"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              处理队列
            </button>
            <button
              onClick={handleTogglePoll}
              title={polling ? '停止自动轮询（10s 间隔）' : '启动自动轮询（10s 间隔，后台入库）'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                polling
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              }`}
            >
              {polling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {polling ? '停止轮询' : '启动轮询'}
            </button>
          </div>
        }
      />
      {syncing && syncMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-4 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          {syncMsg}
        </div>
      )}
      {lastSync && !syncing && (
        <div className="bg-gray-50 dark:bg-slate-900/40 border-b border-gray-200 dark:border-slate-800 px-4 py-1.5 text-xs text-gray-600 dark:text-slate-400 flex items-center gap-4">
          <span>最近同步：日报 {lastSync.daily.synced} 段 · 问题 {lastSync.issues.synced} 条 · 经验 {lastSync.experiences.synced} 条 · 耗时 {(lastSync.duration / 1000).toFixed(1)}s</span>
          <button onClick={() => handleSync(true)} className="text-emerald-600 dark:text-emerald-400 hover:underline">全量重同步</button>
        </div>
      )}
      {(polling || queueStats.total > 0) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-1.5 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium">
            <span className={`w-2 h-2 rounded-full ${polling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
            {polling ? '队列轮询中' : '队列已停止'}
          </span>
          <span>待处理 <strong className="text-blue-900 dark:text-blue-100">{queueStats.pending}</strong></span>
          <span>处理中 <strong className="text-blue-900 dark:text-blue-100">{queueStats.processing}</strong></span>
          <span>已完成 <strong className="text-blue-900 dark:text-blue-100">{queueStats.done}</strong></span>
          <span className={queueStats.failed > 0 ? 'text-red-600 dark:text-red-400' : ''}>
            失败 <strong>{queueStats.failed}</strong>
          </span>
          {pollMsg && <span className="ml-auto truncate max-w-md text-blue-500 dark:text-blue-400">{pollMsg}</span>}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 w-full">
        {/* 5大知识库选项卡 */}
        <div className="flex gap-1 mb-3 bg-white rounded-xl border p-1 overflow-x-auto">
          {LIBS.map((lib, i) => (
            <button key={lib} onClick={() => setLibFilter(i)}
              className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition ${i === libFilter ? 'bg-blue-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
              {lib}
            </button>
          ))}
        </div>
        {/* 三维筛选 */}
        <div className="flex gap-2 mb-4 text-xs">
          <select value={lifecycle} onChange={e => setLifecycle(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
            {LIFECYCLES.map((l, i) => <option key={l} value={i}>{i === 0 ? '生命周期' : l}</option>)}
          </select>
          <select value={profession} onChange={e => setProfession(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
            {PROFESSIONS.map((p, i) => <option key={p} value={i}>{i === 0 ? '专业' : p}</option>)}
          </select>
          {libFilter > 0 && <span className="px-2 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs">{LIBS[libFilter]} · {LIFECYCLES[lifecycle] !== '全部' ? LIFECYCLES[lifecycle] + ' · ' : ''}{PROFESSIONS[profession] !== '全部' ? PROFESSIONS[profession] : '全部专业'}</span>}
        </div>
        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">索引总量</div><div className="text-2xl font-black text-blue-600">{allDocs.length}</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">项目数</div><div className="text-2xl font-black text-purple-600">{Object.keys(categories).length}</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">向量维度</div><div className="text-2xl font-black text-green-600">768</div></div>
        </div>

        {/* 搜索栏 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入关键词搜索..." className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
            {search && <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            {(['fulltext','semantic','hybrid'] as const).map(m => (
              <button key={m} onClick={() => setSearchMode(m)}
                className={`px-2.5 py-1.5 ${searchMode===m?'bg-blue-500 text-white':'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {m==='fulltext'?'全文':m==='semantic'?<><Sparkles className="w-3 h-3 inline mr-0.5"/>语义</>:<><Sparkles className="w-3 h-3 inline mr-0.5"/>混合</>}
              </button>
            ))}
          </div>
          <button onClick={handleSearch} disabled={loading} className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
          </button>
          <button onClick={handleShowAll} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">全部</button>
        </div>

        {/* 分类 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.entries(categories).map(([c, n]) => (
            <button key={c} onClick={() => { setSearch(c); handleSearch(); }}
              className="px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100">{c} ({n})</button>
          ))}
        </div>

        {/* 图谱搜索结果 */}
        {graphResults && graphResults.nodes && graphResults.nodes.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4">
            <h3 className="text-xs font-semibold text-purple-600 mb-2">知识图谱匹配 ({graphResults.nodes.length}节点 · {graphResults.edges?.length||0}关系)</h3>
            <div className="flex flex-wrap gap-2">
              {graphResults.nodes.map((n:any) => (
                <span key={n.id} className={`px-2 py-0.5 rounded-full text-[10px] ${n.type==='STANDARD'?'bg-blue-50 text-blue-600':n.type==='LOCATION'?'bg-green-50 text-green-600':'bg-gray-100 text-gray-600'}`}>{n.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* 方案模板 + GraphRAG 溯源 */}
        {libFilter === 4 && templates.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4"><h3 className="text-xs font-semibold text-violet-700 mb-2">方案模板 ({templates.length})</h3>
            {templates.map((t: any) => <div key={t.id} className="flex gap-3 p-2 bg-violet-50 rounded-lg text-sm"><span className="font-medium">{t.name}</span><span className="text-xs text-gray-400">{t.category}</span><span className="text-xs text-gray-400 ml-auto">{t.created_at?.slice(0, 10)}</span></div>)}
          </div>
        )}
        {graphragTrace?.nodes && graphragTrace.nodes.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4 mb-4">
            <h3 className="text-xs font-semibold text-indigo-700 mb-2">GraphRAG 标准溯源 ({graphragTrace.nodes.length}节点)</h3>
            <div className="flex flex-wrap gap-1.5">{graphragTrace.nodes.map((n: any) => <span key={n.id||n.label} className="px-2 py-0.5 rounded-full text-xs bg-white border border-indigo-200 text-indigo-700">{n.label?.slice(0,50)}</span>)}</div>
            {graphragTrace.edges && graphragTrace.edges.length > 0 && <div className="mt-2 text-xs text-indigo-500">{graphragTrace.edges.slice(0,5).map((e:any,i:number)=><span key={i} className="mr-3">{e.from}→{e.type}→{e.to}</span>)}</div>}
          </div>
        )}

        {/* 搜索结果 */}
        <div className="space-y-3">
          {(results.length === 0 && !graphResults) || (results.length === 0 && searchMode!=='hybrid') ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">知识库为空</p>
              <p className="text-xs mt-1">在项目资料管理页上传文件后自动索引至此处</p>
            </div>
          ) : (
            results.map((doc, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 hover:border-blue-200 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-gray-700">{doc.metadata?.fileName || '未知文档'}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-gray-400">
                    {doc.metadata?.projectName && <span>{doc.metadata.projectName}</span>}
                    {doc.metadata?.uploadTime && <span>{new Date(doc.metadata.uploadTime).toLocaleDateString('zh-CN')}</span>}
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-3">{doc.text?.slice(0, 300)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
