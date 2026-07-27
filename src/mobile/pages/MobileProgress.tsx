import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, CheckCircle2, AlertCircle, TrendingUp, Loader2 } from 'lucide-react';
import { MobileProject } from '../types';
import { ProgressEntry, listProgress, reportProgress } from '../data/mobileApi';

interface Props {
  project: MobileProject;
  onBack: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso || '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso || '';
  }
}

const MobileProgress: React.FC<Props> = ({ project, onBack }) => {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formPercentage, setFormPercentage] = useState(0);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProgress(project.id);
      setEntries(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const avgPercent = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.percentage, 0) / entries.length)
    : 0;
  const matchedCount = entries.filter(e => e.matchStatus === 'matched').length;
  const unmatchedCount = entries.length - matchedCount;

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      await reportProgress({
        projectId: project.id,
        title: formTitle.trim(),
        percentage: formPercentage,
        note: formNote.trim(),
      });
      setFormTitle('');
      setFormPercentage(0);
      setFormNote('');
      setShowForm(false);
      setToast('进度快报已提交');
      setTimeout(() => setToast(''), 2000);
      fetchEntries();
    } catch (e: unknown) {
      setToast((e as Error).message || '提交失败');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 text-slate-500 active:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src="/zhjk-logo.png" alt="中航建科" className="w-7 h-7 shrink-0" />
        <h1 className="text-sm font-semibold text-slate-800 flex-1">进度管理</h1>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Overview Card */}
      <div className="p-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">进度总览</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>

          {/* Average percentage display */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold text-blue-600">{avgPercent}%</span>
            <span className="text-xs text-slate-400">平均进度</span>
          </div>

          {/* Progress bar visual */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${avgPercent}%` }}
            />
          </div>

          {/* Match stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-slate-500">已匹配 {matchedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-slate-500">未匹配 {unmatchedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          添加快报
        </button>
      </div>

      {/* Entries List */}
      <div className="flex-1 px-3 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">暂无进度快报</div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-800 truncate">{entry.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{formatTime(entry.createdAt)}</p>
                    {entry.note && (
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{entry.note}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-lg font-bold text-blue-600">{entry.percentage}%</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      entry.matchStatus === 'matched'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {entry.matchStatus === 'matched' ? '已匹配' : '未匹配'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 animate-slide-up max-h-[85vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-slate-800 mb-4">添加快报</h2>

            {/* Title */}
            <label className="block text-sm text-slate-600 mb-1.5">快报标题</label>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              placeholder="如：基础工程完成、主体结构封顶"
            />

            {/* Percentage Slider */}
            <label className="block text-sm text-slate-600 mb-1.5">
              完成进度 <span className="text-blue-600 font-bold text-base">{formPercentage}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formPercentage}
              onChange={e => setFormPercentage(Number(e.target.value))}
              className="w-full h-2 rounded-full bg-slate-200 appearance-none cursor-pointer accent-blue-600 mb-3"
            />
            <div className="flex justify-between text-xs text-slate-400 -mt-1 mb-3">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>

            {/* Note */}
            <label className="block text-sm text-slate-600 mb-1.5">备注</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
              placeholder="可选：补充说明当前进度情况"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setFormTitle(''); setFormPercentage(0); setFormNote(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 active:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formTitle.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? '提交中…' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileProgress;
