import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface Props {
  context: string; // 反馈上下文（如 "construction-review / 3.1.1"）
  onFeedback?: (type: 'up' | 'down', context: string) => void;
}

const FeedbackButton: React.FC<Props> = ({ context, onFeedback }) => {
  const [rated, setRated] = useState<'up' | 'down' | null>(null);

  const handleRate = (type: 'up' | 'down') => {
    setRated(type);
    // 存储到localStorage
    try {
      const key = `feedback-${context}`;
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...existing, [Date.now()]: type }));
    } catch {}
    onFeedback?.(type, context);
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => handleRate('up')}
        className={`p-1.5 rounded-lg transition text-xs flex items-center gap-1 ${
          rated === 'up' ? 'bg-green-500/20 text-green-400' : 'text-[var(--text-muted)] hover:bg-green-500/10 hover:text-green-400'
        }`} title="有用">
        <ThumbsUp size={14} /> 有用
      </button>
      <button onClick={() => handleRate('down')}
        className={`p-1.5 rounded-lg transition text-xs flex items-center gap-1 ${
          rated === 'down' ? 'bg-red-500/20 text-red-400' : 'text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400'
        }`} title="无用">
        <ThumbsDown size={14} /> 无用
      </button>
    </div>
  );
};

export default FeedbackButton;
