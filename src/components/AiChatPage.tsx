import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Sparkles, Plus, MessageSquare, Trash2, Edit3, Download, Paperclip, Image, ChevronDown, BarChart3, Phone, Mic, Share2, Copy, Check, FileText, Clock, AlertTriangle } from 'lucide-react';
import * as api from '../data/api';
import { ChatMessage } from '../types';
import { ragQuery, getIndexStats } from '../data/ragService';

const MODELS = ['自动选择', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-r1', 'qwen-turbo', 'glm-4-plus', 'glm-4-flash', 'ollama-qwen', 'ollama-llama'];
const REPORT_TEMPLATES: Record<string, string> = {
  '自由对话': '',
  '项目进度报告': '请按以下格式输出：项目进度报告\n• 项目名称\n• 报告周期\n• 总体进度\n• 已完成里程碑\n• 进行中工作\n• 风险与问题\n• 下期计划',
  '项目管理报告': '请按以下格式输出：项目管理报告\n• 项目概况\n• 安全管理\n• 质量管理\n• 进度管理\n• 成本管理\n• 问题与建议',
  '项目审核报告': '请按以下格式输出：项目审核报告\n• 审核范围\n• 审核发现\n• 合规性评估\n• 整改建议\n• 审核结论',
};

// 右侧业务卡片
const BUSINESS_CARDS = [
  { icon: <FileText className="w-4 h-4" />, title: '项目管理报告', desc: '一键生成项目管理报告', template: '项目管理报告' },
  { icon: <Check className="w-4 h-4" />, title: '项目审核报告', desc: '合规性与问题审核', template: '项目审核报告' },
  { icon: <Clock className="w-4 h-4" />, title: '项目周工作报告', desc: '本周工作与下周计划', template: '自由对话' },
  { icon: <AlertTriangle className="w-4 h-4" />, title: '项目风险分析', desc: '风险识别与应对策略', template: '自由对话' },
];
const COMING_SOON = ['成本分析报告', '质量评估报告', '合同审核报告', '竣工验收报告'];

// 格式化回答：保留结构但去除MD标记
function formatContent(text: string): string {
  return text
    .replace(/^#{2,4}\s+/gm, '▎')    // ## → 小节标记
    .replace(/^#\s+/gm, '')           // # → 去除
    .replace(/\*\*(.+?)\*\*/g, '【$1】') // **粗体** → 【粗体】
    .replace(/^[-*]\s(.+)/gm, '• $1')   // 列表
    .replace(/^(\d+)[.)]\s(.+)/gm, '$1. $2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^---+\s*$/gm, '')
    .trim();
}

const AiChatPage: React.FC<{
  onBack: () => void;
  projectName?: string; standard?: string; initialQuery?: string;
}> = ({ onBack, projectName, standard, initialQuery }) => {
  const [sessions, setSessions] = useState<{ id: string; title: string; messages: ChatMessage[] }[]>(() => {
    const s = localStorage.getItem('ai-sessions');
    return s ? JSON.parse(s) : [];
  });
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(() => localStorage.getItem('ai-model') || 'deepseek-v4-pro');
  const [template, setTemplate] = useState('自由对话');
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; url: string; isImage: boolean }[]>([]);
  const [msgAttachments, setMsgAttachments] = useState<Map<number, { file: File; url: string; isImage: boolean }[]>>(new Map());
  const [thinkingText, setThinkingText] = useState('');
  const imageB64Ref = useRef<string[]>([]); // 存储图片base64数据
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [shared, setShared] = useState(false);
  const [ragMode, setRagMode] = useState(true); // RAG检索增强 默认开启
  const ragSourcesRef = useRef<{ fileName: string; text: string }[]>([]);
  const [ragCount, setRagCount] = useState(0);

  // 定期刷新索引统计 + 全局模式
  useEffect(() => {
    const update = () => {
      if (projectName) {
        setRagCount(getIndexStats(projectName).count);
      } else {
        // 全局模式 — 汇总所有项目
        let total = 0;
        try {
          const projects = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]')
            .concat(JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'));
          const seen = new Set<string>();
          for (const p of projects) { if (p.name && !seen.has(p.name)) { seen.add(p.name); total += getIndexStats(p.name).count; } }
        } catch {}
        setRagCount(total);
      }
    };
    update();
    const timer = setInterval(update, 3000);
    return () => clearInterval(timer);
  }, [projectName]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const active = sessions.find(s => s.id === activeId);
  const messages = active?.messages || [];

  // 生成延伸建议
  const genSuggestions = (lastMsg: string): string[] => {
    const s: string[] = [];
    if (lastMsg.includes('进度') || lastMsg.includes('完成')) s.push('下一步关键工作是什么', '有哪些风险需要注意');
    else if (lastMsg.includes('安全') || lastMsg.includes('风险')) s.push('如何制定预防措施', '同类项目常见安全问题');
    else if (lastMsg.includes('质量') || lastMsg.includes('验收')) s.push('质量控制要点有哪些', '验收标准是什么');
    else if (lastMsg.includes('成本') || lastMsg.includes('费用')) s.push('如何优化成本', '预算控制建议');
    if (s.length === 0) s.push('展开详细说明', '给出具体建议', '列举注意事项');
    return s;
  };

  useEffect(() => { localStorage.setItem('ai-sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const initRef = useRef(false);
  useEffect(() => {
    if (initialQuery && !activeId && !initRef.current) {
      initRef.current = true;
      handleNewSession(initialQuery);
    }
  }, []); // eslint-disable-line

  const handleDelete = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) setActiveId('');
  };

  const doChat = async (_q: string, sid: string, allMsgs: ChatMessage[]) => {
    const systemHint = template !== '自由对话' ? REPORT_TEMPLATES[template] : '';
    const msgs: { role: string; content: string }[] = [...allMsgs];
    if (systemHint) msgs.push({ role: 'system', content: systemHint });

    // 始终构建全局项目上下文
    let globalContext = '';
    try {
      const projects = JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T695-2025') || '[]')
        .concat(JSON.parse(localStorage.getItem('doc-mgmt-projects-DB11/T808-2020') || '[]'));
      const seen = new Set<string>(); const projList: string[] = [];
      for (const p of projects) { if (p.name && !seen.has(p.name)) { seen.add(p.name); projList.push(p.name); } }
      if (projList.length > 0) {
        globalContext = '【系统全部项目】\n' + projList.map((n, i) => `${i + 1}. ${n}`).join('\n');
      }
    } catch {}

    // RAG检索 — 优先当前项目，始终附加全局列表
    let ragContext = globalContext;
    if (ragMode && projectName && ragCount > 0) {
      try {
        const result = await ragQuery(_q, projectName, { topK: 3 });
        if (result.sources.length > 0) {
          ragSourcesRef.current = result.sources.map(s => ({ fileName: s.metadata?.fileName || '未知文档', text: s.text.slice(0, 200) }));
          ragContext = `【当前项目: ${projectName}】\n` + result.sources.map((s, i) => `[参考${i + 1}: ${s.metadata?.fileName}] ${s.text.slice(0, 600)}`).join('\n\n') + '\n\n' + globalContext;
        }
      } catch {}
    }

    if (ragContext && msgs.length > 0) {
      msgs[0] = { ...msgs[0], content: `[系统数据]\n${ragContext}\n\n---\n用户问题: ${msgs[0].content}` };
    }

    // 模拟思考过程
    const thinkingSteps = ragContext
      ? ['检索项目文档...', '匹配相关内容...', '分析上下文...', '生成回复...']
      : ['正在分析问题...', '检索相关知识...', '整理回答思路...', '生成回复内容...'];
    let step = 0;
    const timer = setInterval(() => {
      if (step < thinkingSteps.length) { setThinkingText(thinkingSteps[step]); step++; }
    }, 800);

    // 准备文件内容
    const fileContents = filePreviews.map(p => ({ name: p.file.name, content: (p as any).text || '' })).filter(f => f.content);
    const reply = await api.aiChat(msgs, '', { projectName, standard, model: model === '自动选择' ? 'auto' : model, images: imageB64Ref.current, files: fileContents });
    clearInterval(timer);
    setThinkingText('');

    const formatted = formatContent(reply);
    setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: [...s.messages, { role: 'assistant', content: formatted }] } : s));
  };

  const handleNewSession = async (query?: string) => {
    const q = query || input.trim();
    if (!q) return;
    const id = Date.now().toString();
    const title = q.slice(0, 15) + (q.length > 15 ? '…' : '');
    const newSession = { id, title, messages: [{ role: 'user' as const, content: q }] };
    setSessions(prev => [newSession, ...prev]);
    setActiveId(id);
    setInput('');
    setFiles([]);
    setLoading(true);
    try { await doChat(q, id, [{ role: 'user', content: q }]); }
    catch (e: any) {
      const msg = e.message || '';
      const hint = msg.includes('Failed to fetch') ? ' [后端未运行或网络不通，请检查 localhost:3000]' :
                   msg.includes('401') ? ' [登录已过期，请重新登录]' : '';
      setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: [...s.messages, { role: 'assistant', content: `AI请求失败: ${msg}${hint}\n\n请在 backend/.env 中确认 DEEPSEEK_API_KEY 已正确配置。` }] } : s));
    }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    let sid = activeId;
    if (!sid) {
      sid = Date.now().toString();
      const title = q.slice(0, 15) + (q.length > 15 ? '…' : '');
      setSessions(prev => [{ id: sid, title, messages: [] }, ...prev]);
      setActiveId(sid);
    }
    const userMsg: ChatMessage = { role: 'user', content: q };
    const msgIdx = (sessions.find(s => s.id === sid)?.messages.length || 0);
    setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: [...s.messages, userMsg] } : s));
    if (filePreviews.length > 0) {
      setMsgAttachments(prev => new Map(prev).set(msgIdx, [...filePreviews]));
    }
    setInput('');
    const currentFiles = [...files];
    setFiles([]);
    setFilePreviews([]);
    setLoading(true);
    try {
      let ctx = q;
      if (currentFiles.length > 0) {
        const result = await readFilesAsContext(currentFiles);
        imageB64Ref.current = result.images;
        ctx = result.text ? `${result.text}\n\n${q}` : q;
      }
      await doChat(ctx, sid, [...(sessions.find(s => s.id === sid)?.messages || []), userMsg]);
    }
    catch (e: any) { setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: [...s.messages, { role: 'assistant', content: '请求失败: ' + (e.message || '') }] } : s)); }
    finally { setLoading(false); }
  };

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const isImage = f.type.startsWith('image/');
      const url = isImage ? URL.createObjectURL(f) : '';
      setFilePreviews(prev => [...prev, { file: f, url, isImage }]);
    });
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setFilePreviews(prev => { const p = prev[idx]; if (p?.url) URL.revokeObjectURL(p.url); return prev.filter((_, i) => i !== idx); });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  // 读取文件内容（图片base64存入ref，文本读内容）
  const readFilesAsContext = async (files: File[]): Promise<{ text: string; images: string[] }> => {
    const parts: string[] = [];
    const imgB64s: string[] = [];
    for (const f of files.slice(0, 5)) {
      if (f.type.startsWith('image/')) {
        const b64 = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(f);
        });
        imgB64s.push(b64);
        parts.push(`[图片: ${f.name}]`);
      } else if (f.size < 1024 * 1024) {
        try { const txt = await f.text(); parts.push(`【文件: ${f.name}】\n${txt.slice(0, 3000)}`); }
        catch { parts.push(`[文件: ${f.name}]`); }
      } else {
        parts.push(`[文件: ${f.name} (${(f.size/1024/1024).toFixed(1)}MB)]`);
      }
    }
    return { text: parts.join('\n\n'), images: imgB64s };
  };

  const handleShare = () => {
    const text = messages.map(m => `${m.role === 'user' ? '我' : 'AI'}：${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => { setShared(true); setTimeout(() => setShared(false), 2000); });
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* ===== 顶部固定栏 ===== */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <h1 className="text-base font-semibold text-gray-800">{active?.title || 'AI 对话'}</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{model}</span>
          {ragCount > 0 && (
            <button onClick={() => setRagMode(!ragMode)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${ragMode ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400'}`}
              title={`RAG检索${ragMode ? '已开启' : '已关闭'} (${ragCount}个文档索引)`}>
              RAG{ragMode ? ' ON' : ' OFF'} · {ragCount}篇
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleShare} className={`p-2 rounded-lg text-sm transition-colors ${shared ? 'text-green-500 bg-green-50' : 'text-gray-500 hover:bg-gray-100'}`} title="分享对话">
            {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button onClick={() => { if (activeId && confirm('清除当前对话内容？')) { setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [] } : s)); } }}
            className="p-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors" title="清除当前对话">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="语音输入"><Mic className="w-4 h-4" /></button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="语音通话"><Phone className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ===== 左侧固定栏 ===== */}
        <aside className="w-60 bg-gray-50/50 border-r border-gray-100 flex flex-col shrink-0">
          <div className="p-3">
            <button onClick={() => handleNewSession()} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors font-medium">
              <Plus className="w-4 h-4" /> 新对话
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {sessions.map(s => (
              <div key={s.id} onClick={() => setActiveId(s.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${
                  activeId === s.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                <span className="flex items-center gap-2 truncate flex-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="truncate text-[15px]">{s.title}</span>
                </span>
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button onClick={e => { e.stopPropagation(); const t = prompt('重命名', s.title); if (t) setSessions(p => p.map(x => x.id === s.id ? { ...x, title: t } : x)); }} className="p-0.5 text-gray-400 hover:text-blue-500"><Edit3 className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(s.id); }} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ===== 右侧对话区（滚动的消息 + 固定模板/输入） ===== */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* 模板 + 上下文 */}
          <div className="shrink-0 px-6 py-2 border-b border-gray-50 flex items-center justify-between bg-white">
            <span className="text-sm text-gray-400"><BarChart3 className="w-3 h-3 inline mr-1" />{active?.messages.reduce((s, m) => s + m.content.length, 0) || 0} 字</span>
            <div className="relative">
              <button onClick={() => setShowTemplateMenu(!showTemplateMenu)} className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">模板: {template} <ChevronDown className="w-3 h-3" /></button>
              {showTemplateMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-30 p-1 min-w-[140px]">
                  {Object.keys(REPORT_TEMPLATES).map(t => (
                    <button key={t} onClick={() => { setTemplate(t); setShowTemplateMenu(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded ${template === t ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 消息滚动区 */}
          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <Sparkles className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-base font-medium text-gray-400">全过程工程咨询 AI</p>
                <p className="text-sm mt-1 text-gray-300">基于项目数据，自由对话</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[75%]">
                  {m.role === 'user' ? (
                    <div>
                      {/* 附件缩略图（在消息气泡上方） */}
                      {msgAttachments.has(i) && (
                        <div className="flex gap-2 mb-2 justify-end flex-wrap">
                          {msgAttachments.get(i)!.map((att, ai) => (
                            <div key={ai} className="relative">
                              {att.isImage ? (
                                <img src={att.url} alt={att.file.name} className="w-32 h-32 object-cover rounded-xl border-2 border-blue-200 shadow-sm" />
                              ) : (
                                <div className="w-32 h-32 bg-gray-100 rounded-xl border-2 border-blue-200 flex flex-col items-center justify-center text-sm text-gray-500 p-2">
                                  <FileText className="w-6 h-6 mb-1" />{att.file.name.slice(0, 10)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="bg-blue-500 text-white rounded-2xl rounded-br-md px-5 py-3 text-[15px] leading-relaxed">{m.content}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[15px] leading-loose text-gray-800 whitespace-pre-wrap">{m.content}</div>
                      {/* 操作栏 */}
                      <div className="flex items-center gap-2 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                        <button onClick={() => navigator.clipboard.writeText(m.content)} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="复制"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + m.content])); a.download = `AI回复.txt`; a.click(); }} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="下载"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                      {/* 延伸建议 */}
                      {i === messages.length - 1 && m.role === 'assistant' && !loading && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="text-sm text-gray-400">💡</span>
                          {genSuggestions(m.content).map((s, si) => (
                            <button key={si} onClick={async () => {
                              const sq = s; let sid = activeId;
                              if (!sid) { sid = Date.now().toString(); setSessions(p => [{ id: sid, title: sq.slice(0, 15), messages: [] }, ...p]); setActiveId(sid); }
                              const um: ChatMessage = { role: 'user', content: sq };
                              setSessions(p => p.map(x => x.id === sid ? { ...x, messages: [...x.messages, um] } : x));
                              setLoading(true);
                              try { await doChat(sq, sid, [...(sessions.find(x => x.id === sid)?.messages || []), um]); }
                              catch (e: any) { setSessions(p => p.map(x => x.id === sid ? { ...x, messages: [...x.messages, { role: 'assistant', content: '请求失败' }] } : x)); }
                              finally { setLoading(false); }
                            }}
                              className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 rounded-2xl rounded-bl-md px-5 py-4 max-w-[70%]">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span className="text-sm font-medium text-gray-600">思考中</span>
                    <span className="text-sm text-gray-400">{thinkingText || '正在分析...'}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2.5 h-2.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <div className="w-2.5 h-2.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* 底部固定输入区 — 豆包风格 */}
          <div className="shrink-0 border-t border-gray-100 px-6 py-3 bg-white">
            <div className="max-w-3xl mx-auto">
              {/* 文件预览缩略图 */}
              {filePreviews.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {filePreviews.map((fp, i) => (
                    <div key={i} className="relative group">
                      {fp.isImage ? (
                        <img src={fp.url} alt={fp.file.name} className="w-14 h-14 object-cover rounded-lg border" />
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-sm rounded-full"><FileText className="w-3 h-3" />{fp.file.name.slice(0,12)}</span>
                      )}
                      <button onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                </div>
              )}
              {/* 输入框 — 默认3行 */}
              <div className="bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 focus-within:shadow-lg shadow-sm transition-all">
                <textarea
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={loading}
                  rows={input ? Math.min(input.split('\n').length + 1, 6) : 3}
                  placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-gray-400 px-4 pt-3 pb-1 resize-none" />
                {/* 底部工具栏 — 独立一行 */}
                <div className="flex items-center justify-between px-3 pb-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => fileRef.current?.click()} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="上传文件"><Paperclip className="w-4 h-4" /></button>
                    <button onClick={() => imgRef.current?.click()} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="上传图片"><Image className="w-4 h-4" /></button>
                    <input ref={fileRef} type="file" className="hidden" multiple onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files!)); }} />
                    <input ref={imgRef} type="file" className="hidden" multiple accept="image/*" onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files!)); }} />
                    <button onClick={() => folderRef.current?.click()} className="px-2 py-1 text-[15px] text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="选择项目文件夹">📁 项目文件</button>
                    <input ref={folderRef} type="file" className="hidden" /* @ts-ignore */ {...{webkitdirectory:'',directory:'',multiple:true}} onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files!)); }} />
                    <span className="text-[15px] text-gray-400 ml-2">{input.length} 字</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button onClick={() => setShowModelMenu(!showModelMenu)} className="flex items-center gap-0.5 px-2 py-1 text-[15px] text-gray-400 hover:text-gray-600 rounded-lg">
                        <Sparkles className="w-3 h-3" />{model==='自动选择'?'自动':model.split('-').pop()}
                      </button>
                      {showModelMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-44 bg-white border rounded-xl shadow-xl z-30 p-1">
                          {MODELS.map(m => (
                            <button key={m} onClick={() => { setModel(m); localStorage.setItem('ai-model', m); setShowModelMenu(false); }}
                              className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg ${model===m?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50'}`}>{m}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={handleSend} disabled={loading || (!input.trim() && filePreviews.length===0)}
                      className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors shadow-sm">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ===== 右侧业务卡片栏 ===== */}
        <aside className="w-52 bg-gray-50/30 border-l border-gray-100 shrink-0 hidden xl:flex flex-col py-4 px-3">
          <p className="text-sm font-medium text-gray-500 mb-3 px-1">业务模板</p>
          <div className="space-y-2">
            {BUSINESS_CARDS.map((card, i) => (
              <button key={i} onClick={() => { setTemplate(card.template); setInput(card.template === '自由对话' ? `请生成${card.title}` : ''); }}
                className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all bg-gray-50 shadow-sm">
                <div className="flex items-center gap-2 mb-1">{card.icon}<span className="text-sm font-semibold">{card.title}</span></div>
                <p className="text-[10px] opacity-60">{card.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-[10px] font-medium text-gray-400 mb-2 px-1">即将上线</p>
            {COMING_SOON.map((name, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />{name}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AiChatPage;
