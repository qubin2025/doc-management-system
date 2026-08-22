import React, { useState, useEffect } from 'react';
import { Loader2, BrainCircuit, AlertTriangle, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import ModuleHeader from './ModuleHeader';
import { fullScan, ScanResult } from '../data/aiAgent';
import { ProjectIndicators } from '../data/indicatorEngine';
import { buildGraph, KnowledgeGraph } from '../data/knowledgeGraph';

interface Props { projectName: string; onBack: () => void; }

const AnalysisCenter: React.FC<Props> = ({ projectName, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState<ProjectIndicators | null>(null);
  const [workScan, setWorkScan] = useState<ScanResult | null>(null);
  const [formScan, setFormScan] = useState<ScanResult | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [aiAdvice, setAiAdvice] = useState('');
  const [lastScan, setLastScan] = useState('');

  const runFullScan = async () => {
    setLoading(true);
    try {
      const [result, kg] = await Promise.all([
        fullScan(projectName),
        Promise.resolve(buildGraph()),
      ]);
      setIndicators(result.indicators);
      setWorkScan(result.workItems);
      setFormScan(result.forms);
      setAiAdvice(result.aiAdvice);
      setGraph(kg);
      setLastScan(new Date().toLocaleString('zh-CN'));
    } catch { setAiAdvice('AI分析服务暂不可用，请检查API配置'); }
    finally { setLoading(false); }
  };

  useEffect(() => { runFullScan(); }, [projectName]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ModuleHeader
        title="智能分析中心"
        subtitle={projectName}
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        onBack={onBack}
        actions={
          <button onClick={runFullScan} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}重新扫描
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && !indicators ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="text-sm">AI正在综合分析项目数据...</p>
          </div>
        ) : (
          <>
            {/* AI 综合建议 */}
            {aiAdvice && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <BrainCircuit className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-purple-900">AI 综合建议</h3>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiAdvice}</p>
              </div>
            )}

            {/* 指标快照 */}
            {indicators && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'CPI', value: indicators.cpi, color: indicators.cpi > 1.05 ? 'text-red-500' : indicators.cpi > 0.95 ? 'text-amber-500' : 'text-green-500' },
                  { label: 'SPI', value: indicators.spi, color: indicators.spi < 0.5 ? 'text-red-500' : indicators.spi < 0.8 ? 'text-amber-500' : 'text-green-500' },
                  { label: '完整度', value: indicators.completeness + '%', color: indicators.completeness < 30 ? 'text-red-500' : indicators.completeness < 60 ? 'text-amber-500' : 'text-green-500' },
                  { label: '质量', value: indicators.qualityScore || '-', color: indicators.qualityScore < 60 ? 'text-red-500' : indicators.qualityScore < 75 ? 'text-amber-500' : 'text-green-500' },
                ].map(m => (
                  <div key={m.label} className="bg-white rounded-xl border p-4 text-center">
                    <div className="text-xs text-gray-400 mb-1">{m.label}</div>
                    <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 工作项扫描 */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />工作项分析
                </h3>
                {workScan && (
                  <>
                    <p className="text-xs text-gray-500 mb-3">{workScan.summary}</p>
                    {workScan.suggestions.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {workScan.suggestions.slice(0, 8).map((s, i) => (
                          <div key={i} className={`text-xs p-2 rounded-lg ${
                            s.level === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            <span className="font-bold">{s.action}</span>: {s.targetName}
                            <div className="text-gray-400 mt-0.5">{s.reason}</div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400">✅ 未发现异常</p>}
                  </>
                )}
              </div>

              {/* 表单扫描 */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />表单分析
                </h3>
                {formScan && (
                  <>
                    <p className="text-xs text-gray-500 mb-3">{formScan.summary}</p>
                    {formScan.suggestions.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {formScan.suggestions.slice(0, 8).map((s, i) => (
                          <div key={i} className="text-xs p-2 rounded-lg bg-amber-50 text-amber-700">
                            <span className="font-bold">{s.targetName}</span>: {s.action}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400">✅ 所有表单填写正常</p>}
                  </>
                )}
              </div>
            </div>

            {/* 知识图谱概览 */}
            {graph && (
              <div className="mt-6 bg-white rounded-xl border p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">知识图谱概览</h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: '项目', count: graph.nodes.filter(n => n.type === 'project').length, color: 'bg-blue-500' },
                    { label: '表单', count: graph.nodes.filter(n => n.type === 'form').length, color: 'bg-purple-500' },
                    { label: '文档', count: graph.nodes.filter(n => n.type === 'document').length, color: 'bg-green-500' },
                    { label: '工作项', count: graph.nodes.filter(n => n.type === 'work-item').length, color: 'bg-amber-500' },
                    { label: '关联边', count: graph.edges.length, color: 'bg-gray-500' },
                  ].map(g => (
                    <div key={g.label} className="text-center">
                      <div className={`w-10 h-10 ${g.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                        <span className="text-white font-bold text-sm">{g.count}</span>
                      </div>
                      <div className="text-xs text-gray-500">{g.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 预警汇总 */}
            {indicators && indicators.alerts.length > 0 && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />风险预警 ({indicators.alerts.length})
                </h3>
                <div className="space-y-2">
                  {indicators.alerts.map((a, i) => (
                    <div key={i} className={`text-xs p-2.5 rounded-lg ${a.level === 'danger' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {lastScan && (
          <div className="text-center text-xs text-gray-400 mt-8">上次扫描: {lastScan}</div>
        )}
      </div>
    </div>
  );
};

export default AnalysisCenter;
