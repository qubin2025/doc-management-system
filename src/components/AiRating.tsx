// AI 输出质量评分组件 — 👍👎 评分 + 可选文字反馈
import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface Props {
  module: string;        // 'review' | 'chat' | 'generate' | 'fill'
  context: string;       // 项目名或对话ID
  resultPreview: string; // 评分对象摘要（前100字）
  compact?: boolean;
}

const AI_RATE_API = '/api/ai/rate';

const AiRating: React.FC<Props> = ({ module, context, resultPreview, compact }) => {
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitRating = async (rating: 'up' | 'down', fb?: string) => {
    setRated(rating);
    try {
      await fetch(AI_RATE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('doc-system-token') || ''}` },
        body: JSON.stringify({ module, context, rating, resultPreview: resultPreview.slice(0, 200), feedback: fb || '' }),
      });
    } catch { /* 评分非关键路径，静默失败 */ }
  };

  const handleRate = (r: 'up' | 'down') => {
    if (rated) return;
    submitRating(r);
    if (r === 'down') setShowFeedback(true);
    else setSubmitted(true);
  };

  const handleFeedbackSubmit = () => {
    submitRating('down', feedback);
    setShowFeedback(false);
    setSubmitted(true);
  };

  if (submitted) {
    return compact ? null : (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <ThumbsUp className="w-3 h-3" /> 已反馈
      </div>
    );
  }

  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-2'}`}>
      <span className={`text-xs ${compact ? 'hidden' : 'text-gray-400'}`}>评价:</span>
      <button onClick={() => handleRate('up')}
        className={`p-1 rounded transition-colors ${rated === 'up' ? 'text-emerald-500 bg-emerald-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
        title="有用"><ThumbsUp className={compact ? 'w-3 h-3' : 'w-4 h-4'} /></button>
      <button onClick={() => handleRate('down')}
        className={`p-1 rounded transition-colors ${rated === 'down' ? 'text-red-400 bg-red-50' : 'text-gray-400 hover:text-red-400 hover:bg-red-50'}`}
        title="需改进"><ThumbsDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} /></button>

      {showFeedback && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowFeedback(false)}>
          <div className="bg-white rounded-t-2xl p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">哪里需要改进？</h4>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请简单描述问题（可选）" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setShowFeedback(false); setSubmitted(true); }} className="flex-1 py-2 text-sm text-gray-500 rounded-xl">跳过</button>
              <button onClick={handleFeedbackSubmit} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-xl">提交反馈</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiRating;
