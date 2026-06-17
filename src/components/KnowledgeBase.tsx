import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Search, X, Sparkles, FileText, Loader2, BookOpen } from 'lucide-react';
import { vectorStore, VectorDoc } from '../data/vectorStore';
import * as api from '../data/api';
import { toast } from './Toast';
import lunr from 'lunr';

interface Props { onBack: () => void; }

const KnowledgeBase: React.FC<Props> = ({ onBack }) => {
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'fulltext'|'semantic'|'hybrid'>('fulltext');
  const [results, setResults] = useState<VectorDoc[]>([]);
  const [graphResults, setGraphResults] = useState<{nodes:any[];edges:any[]}|null>(null);
  const [loading, setLoading] = useState(false);
  const [allDocs, setAllDocs] = useState<VectorDoc[]>([]);

  useEffect(() => {
    setAllDocs(vectorStore.getAllDocs());
  }, []);

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
        const ids = new Set<string>(); const merged: VectorDoc[] = [];
        for (const d of [...fulltext.slice(0,5), ...vecHits]) { if(!ids.has(d.id)){ids.add(d.id);merged.push(d);} }
        setResults(merged.slice(0,15));
      } else if (searchMode === 'semantic') {
        const qEmbed = await api.embedText(search.trim(), 'query');
        setResults(vectorStore.searchAll(qEmbed, 10));
      } else {
        if (!lunrIdx) { setResults([]); setLoading(false); return; }
        setResults(lunrIdx.search(search.trim()).map((h: any) => allDocs.find(d => d.id === h.ref)!).filter(Boolean));
      }
    } catch (e: any) { toast('搜索失败: ' + e.message, 'error'); }
    finally { setLoading(false); }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center rounded-lg"><BookOpen className="w-5 h-5 text-white" /></div>
            <h1 className="text-lg font-bold text-gray-800">知识库</h1>
            <span className="text-sm text-gray-400">{allDocs.length}条索引</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
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
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入关键词搜索..." className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm" />
            {search && <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex rounded-lg border overflow-hidden text-xs">
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
          <button onClick={handleShowAll} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">全部</button>
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
