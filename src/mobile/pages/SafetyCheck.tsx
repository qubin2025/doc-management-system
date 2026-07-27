// 安全检查/问题上报页 — 预警看板 + 现场问题上报闭环
import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, Camera, Send, X } from 'lucide-react';
import { checkNotices, NoticeData, reportIssue, listIssues, updateIssueStatus, IssueItem } from '../data/mobileApi';
import { getAuthToken } from '../../data/api';
import type { MobileProject } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SEVERITY_OPTIONS = [
  { value: 'normal', label: '一般', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'urgent', label: '紧急', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'critical', label: '严重', color: 'bg-red-100 text-red-700 border-red-200' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'reported', label: '已上报' },
  { value: 'processing', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
];

const STATUS_LABEL: Record<string, string> = { reported: '已上报', processing: '处理中', resolved: '已解决', closed: '已关闭' };
const STATUS_COLOR: Record<string, string> = {
  reported: 'bg-slate-100 text-slate-600', processing: 'bg-blue-100 text-blue-600',
  resolved: 'bg-emerald-100 text-emerald-600', closed: 'bg-gray-100 text-gray-400',
};

interface Props {
  project: MobileProject;
  onBack: () => void;
}

const SafetyCheck: React.FC<Props> = ({ project, onBack }) => {
  const [data, setData] = useState<NoticeData | null>(null);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 上报表单
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSeverity, setFormSeverity] = useState('normal');
  const [formAssignee, setFormAssignee] = useState('');
  const [formPhoto, setFormPhoto] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 筛选
  const [statusFilter, setStatusFilter] = useState('all');

  // 干系人下拉
  const [stakeholders, setStakeholders] = useState<{ id: number; name: string; role: string; org: string; contact: string }[]>([]);
  const [stakeholdersLoaded, setStakeholdersLoaded] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    fetch(`${API_BASE}/stakeholders?project=${encodeURIComponent(project.name)}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(res => res.ok ? res.json() : [])
      .then((list: any[]) => {
        setStakeholders(list);
        setStakeholdersLoaded(true);
      })
      .catch(() => { setStakeholdersLoaded(true); });
  }, [project.name]);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      checkNotices().catch(() => null),
      listIssues(project.id, statusFilter === 'all' ? undefined : statusFilter).catch(() => []),
    ]).then(([notices, iss]) => {
      if (notices) setData(notices);
      setIssues(iss);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [project.id]);
  useEffect(() => {
    listIssues(project.id, statusFilter === 'all' ? undefined : statusFilter).then(setIssues).catch(() => {});
  }, [statusFilter]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFormPhoto(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) { setSubmitMsg('请输入问题标题'); return; }
    setSubmitting(true); setSubmitMsg('');
    try {
      await reportIssue({
        projectId: project.id, title: formTitle.trim(), description: formDesc.trim(),
        severity: formSeverity, assignee: formAssignee.trim(), photoData: formPhoto || undefined,
      });
      setSubmitMsg('上报成功！');
      setFormTitle(''); setFormDesc(''); setFormSeverity('normal'); setFormAssignee(''); setFormPhoto('');
      setShowForm(false);
      fetchAll();
    } catch (e: unknown) { setSubmitMsg((e as Error).message || '上报失败'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    await updateIssueStatus(id, newStatus);
    fetchAll();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-2 py-2 flex items-center gap-1 sticky top-0 z-10">
        <button onClick={onBack} className="p-2.5 rounded-lg active:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <h1 className="flex-1 text-base font-semibold text-slate-800">
          {'[!]'} 安全检查 · {project.name}
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-4 pb-24">
        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />检查中…</div>
        )}
        {error && (
          <div className="text-center py-24">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button onClick={fetchAll} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl">重试</button>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{data.urgentCount}</div>
              <div className="text-xs text-slate-500 mt-1">紧急任务</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{data.todayTasks}</div>
              <div className="text-xs text-slate-500 mt-1">今日任务</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-slate-600">{issues.length}</div>
              <div className="text-xs text-slate-500 mt-1">现场问题</div>
            </div>
          </div>
        )}

        {/* 即将到期目标 — 可点击转为问题 */}
        {data && data.upcomingDeadlines.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">即将到期的目标</h2>
            <div className="space-y-2">
              {data.upcomingDeadlines.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  onClick={() => { setFormTitle(`目标逾期: ${d.title}`); setFormDesc(`${d.projectName} - 截止: ${d.deadline?.slice(0,10)}`); setFormSeverity('urgent'); setShowForm(true); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{d.title}</p>
                    <p className="text-xs text-slate-400">{d.projectName} · {d.deadline?.slice(0, 10)}</p>
                  </div>
                  <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'not-started' ? 'text-red-600 bg-red-50' : d.status === 'in-progress' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'}`}>
                    {d.status === 'not-started' ? '未开始' : d.status === 'in-progress' ? '进行中' : '已完成'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 现场问题列表 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">现场问题</h2>
            <div className="flex items-center gap-1">
              {/* 状态筛选 */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => setStatusFilter(s.value)}
                    className={`px-2 py-1 text-xs rounded-md ${statusFilter === s.value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>

          {issues.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">暂无现场问题记录</p>
          ) : (
            <div className="space-y-2">
              {issues.map(iss => (
                <div key={iss.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{iss.title}</p>
                      {iss.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{iss.description}</p>}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_OPTIONS.find(s => s.value === iss.severity)?.color || ''}`}>
                      {SEVERITY_OPTIONS.find(s => s.value === iss.severity)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {iss.assignee && <span>(人) {iss.assignee}</span>}
                    {iss.photoPath && <span>(图) 有照片</span>}
                    <span className="flex-1" />
                    <span>{iss.createdAt?.slice(0, 16)}</span>
                  </div>
                  {/* 状态流转 */}
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-50">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[iss.status]}`}>{STATUS_LABEL[iss.status]}</span>
                    <span className="flex-1" />
                    {iss.status === 'reported' && (
                      <button onClick={() => handleStatusChange(iss.id, 'processing')} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg">开始处理</button>
                    )}
                    {iss.status === 'processing' && (
                      <button onClick={() => handleStatusChange(iss.id, 'resolved')} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 rounded-lg">标记解决</button>
                    )}
                    {(iss.status === 'resolved' || iss.status === 'processing') && (
                      <button onClick={() => handleStatusChange(iss.id, 'closed')} className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg">关闭</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 底部上报按钮 */}
      <div className="fixed bottom-4 left-4 right-4 z-40">
        <button onClick={() => setShowForm(true)}
          className="w-full py-3.5 bg-red-500 text-white text-base font-semibold rounded-2xl shadow-lg active:bg-red-600 flex items-center justify-center gap-2">
          [!] 上报现场问题
        </button>
      </div>

      {/* 上报表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">上报现场问题</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">问题标题 *</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="如：3号楼基坑积水" />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">问题描述</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="描述现场情况、位置、影响范围等" />
              </div>

              {/* 紧急程度 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">紧急程度</label>
                <div className="flex gap-2">
                  {SEVERITY_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setFormSeverity(s.value)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border ${formSeverity === s.value ? s.color + ' border-current' : 'border-slate-200 text-slate-500'}`}>{s.label}</button>
                  ))}
                </div>
              </div>

              {/* 指派处理人 — select下拉，无干系人时退回输入框 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">指派处理人</label>
                {stakeholdersLoaded && stakeholders.length > 0 ? (
                  <select value={formAssignee} onChange={e => setFormAssignee(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                    <option value="">-- 选择处理人 --</option>
                    {stakeholders.map(s => (
                      <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}{s.org ? ` - ${s.org}` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input value={formAssignee} onChange={e => setFormAssignee(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="姓名（可选）" />
                )}
              </div>

              {/* 照片 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">现场照片（可选）</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                {formPhoto ? (
                  <div className="relative inline-block">
                    <img src={formPhoto} className="w-24 h-24 object-cover rounded-xl border border-slate-200" alt="preview" />
                    <button onClick={() => setFormPhoto('')} className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow border border-slate-200 flex items-center justify-center"><X className="w-3 h-3 text-slate-400" /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-1">
                    <Camera className="w-6 h-6" /><span className="text-xs">拍照</span>
                  </button>
                )}
              </div>

              {submitMsg && (
                <div className={`text-sm rounded-xl px-3 py-2 ${submitMsg.includes('成功') ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>{submitMsg}</div>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3 bg-red-500 text-white text-base font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {submitting ? '上报中…' : '提交上报'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyCheck;
