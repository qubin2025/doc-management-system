// AI 提示词配置对话框 — 授权用户可查看/编辑提示词
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, RotateCcw, Sparkles, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

interface PromptRule {
  element: string;     // 要素名称（不可编辑）
  description: string; // 说明（不可编辑）
  practice: string;    // 本项目实践（可编辑）
}

const DEFAULT_RULES: PromptRule[] = [
  { element: '角色定位', description: '第一句定义AI身份边界', practice: '你是工程日报解析助手。请严格按照以下8条规则从日报文本中提取JSON（只返回JSON，不要其他内容）' },
  { element: '输入标注', description: '明确标记输入数据边界与格式', practice: '项目名称：${projectName}\n日报文本：${text}（自动截取前6000字）' },
  { element: '规则1-基本情况', description: '日期/天气/预警字段提取规则', practice: '日期取记录日期字段。天气："白天天气"和"夜间天气"分别读取。预警字段：日报中有大风预警和空气污染预警两行，每行下面有蓝/黄/橙/红四列。检查预警级别的对应下一行是否有对勾(√)或填写内容。如果四个级别下侧全是空白→weatherAlert返回"无"。' },
  { element: '规则2-现场人员', description: '管理人员与作业人员分别读取', practice: '管理人员行：总包/劳务分包/专业分包三列分别对应managersMain/managersLabor/managersSpecialty。施工作业人员行：劳务分包列对应workersLabor，专业分包列对应workersSpecialty，特种作业人数列对应workersSpecial。注意区分管理人员和作业人员！' },
  { element: '规则3-机械设备', description: '设备名称/规格/数量提取', practice: '读取机械设备表中的设备名称、规格型号、数量。machineryTotal为数量合计。' },
  { element: '规则4-施工管理', description: '工序/人数/进度/分包提取', practice: '施工内容中的"上午X人，下午Y人"拆分：workersAM=X, workersPM=Y, workers=(X+Y)/2取整。进度百分比如实读取。contractor取所属分包单位列。' },
  { element: '规则5-质量危大', description: '危大工程验收/巡视/隐患判断', practice: 'qualityRisks格式：{"name":"分项名称","startDate":"开始时间","inspected":"验收情况","inspectionResult":"检查巡视结果","hazard":"合格/不合格"}。注意：false/true必须转换为中文不合格/合格。' },
  { element: '规则6-协调问题', description: '问题/原因/措施完整提取', practice: 'issues格式：{"problem":"问题描述","cause":"产生原因","delayDays":影响天数,"measures":"已采取措施","needHelp":"需协助解决事项"}' },
  { element: '规则7-照片', description: '施工形象照片识别', practice: 'photos数组从文档中提取图片描述文本，如果有"施工形象照片"段落则记录。' },
  { element: '规则8-输出格式', description: '完整JSON Schema约束', practice: '严格按JSON Schema输出。找不到的字段用空字符串""或空数组[]填充。只提取报告中明确出现的数据，不要编造。' },
];

const STORAGE_KEY = 'ai-prompt-custom-rules';

interface Props {
  open: boolean;
  onClose: () => void;
  onStartAnalysis: () => void;
  isAdmin?: boolean;
}

const PromptConfigDialog: React.FC<Props> = ({ open, onClose, onStartAnalysis, isAdmin }) => {
  const [rules, setRules] = useState<PromptRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [...DEFAULT_RULES];
  });
  const [showRaw, setShowRaw] = useState(false);
  const [extraRules, setExtraRules] = useState<string>('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-prompt-extra-rules');
      if (saved) setExtraRules(saved);
    } catch {}
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    if (extraRules.trim()) localStorage.setItem('ai-prompt-extra-rules', extraRules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRules([...DEFAULT_RULES]);
    setExtraRules('');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('ai-prompt-extra-rules');
  };

  const handleAddRule = () => {
    setRules([...rules, { element: `新增规则${rules.length - DEFAULT_RULES.length + 1}`, description: '自定义规则', practice: '' }]);
  };

  const handleRemoveRule = (idx: number) => {
    if (idx < DEFAULT_RULES.length) return; // 不可删除默认规则
    setRules(rules.filter((_, i) => i !== idx));
  };

  const handlePracticeChange = (idx: number, value: string) => {
    setRules(rules.map((r, i) => i === idx ? { ...r, practice: value } : r));
  };



  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">AI 解析提示词配置</h2>
            {isAdmin && <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">授权编辑</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRaw(!showRaw)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 flex items-center gap-1">
              {showRaw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showRaw ? '表格视图' : '原始视图'}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {showRaw ? (
            /* Raw view — shows the complete generated prompt */
            <div className="space-y-3">
              <p className="text-xs text-slate-400">以下为发送给 DeepSeek 的完整提示词（只读）</p>
              <pre className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
{`${rules.map(r => `【${r.element}】${r.practice}`).join('\n\n')}\n${extraRules ? '\n' + extraRules + '\n' : ''}\n请严格按照以上规则提取JSON，只返回JSON不要其他内容。`}
              </pre>
            </div>
          ) : (
            /* Table view */
            <div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 w-[12%]">要素</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 w-[18%]">说明</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">本项目实践（可编辑）</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 align-top pt-3">{r.element}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 align-top pt-3">{r.description}</td>
                      <td className="px-3 py-2 align-top">
                        <textarea
                          value={r.practice}
                          onChange={e => handlePracticeChange(i, e.target.value)}
                          rows={Math.max(2, r.practice.split('\n').length)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 resize-y"
                        />
                      </td>
                      <td className="px-1 py-2 align-top pt-3">
                        {i >= DEFAULT_RULES.length && (
                          <button onClick={() => handleRemoveRule(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add custom rule */}
              <button onClick={handleAddRule}
                className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors">
                <Plus className="w-3 h-3" /> 添加自定义规则
              </button>

              {/* Extra prompt text */}
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">附加提示词（追加在规则末尾）</label>
                <textarea
                  value={extraRules}
                  onChange={e => setExtraRules(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 resize-y"
                  placeholder="在此输入额外提示词，将追加在8条规则之后..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <button onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors">
              <RotateCcw className="w-4 h-4" /> 恢复默认
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave}
              className={`flex items-center gap-1.5 px-5 py-2 text-sm rounded-xl transition-colors ${saved ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              <Save className="w-4 h-4" /> {saved ? '已保存' : '保存'}
            </button>
            <button onClick={() => { handleSave(); onClose(); setTimeout(onStartAnalysis, 100); }}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium">
              <Sparkles className="w-4 h-4" /> AI 分析
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body);
};

export default PromptConfigDialog;
