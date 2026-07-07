import React, { useState } from 'react';
import { ArrowLeft, Upload, Shield, CheckCircle, Loader, X, Edit3 } from 'lucide-react';
import { toast } from './Toast';
import * as api from '../data/api';

interface Props { projectName: string; onBack: () => void; }

const SafetyInspection: React.FC<Props> = ({ projectName, onBack }) => {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleFile = (f: File) => {
    setPhoto(f);
    setReport(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const startAnalysis = async () => {
    if (!photo) { toast('请先选择照片', 'warning'); return; }
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append('photo', photo);
      const token = api.getAuthToken() || localStorage.getItem('doc-system-token') || '';
      const res = await fetch(`http://localhost:3000/api/safety/check?token=${encodeURIComponent(token)}`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.status === 401) {
        toast('登录已过期, 请退出重新登录', 'error');
        return;
      }
      if (data.ok && data.report) {
        setReport(data.report);
        toast('分析完成 (GLM-5V)', 'success');
      } else {
        toast('分析失败: ' + (data.error || '未知错误'), 'error');
      }
    } catch (e: any) {
      toast('请求失败: ' + e.message, 'error');
    }
    setAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600"/></button>
            <Shield className="w-6 h-6 text-red-500"/>
            <div><h1 className="text-lg font-bold text-gray-800">安全巡检</h1><p className="text-xs text-gray-500">项目: {projectName} | 对标JGJ59-2011 | GLM-5V Turbo</p></div>
          </div>
          <button onClick={() => setShowPrompt(true)} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-1"><Edit3 className="w-3 h-3"/>编辑提示词</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!photo && (
          <div className="bg-white rounded-xl border-2 border-dashed border-red-300 p-12 text-center hover:border-red-400 cursor-pointer" onClick={() => document.getElementById('safety-file')?.click()}>
            <Upload className="w-12 h-12 text-red-400 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-700">上传施工现场照片</h3>
            <p className="text-sm text-gray-500">JPG/PNG, 单文件 ≤20MB</p>
            <input id="safety-file" type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
          </div>
        )}

        {photo && !analyzing && !report && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-start gap-4">
              <img src={preview} alt="预览" className="w-64 rounded-lg object-cover border"/>
              <div className="flex-1">
                <p className="font-semibold text-lg">{photo.name}</p>
                <p className="text-xs text-gray-500">{(photo.size/1024/1024).toFixed(1)}MB | {photo.type}</p>
                <p className="text-sm text-gray-600 mt-3">将使用 GLM-5V Turbo 视觉模型对标 JGJ59-2011 进行 18 项安全检查</p>
                <div className="flex gap-2 mt-4">
                  <button onClick={startAnalysis} className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium">开始分析</button>
                  <button onClick={() => { setPhoto(null); setPreview(''); }} className="px-4 py-3 text-gray-500 hover:text-red-500"><X className="w-5 h-5"/></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {analyzing && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Loader className="w-10 h-10 text-red-500 animate-spin mx-auto mb-4"/>
            <p className="text-gray-600">GLM-5V Turbo 正在逐项扫描...</p>
            <p className="text-xs text-gray-400 mt-2">18项JGJ59安全检查进行中，约需15-20秒</p>
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img src={preview} alt="分析照片" className="w-48 rounded-lg object-cover border"/>
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500"/>
                  <span className="font-semibold text-gray-800">分析完成 — 合规率: {report.compliance_rate}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{report.summary}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setPhoto(null); setPreview(''); setReport(null); }} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg">重新分析</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border">
              <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700">检查项详情</div>
              {report.items?.map((item: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${item.status === 'non_compliant' ? 'bg-red-50' : item.status === 'compliant' ? 'bg-green-50' : ''}`}>
                  <span className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${item.status === 'non_compliant' ? 'bg-red-500' : item.status === 'compliant' ? 'bg-green-500' : 'bg-gray-400'}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{item.id}</span>
                      <span className="font-medium text-sm">{item.item}</span>
                      <span className="text-[10px] text-gray-400">{item.standard}</span>
                      <span className={`text-[10px] px-1 rounded ${item.status === 'non_compliant' ? 'bg-red-100 text-red-600' : item.status === 'compliant' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {item.status === 'non_compliant' ? '不合规' : item.status === 'compliant' ? '合规' : '未显示'}
                      </span>
                    </div>
                    {item.finding && <p className="text-xs text-red-600 mt-1">{item.finding}</p>}
                    {item.suggestion && <p className="text-xs text-blue-600 mt-0.5">{item.suggestion}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* 提示词编辑弹窗 */}
      {showPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => setShowPrompt(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-800">编辑安全检查提示词</h3>
              <button onClick={() => setShowPrompt(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-xs text-gray-400 mb-3">提示词文件: <code className="bg-gray-100 px-1 rounded">backend\config\safetyChecklist.js</code> → 修改后重启后端生效</p>
              <p className="text-xs text-gray-400 mb-3">检查清单: <code className="bg-gray-100 px-1 rounded">backend\config\safetyChecklist.js</code> → SAFETY_CHECKLIST 数组</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-3">
                修改后需重启后端: <code className="bg-amber-100 px-1 rounded">taskkill //F //IM node.exe && cd backend && node server.js</code>
              </div>
              <p className="text-xs text-gray-500">用任意文本编辑器打开上述文件，修改 VISION_SAFETY_PROMPT 或 SAFETY_CHECKLIST 即可。保存后命令行执行上述重启命令。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyInspection;
