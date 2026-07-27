import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Calendar, Cloud, Users, Wrench, Box, Shield,
  Plus, Loader2, ChevronDown, ChevronUp, Trash2, Camera, FileText,
  AlertTriangle, Building, X
} from 'lucide-react';
import { MobileProject } from '../types';
import {
  DailyReportFull, MachineryItem, MaterialItem, TaskItem,
  QualityRiskItem, IssueItem2, SubmitDailyReportParams,
  listDailyReports, submitDailyReport, uploadDailyFile, updateDailyReport
} from '../data/mobileApi';

interface Props {
  project: MobileProject;
  onBack: () => void;
}

const WEATHER_OPTIONS = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '暴雨', '小雪', '中雪', '大雪', '雾', '霾', '风', '沙尘'];
const ALERT_TYPES = ['', '高温', '暴雨', '大风', '雷电', '冰雹', '暴雪', '大雾', '沙尘暴'];
const ALERT_LEVELS = ['', '蓝', '黄', '橙', '红'];

const todayStr = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ========== Helper: Add/remove dynamic list items ==========
function newMachinery(): MachineryItem { return { name: '', spec: '', count: 0 }; }
function newMaterial(): MaterialItem { return { name: '', spec: '', quantity: '', note: '' }; }
function newTask(): TaskItem { return { area: '', description: '', workersAM: 0, workersPM: 0, workers: 0, todayPct: '', totalPct: '', schedule: '', contractor: '' }; }
function newQualityRisk(): QualityRiskItem { return { name: '', startDate: '', inspected: '', inspectionResult: '', hazard: '' }; }
function newIssue(): IssueItem2 { return { problem: '', cause: '', delayDays: 0, measures: '', needHelp: '' }; }

