import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Cpu, Terminal, FolderOpen, FileText } from 'lucide-react';
import { ChatMessage } from '../types';
import * as api from '../data/api';

interface AiChatProps {
  onClose: () => void;
  projectName?: string;
  standard?: string;
  colorClass?: string;
}

const AiChat: React.FC<AiChatProps> = ({ onClose, projectName, standard, colorClass = 'blue' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: projectName ? `已连接。当前分析项目：${projectName}。有什么需要帮助的？` : '已连接。有什么需要帮助的？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useProjectCtx, setUseProjectCtx] = useState(!!projectName);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setLoading(true);

    try {
      const reply = await api.aiChat(
        [...messages, newMsg],
        '',
        { projectName: useProjectCtx ? projectName : '', standard: standard || '' }
      );
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ ' + (e.message || 'AI 请求失败') }]);
    } finally {
      setLoading(false);
    }
  };

  const colorMap = {
    blue: { btn: 'bg-blue-500 hover:bg-blue-600', glow: 'shadow-blue-500/30' },
    teal: { btn: 'bg-teal-600 hover:bg-teal-700', glow: 'shadow-teal-500/30' },
  };
  const colors = colorMap[colorClass as keyof typeof colorMap] || colorMap.blue;

  return (
    <div className="fixed bottom-0 right-0 w-full sm:w-[420px] h-[600px] sm:bottom-4 sm:right-4 sm:h-[580px] bg-gray-900 rounded-t-xl sm:rounded-xl shadow-2xl border border-gray-700 flex flex-col z-40 animate-in">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClass === 'teal' ? 'bg-teal-600' : 'bg-blue-500'}`}>
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-200 font-mono">AI 助手</span>
            <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-green-900 text-green-400 font-mono">DeepSeek</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
              m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-green-400 border border-gray-700'
            }`}>
              {m.role === 'assistant' && (
                <span className="text-[10px] text-gray-500 block mb-1">{'>'} ai</span>
              )}
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-xs pl-1">
            <Terminal className="w-3 h-3" />
            <span className="animate-pulse">▊</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 上下文选择 */}
      <div className="px-3 py-2 border-t border-gray-700 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setUseProjectCtx(!useProjectCtx)}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
            useProjectCtx ? 'bg-green-900 text-green-400 border border-green-700' : 'bg-gray-800 text-gray-500 border border-gray-700'
          }`}>
          {useProjectCtx ? <FolderOpen className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
          {useProjectCtx ? (projectName ? `项目: ${projectName}` : '项目上下文') : '通用模式'}
        </button>
      </div>

      {/* 输入区 */}
      <div className="px-3 py-2 border-t border-gray-700 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="输入消息..."
          disabled={loading}
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className={`p-2 rounded-lg text-white transition-colors disabled:opacity-30 ${colors.btn}`}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AiChat;
