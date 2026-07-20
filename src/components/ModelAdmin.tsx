import React, { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, CheckCircle, XCircle, AlertTriangle, Key, Zap, Wifi } from 'lucide-react';
import { toast } from './Toast';

interface ModelInfo { id: string; name: string; status: string; tested?: boolean; latency?: number; }
interface Props { onClose: () => void; }

const ModelAdmin: React.FC<Props> = ({ onClose }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [testing, setTesting] = useState<Record<string,boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const t = localStorage.getItem('doc-system-token') || localStorage.getItem('doc-system-auth') ? JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token : '';
      const r = await fetch('/api/ai/models', { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } });
      if (r.ok) {
        const d = await r.json();
        setModels(d.models || []);
      } else if (r.status === 401) {
        toast('请先登录后再测试', 'error');
      }
    } catch (e: any) {
      toast('获取模型列表失败: ' + (e.message || '后端未启动'), 'error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, []);

  const testModel = async (modelId: string) => {
    setTesting(p => ({ ...p, [modelId]: true }));
    const start = Date.now();
    try {
      const auth = localStorage.getItem('doc-system-auth');
      const t = auth ? JSON.parse(auth)?.token : (localStorage.getItem('doc-system-token') || '');
      if (!t) { toast('未登录，请先登录', 'error'); setTesting(p => ({ ...p, [modelId]: false })); return; }
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: '回复OK' }], model: modelId }),
      });
      const latency = Date.now() - start;
      const statusCode = r.status;
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, tested: true, latency, status: r.ok ? 'online' : 'offline' } : m));
      if (r.ok) toast(`${modelId} 连通正常 (${latency}ms)`, 'success');
      else if (statusCode === 401) toast(`${modelId} 认证失败，请重新登录`, 'error');
      else toast(`${modelId} 返回错误 (HTTP ${statusCode})`, 'error');
    } catch (e: any) {
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, tested: true, status: 'offline' } : m));
      toast(`${modelId} 连接失败: ${e.message || '后端未启动或网络不通'}`, 'error');
    }
    setTesting(p => ({ ...p, [modelId]: false }));
  };

  const testAll = async () => {
    for (const m of models) {
      if (m.status === 'online' || m.status === 'optional') await testModel(m.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center"><Sparkles className="w-5 h-5 text-white"/></div>
            <div><h2 className="text-base font-bold text-gray-800">大模型配置中心</h2><p className="text-xs text-gray-500">管理员可测试各模型连通性</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchModels} disabled={loading} className="p-2 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-white" title="刷新"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white"><X className="w-5 h-5"/></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 快速操作 */}
          <div className="flex items-center gap-3">
            <button onClick={testAll} className="px-4 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5"/>全部测试</button>
            <span className="text-xs text-gray-400">共 {models.length} 个模型 | 点击各行"测试"按钮单独检测</span>
          </div>

          {/* 模型列表 */}
          <div className="space-y-2">
            {models.map(m => (
              <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${m.status==='online' ? 'bg-green-50/50 border-green-100' : m.status==='offline' ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  {testing[m.id] ? <RefreshCw className="w-5 h-5 text-blue-500 animate-spin"/> :
                   m.status==='online' ? <CheckCircle className="w-5 h-5 text-green-500"/> :
                   m.status==='offline' ? <XCircle className="w-5 h-5 text-red-400"/> :
                   m.status==='optional' ? <AlertTriangle className="w-5 h-5 text-amber-400"/> :
                   <AlertTriangle className="w-5 h-5 text-gray-300"/>}
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <code className="text-[10px] bg-gray-100 px-1 rounded">{m.id}</code>
                      {m.tested && <span className="ml-1">{m.latency ? `${m.latency}ms` : '失败'}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.status==='online' ? 'bg-green-100 text-green-700' :
                    m.status==='offline' ? 'bg-red-100 text-red-600' :
                    m.status==='optional' ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-500'}`}>
                    {m.status==='online' ? '在线' : m.status==='offline' ? '离线' : m.status==='optional' ? '可选' : '未知'}
                  </span>
                  <button onClick={() => testModel(m.id)} disabled={testing[m.id]}
                    className="px-3 py-1 text-xs border rounded-lg hover:bg-white disabled:opacity-50 flex items-center gap-1">
                    {testing[m.id] ? <><RefreshCw className="w-3 h-3 animate-spin"/>测试中</> : <><Wifi className="w-3 h-3"/>测试</>}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Key配置指引 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2"><Key className="w-4 h-4"/>API Key 配置指引</h4>
            <p className="text-xs text-amber-700 leading-relaxed mb-2">
              模型显示<strong>离线</strong>说明对应的 API Key 未配置。<br/>
              请编辑服务器上的 <code className="bg-amber-100 px-1 rounded">backend/.env</code> 文件，添加对应 Key 后重启后端：
            </p>
            <table className="w-full text-xs">
              <thead><tr className="text-amber-700"><th className="text-left py-1">模型</th><th className="text-left py-1">环境变量</th><th className="text-left py-1">获取地址</th></tr></thead>
              <tbody className="text-amber-600">
                <tr><td className="py-0.5">DeepSeek</td><td className="py-0.5"><code>DEEPSEEK_API_KEY</code></td><td className="py-0.5">platform.deepseek.com</td></tr>
                <tr><td className="py-0.5">通义千问</td><td className="py-0.5"><code>QWEN_API_KEY</code></td><td className="py-0.5">dashscope.aliyun.com</td></tr>
                <tr><td className="py-0.5">智谱GLM</td><td className="py-0.5"><code>ZHIPU_API_KEY</code></td><td className="py-0.5">open.bigmodel.cn</td></tr>
                <tr><td className="py-0.5">通义Embedding</td><td className="py-0.5"><code>DASHSCOPE_API_KEY</code></td><td className="py-0.5">dashscope.console.aliyun.com</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelAdmin;