// ========== Section component (accordion) ==========
const FormSection: React.FC<{
  title: string; icon: React.ReactNode; defaultOpen?: boolean;
  children: React.ReactNode; badge?: string;
}> = ({ title, icon, defaultOpen = false, children, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="text-blue-500">{icon}</span>
          {title}
          {badge && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">{badge}</span>}
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

// ========== Main Component ==========
const MobileDailyReport: React.FC<Props> = ({ project, onBack }) => {
  const [reports, setReports] = useState<DailyReportFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // === Form State (曙光 template 8 sections) ===

  // Section 1: 基本情况
  const [reportDate, setReportDate] = useState(todayStr());
  const [weatherDay, setWeatherDay] = useState('晴');
  const [weatherNight, setWeatherNight] = useState('');
  const [weatherAlert, setWeatherAlert] = useState('');
  const [weatherAlertLevel, setWeatherAlertLevel] = useState('');

  // Section 2: 现场人员
  const [managersMain, setManagersMain] = useState(0);
  const [managersLabor, setManagersLabor] = useState(0);
  const [managersSpecialty, setManagersSpecialty] = useState(0);
  const [workersMain, setWorkersMain] = useState(0);
  const [workersLabor, setWorkersLabor] = useState(0);
  const [workersSpecialty, setWorkersSpecialty] = useState(0);
  const [workersSpecial, setWorkersSpecial] = useState(0);

  // Section 3: 机械设备
  const [machinery, setMachinery] = useState<MachineryItem[]>([newMachinery()]);

  // Section 4: 材料情况
  const [materials, setMaterials] = useState<MaterialItem[]>([newMaterial()]);

  // Section 5: 施工管理
  const [tasks, setTasks] = useState<TaskItem[]>([newTask()]);

  // Section 6: 质量危大
  const [qualityRisks, setQualityRisks] = useState<QualityRiskItem[]>([newQualityRisk()]);

  // Section 7: 需协调问题
  const [issues, setIssues] = useState<IssueItem2[]>([newIssue()]);

  // Section 8: 施工照片
  const [photos, setPhotos] = useState<string[]>([]);

  // Notes
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Compute totals
  const workersTotal = managersMain + managersLabor + managersSpecialty
    + workersMain + workersLabor + workersSpecialty + workersSpecial;
  const machineryTotal = machinery.reduce((s, m) => s + (m.count || 0), 0);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDailyReports(project.id);
      setReports(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const grouped = reports.reduce((acc: Record<string, DailyReportFull[]>, r) => {
    const key = r.reportDate;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const resetForm = () => {
    setEditingId(null);
    setReportDate(todayStr());
    setWeatherDay('晴'); setWeatherNight(''); setWeatherAlert(''); setWeatherAlertLevel('');
    setManagersMain(0); setManagersLabor(0); setManagersSpecialty(0);
    setWorkersMain(0); setWorkersLabor(0); setWorkersSpecialty(0); setWorkersSpecial(0);
    setMachinery([newMachinery()]);
    setMaterials([newMaterial()]);
    setTasks([newTask()]);
    setQualityRisks([newQualityRisk()]);
    setIssues([newIssue()]);
    setPhotos([]);
    setNotes('');
  };

  const buildSubmitParams = (): SubmitDailyReportParams => ({
    projectId: project.id,
    reportDate,
    weatherDay, weatherNight, weatherAlert, weatherAlertLevel,
    managersMain, managersLabor, managersSpecialty,
    workersMain, workersLabor, workersSpecialty, workersSpecial,
    workersTotal,
    machinery: machinery.filter(m => m?.name?.trim?.() || ''),
    machineryTotal,
    materials: materials.filter(m => m?.name?.trim?.() || ''),
    tasks: tasks.filter(t => t?.description?.trim?.() || ''),
    qualityRisks: qualityRisks.filter(q => q?.name?.trim?.() || ''),
    issues: issues.filter(i => i?.problem?.trim?.() || ''),
    photos,
    notes: (notes || '').trim(),
  });

  const handleSubmit = async () => {
    if (!reportDate) { setToast('请选择日期'); setTimeout(() => setToast(''), 2000); return; }
    setSubmitting(true);
    try {
      const params = buildSubmitParams();
      if (editingId) await updateDailyReport(editingId, params);
      else await submitDailyReport(params);
      resetForm();
      setActiveTab('list');
      setToast(editingId ? '日报已更新' : '日报已提交');
      setTimeout(() => setToast(''), 2000);
      fetchReports();
    } catch (e: unknown) {
      setToast((e as Error).message || '提交失败');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(files[i]);
    }
    if (cameraRef.current) cameraRef.current.value = '';
  };

  // Number input helper
  const NumInput: React.FC<{
    label: string; value: number;
    onChange: (v: number) => void;
    suffix?: string;
  }> = ({ label, value, onChange, suffix }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-500 active:bg-slate-100 text-sm">-</button>
        <input
          type="number" min="0" value={value} onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-14 h-8 text-center rounded-lg border border-slate-300 text-sm"
        />
        <button type="button" onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-500 active:bg-slate-100 text-sm">+</button>
        {suffix && <span className="text-xs text-slate-400 w-6">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 text-slate-500 active:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src="/zhjk-logo.png" alt="中航建科" className="w-7 h-7 shrink-0" />
        <h1 className="text-sm font-semibold text-slate-800 flex-1">工作情况汇报</h1>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Tab Bar + Upload */}
      <div className="px-3 pt-3 space-y-2">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            日报列表
          </button>
          <button onClick={() => { setActiveTab('form'); resetForm(); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'form' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            写汇报
          </button>
        </div>

        {/* Upload file for AI parse */}
        <input ref={fileRef} type="file" accept=".docx,.doc,.txt" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          setUploading(true); setToast('正在解析文件...');
          try {
            const result = await uploadDailyFile(project.id, project.name, file);
            if (result.parsed) {
              const p = result.parsed;
              if (p.reportDate) setReportDate(p.reportDate);
              if (p.weatherDay) setWeatherDay(p.weatherDay);
              if (p.weatherNight) setWeatherNight(p.weatherNight || '');
              if (p.weatherAlert) setWeatherAlert(p.weatherAlert || '');
              if (p.weatherAlertLevel) setWeatherAlertLevel(p.weatherAlertLevel || '');
              if (p.managersMain) setManagersMain(p.managersMain);
              if (p.managersLabor) setManagersLabor(p.managersLabor);
              if (p.managersSpecialty) setManagersSpecialty(p.managersSpecialty);
              if (p.workersMain) setWorkersMain(p.workersMain);
              if (p.workersLabor) setWorkersLabor(p.workersLabor);
              if (p.workersSpecialty) setWorkersSpecialty(p.workersSpecialty);
              if (p.workersSpecial) setWorkersSpecial(p.workersSpecial);
              if (p.machinery && p.machinery.length > 0) setMachinery(p.machinery);
              if (p.materials && p.materials.length > 0) setMaterials(p.materials);
              if (p.tasks && p.tasks.length > 0) setTasks(p.tasks);
              if (p.qualityRisks && p.qualityRisks.length > 0) setQualityRisks(p.qualityRisks);
              if (p.issues && p.issues.length > 0) setIssues(p.issues);
              if (p.notes) setNotes(p.notes);
              setToast('已解析，请检查各段落内容后点击「提交」');
              setActiveTab('form');
            } else {
              setToast(result.parsed ? '解析成功' : '无法解析，请手动填写');
              if (result.rawText) setNotes(`[解析失败的原文]\n${result.rawText}`);
            }
          } catch (e: unknown) { setToast((e as Error).message || '上传失败'); }
          finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
        }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {uploading ? '解析中...' : '上传日报文件（AI自动解析）'}
        </button>
      </div>

      {/* ============ List Tab ============ */}
      {activeTab === 'list' && (
        <div className="flex-1 px-3 pb-6 pt-3">
          <button
            onClick={() => { setActiveTab('form'); resetForm(); }}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700 flex items-center justify-center gap-1.5 mb-3"
          >
            <Plus className="w-4 h-4" /> 写汇报
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">暂无日报记录</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
                <DayGroup key={date} date={date} reports={items} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ Form Tab ============ */}
      {activeTab === 'form' && (
        <div className="flex-1 px-3 pb-20 pt-3 overflow-y-auto space-y-3">

          {/* Section 1: 基本情况 */}
          <FormSection title="一、基本情况" icon={<Cloud className="w-4 h-4" />} defaultOpen={true}>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">日期</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1.5">白天天气</label>
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map(w => (
                  <button key={w} type="button" onClick={() => setWeatherDay(w)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${weatherDay === w ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 active:bg-slate-50'}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">夜间天气</label>
                <select value={weatherNight} onChange={e => setWeatherNight(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- 无夜间施工 --</option>
                  {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">天气预警</label>
                <select value={weatherAlert} onChange={e => setWeatherAlert(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">无预警</option>
                  {ALERT_TYPES.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {weatherAlert && (
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">预警级别</label>
                <div className="flex gap-2">
                  {ALERT_LEVELS.filter(Boolean).map(l => (
                    <button key={l} type="button" onClick={() => setWeatherAlertLevel(l)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium border ${weatherAlertLevel === l
                        ? l === '红' ? 'border-red-500 bg-red-50 text-red-600'
                          : l === '橙' ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : l === '黄' ? 'border-yellow-500 bg-yellow-50 text-yellow-600'
                          : 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-slate-200 text-slate-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormSection>

          {/* Section 2: 现场人员 */}
          <FormSection title="二、现场人员" icon={<Users className="w-4 h-4" />} defaultOpen={true}
            badge={`合计: ${workersTotal}人`}>
            <p className="text-xs text-slate-500 font-medium pt-1">管理人员</p>
            <NumInput label="总包管理人员" value={managersMain} onChange={setManagersMain} suffix="人" />
            <NumInput label="劳务分包管理人员" value={managersLabor} onChange={setManagersLabor} suffix="人" />
            <NumInput label="专业分包管理人员" value={managersSpecialty} onChange={setManagersSpecialty} suffix="人" />

            <p className="text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">作业人员</p>
            <NumInput label="总包作业人员" value={workersMain} onChange={setWorkersMain} suffix="人" />
            <NumInput label="劳务分包作业人员" value={workersLabor} onChange={setWorkersLabor} suffix="人" />
            <NumInput label="专业分包作业人员" value={workersSpecialty} onChange={setWorkersSpecialty} suffix="人" />
            <NumInput label="特种作业人员" value={workersSpecial} onChange={setWorkersSpecial} suffix="人" />

            <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-bold text-blue-700">现场总人数</span>
              <span className="text-lg font-bold text-blue-700">{workersTotal} 人</span>
            </div>
          </FormSection>

          {/* Section 3: 机械设备 */}
          <FormSection title="三、机械设备" icon={<Wrench className="w-4 h-4" />}
            badge={`共${machineryTotal}台`}>
            {machinery.map((m, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">机械 #{i + 1}</span>
                  {machinery.length > 1 && (
                    <button type="button" onClick={() => setMachinery(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 active:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="名称" value={m.name}
                    onChange={e => { const n = [...machinery]; n[i] = { ...n[i], name: e.target.value }; setMachinery(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="规格型号" value={m.spec}
                    onChange={e => { const n = [...machinery]; n[i] = { ...n[i], spec: e.target.value }; setMachinery(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="number" placeholder="数量" value={m.count || ''}
                    onChange={e => { const n = [...machinery]; n[i] = { ...n[i], count: parseInt(e.target.value) || 0 }; setMachinery(n); }}
                    min="0" className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setMachinery(prev => [...prev, newMachinery()])}
              className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-blue-500 text-sm flex items-center justify-center gap-1 active:bg-blue-50">
              <Plus className="w-4 h-4" /> 添加机械
            </button>
            <div className="text-xs text-slate-500 text-right">机械总计: {machineryTotal} 台</div>
          </FormSection>

          {/* Section 4: 材料情况 */}
          <FormSection title="四、材料情况" icon={<Box className="w-4 h-4" />}>
            {materials.map((m, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">材料 #{i + 1}</span>
                  {materials.length > 1 && (
                    <button type="button" onClick={() => setMaterials(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 active:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="材料名称" value={m.name}
                    onChange={e => { const n = [...materials]; n[i] = { ...n[i], name: e.target.value }; setMaterials(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="规格" value={m.spec}
                    onChange={e => { const n = [...materials]; n[i] = { ...n[i], spec: e.target.value }; setMaterials(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="数量" value={m.quantity}
                    onChange={e => { const n = [...materials]; n[i] = { ...n[i], quantity: e.target.value }; setMaterials(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="备注" value={m.note}
                    onChange={e => { const n = [...materials]; n[i] = { ...n[i], note: e.target.value }; setMaterials(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setMaterials(prev => [...prev, newMaterial()])}
              className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-blue-500 text-sm flex items-center justify-center gap-1 active:bg-blue-50">
              <Plus className="w-4 h-4" /> 添加材料
            </button>
          </FormSection>

          {/* Section 5: 施工管理 */}
          <FormSection title="五、施工管理" icon={<Building className="w-4 h-4" />}>
            {tasks.map((t, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">任务 #{i + 1}</span>
                  {tasks.length > 1 && (
                    <button type="button" onClick={() => setTasks(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 active:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <input type="text" placeholder="施工区域" value={t.area}
                  onChange={e => { const n = [...tasks]; n[i] = { ...n[i], area: e.target.value }; setTasks(n); }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                <textarea placeholder="施工内容描述" value={t.description} rows={2}
                  onChange={e => { const n = [...tasks]; n[i] = { ...n[i], description: e.target.value }; setTasks(n); }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm resize-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="人数" value={t.workers || ''}
                    onChange={e => { const n = [...tasks]; n[i] = { ...n[i], workers: parseInt(e.target.value) || 0 }; setTasks(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="今日完成%" value={t.todayPct}
                    onChange={e => { const n = [...tasks]; n[i] = { ...n[i], todayPct: e.target.value }; setTasks(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="累计完成%" value={t.totalPct}
                    onChange={e => { const n = [...tasks]; n[i] = { ...n[i], totalPct: e.target.value }; setTasks(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="text" placeholder="进度描述" value={t.schedule}
                    onChange={e => { const n = [...tasks]; n[i] = { ...n[i], schedule: e.target.value }; setTasks(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <input type="text" placeholder="分包单位" value={t.contractor}
                  onChange={e => { const n = [...tasks]; n[i] = { ...n[i], contractor: e.target.value }; setTasks(n); }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" />
              </div>
            ))}
            <button type="button" onClick={() => setTasks(prev => [...prev, newTask()])}
              className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-blue-500 text-sm flex items-center justify-center gap-1 active:bg-blue-50">
              <Plus className="w-4 h-4" /> 添加施工任务
            </button>
          </FormSection>

          {/* Section 6: 质量危大 */}
          <FormSection title="六、质量与危大工程" icon={<Shield className="w-4 h-4" />}>
            {qualityRisks.map((q, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">检查项 #{i + 1}</span>
                  {qualityRisks.length > 1 && (
                    <button type="button" onClick={() => setQualityRisks(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 active:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <input type="text" placeholder="危大工程名称" value={q.name}
                  onChange={e => { const n = [...qualityRisks]; n[i] = { ...n[i], name: e.target.value }; setQualityRisks(n); }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" placeholder="开始日期" value={q.startDate}
                    onChange={e => { const n = [...qualityRisks]; n[i] = { ...n[i], startDate: e.target.value }; setQualityRisks(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                  <input type="date" placeholder="检查日期" value={q.inspected}
                    onChange={e => { const n = [...qualityRisks]; n[i] = { ...n[i], inspected: e.target.value }; setQualityRisks(n); }}
                    className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input type="checkbox" checked={q.inspected === '合格'}
                      onChange={e => { const n = [...qualityRisks]; n[i] = { ...n[i], inspected: e.target.checked ? '合格' : '不合格' }; setQualityRisks(n); }} />
                    检查合格
                  </label>
                </div>
                <input type="text" placeholder="风险隐患描述" value={q.hazard}
                  onChange={e => { const n = [...qualityRisks]; n[i] = { ...n[i], hazard: e.target.value }; setQualityRisks(n); }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" />
              </div>
            ))}
            <button type="button" onClick={() => setQualityRisks(prev => [...prev, newQualityRisk()])}
              className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-blue-500 text-sm flex items-center justify-center gap-1 active:bg-blue-50">
              <Plus className="w-4 h-4" /> 添加危大检查项
            </button>
          </FormSection>

          {/* Section 7: 需协调问题 */}
          <FormSection title="七、需协调问题" icon={<AlertTriangle className="w-4 h-4" />}>
            {issues.map((iss, i) => (
              <div key={i} className="bg-amber-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-700">问题 #{i + 1}</span>
                  {issues.length > 1 && (
                    <button type="button" onClick={() => setIssues(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 active:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <textarea placeholder="问题描述" value={iss.problem} rows={2}
                  onChange={e => { const n = [...issues]; n[i] = { ...n[i], problem: e.target.value }; setIssues(n); }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm resize-none" />
                <input type="text" placeholder="原因分析" value={iss.cause}
                  onChange={e => { const n = [...issues]; n[i] = { ...n[i], cause: e.target.value }; setIssues(n); }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                <input type="number" placeholder="耽误天数" value={iss.delayDays || ''}
                  onChange={e => { const n = [...issues]; n[i] = { ...n[i], delayDays: parseInt(e.target.value) || 0 }; setIssues(n); }}
                  className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" />
                <textarea placeholder="采取的措施" value={iss.measures} rows={2}
                  onChange={e => { const n = [...issues]; n[i] = { ...n[i], measures: e.target.value }; setIssues(n); }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm resize-none" />
                <textarea placeholder="需要协调的事项" value={iss.needHelp} rows={2}
                  onChange={e => { const n = [...issues]; n[i] = { ...n[i], needHelp: e.target.value }; setIssues(n); }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm resize-none" />
              </div>
            ))}
            <button type="button" onClick={() => setIssues(prev => [...prev, newIssue()])}
              className="w-full py-2 rounded-lg border border-dashed border-amber-400 text-amber-600 text-sm flex items-center justify-center gap-1 active:bg-amber-50">
              <Plus className="w-4 h-4" /> 添加协调问题
            </button>
          </FormSection>

          {/* Section 8: 施工照片 — 仅保留上传按钮，不做AI图片识别 */}
          <FormSection title="八、施工照片" icon={<Camera className="w-4 h-4" />}
            badge={photos.length > 0 ? `${photos.length}张` : ''}>
            <input ref={cameraRef} type="file" accept="image/*" multiple className="hidden"
              onChange={handleCameraCapture} />
            <button type="button" onClick={() => cameraRef.current?.click()}
              className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium flex items-center justify-center gap-2 active:bg-indigo-600">
              <Camera className="w-4 h-4" /> 拍摄/选择照片
            </button>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-200">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />备注
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="其他补充说明..." />
          </div>

          {/* Submit button — fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-3 z-10">
            <button onClick={handleSubmit} disabled={submitting || !reportDate}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? '提交中...' : '提交工作情况汇报'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ========== Collapsible day group (list tab) ==========
const DayGroup: React.FC<{ date: string; reports: DailyReportFull[] }> = ({ date, reports }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 flex items-center justify-between active:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-slate-700">{date}</span>
          <span className="text-xs text-slate-400">({reports.length}条)</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {reports.map(r => (
            <div key={r.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">
                  {r.deleted ? <span className="text-red-500 font-medium">[已失效] </span> : null}
                  {r.weatherDay || ''}{r.weatherNight ? ` / 夜间${r.weatherNight}` : ''}
                  {r.weatherAlert ? ` [${r.weatherAlert}${r.weatherAlertLevel}]` : ''}
                </span>
                <div className="flex items-center gap-2">
  {!r.deleted && <span className="text-xs text-blue-400">24h内可编辑</span>}
                  <span className="text-xs text-slate-400">{r.reportedBy}</span>
                </div>
              </div>
              {/* Tasks summary */}
              {r.tasks && r.tasks.length > 0 && (
                <div className="space-y-1">
                  {r.tasks.map((t, i) => (
                    <p key={i} className="text-sm text-slate-700">
                      {t.description}{t.todayPct ? ` (${t.todayPct})` : ''}
                    </p>
                  ))}
                </div>
              )}
              {(!r.tasks || r.tasks.length === 0) && r.notes && (
                <p className="text-sm text-slate-700 leading-relaxed">{r.notes}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                {r.workersTotal > 0 && (
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.workersTotal}人</span>
                )}
                {r.machineryTotal > 0 && (
                  <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{r.machineryTotal}台</span>
                )}
                {r.materials && r.materials.length > 0 && (
                  <span className="flex items-center gap-1"><Box className="w-3 h-3" />材料{r.materials.length}项</span>
                )}
                {r.issues && r.issues.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" />{r.issues.length}项问题</span>
                )}
                {r.photos && r.photos.length > 0 && (
                  <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{r.photos.length}张</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileDailyReport;
