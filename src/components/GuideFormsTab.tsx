/**
 * 指南附表清单 Tab
 * 功能：编辑/样本上传/成果上传(自动版本号)/AI自动填写(提示词可编辑)
 */
import React, { useState, useRef } from 'react';
import {
  FileText, Sparkles, Loader, X, Upload, Download, Trash2,
  Pencil, History, BookTemplate,
} from 'lucide-react';
import { GuideForm, FormSampleFile, FormArtifact } from '../types';

interface GuideFormsTabProps {
  forms: GuideForm[];
  colors: { bg: string; border: string; text: string; light: string; hover: string };
  formEditModal: { code: string; name: string } | null;
  formEditContent: string;
  aiFillLoading: boolean;
  sampleFilesMap: Record<string, FormSampleFile[]>;
  artifactsMap: Record<string, FormArtifact[]>;
  aiPromptsMap: Record<string, string>;
  onFormEditContentChange: (v: string) => void;
  onOpenFormEdit: (f: GuideForm) => void;
  onCloseFormEdit: () => void;
  onAiFillForm: (formCode?: string) => void;
  onSaveFormEdit: () => void;
  onUploadSample: (formCode: string, fileName: string, fileData: string) => void;
  onDeleteSample: (formCode: string, fileId: string) => void;
  onDownloadSample: (file: FormSampleFile) => void;
  onUploadArtifact: (formCode: string, fileName: string, fileData: string) => void;
  onDeleteArtifact: (formCode: string, fileId: string) => void;
  onDownloadArtifact: (file: FormArtifact) => void;
  onUpdateAiPrompt: (formCode: string, prompt: string) => void;
}

const AI_PROMPT_TEMPLATE = `你是全过程工程咨询管理系统的AI助手。请根据项目信息自动填写工程附表，生成项目计划表。

【表单名称】{formName}
【表单编号】{formCode}
【表单字段】
{fieldList}

【项目上下文】
项目名称：{name}
项目类型：房屋建筑工程
建设阶段：前期工作/施工阶段

【填写要求】
1. 以Markdown表格格式输出，表头为各字段标签
2. 日期字段使用 YYYY-MM-DD 格式
3. 数字字段给出合理估算值并注明单位
4. 责任单位字段从(建设单位/监理单位/施工单位/设计单位/咨询单位)中选择
5. 工作计划表请按时间顺序排列，体现项目里程碑
6. 在表格下方用 --- 分隔，列出填写说明`;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const GuideFormsTab: React.FC<GuideFormsTabProps> = ({
  forms, colors,
  formEditModal, formEditContent, aiFillLoading,
  sampleFilesMap, artifactsMap, aiPromptsMap,
  onFormEditContentChange, onOpenFormEdit, onCloseFormEdit,
  onAiFillForm, onSaveFormEdit,
  onUploadSample, onDeleteSample, onDownloadSample,
  onUploadArtifact, onDeleteArtifact, onDownloadArtifact,
  onUpdateAiPrompt,
}) => {
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const artifactInputRef = useRef<HTMLInputElement>(null);
  const promptFormCodeRef = useRef<string>('');

  const openPromptEditor = (formCode: string) => {
    promptFormCodeRef.current = formCode;
    const form = forms.find(f => f.code === formCode);
    setPromptDraft(aiPromptsMap[formCode] || form?.aiPrompt || AI_PROMPT_TEMPLATE);
    setShowPromptEditor(true);
  };

  const savePrompt = () => {
    onUpdateAiPrompt(promptFormCodeRef.current, promptDraft);
    setShowPromptEditor(false);
  };

  const handleSampleUpload = async (formCode: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const data = await fileToBase64(file);
        onUploadSample(formCode, file.name, data);
      } catch {}
    }
    e.target.value = '';
  };

  const handleArtifactUpload = async (formCode: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const data = await fileToBase64(file);
        onUploadArtifact(formCode, file.name, data);
      } catch {}
    }
    setUploadNote('');
    e.target.value = '';
  };

  const currentForm = formEditModal ? forms.find(f => f.code === formEditModal.code) : null;
  const currentPrompt = currentForm ? (aiPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_PROMPT_TEMPLATE) : AI_PROMPT_TEMPLATE;

  return (
    <div>
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900 border-b text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 w-20">表单编号</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400">表单名称</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 w-20">样本</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 w-20">成果</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {forms.map(f => {
              const samples = sampleFilesMap[f.code] || [];
              const arts = artifactsMap[f.code] || [];
              const isExpanded = expandedForm === f.code;
              return (
                <React.Fragment key={f.code}>
                  <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-400 font-mono">{f.code}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 font-medium">{f.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        {samples.length > 0 ? `${samples.length}个` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                        {arts.length > 0 ? `${arts.length}个` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => onOpenFormEdit(f)}
                          className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-0.5">
                          <FileText className="w-3 h-3" />编辑
                        </button>
                        <button onClick={() => setExpandedForm(isExpanded ? null : f.code)}
                          className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-0.5">
                          {isExpanded ? '收起' : '详情'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                                <BookTemplate className="w-3.5 h-3.5 text-blue-500" />
                                样本文件 ({samples.length})
                              </h4>
                              <label className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5">
                                <Upload className="w-3 h-3" />上传
                                <input ref={sampleInputRef} type="file" multiple className="hidden"
                                  onChange={(e) => handleSampleUpload(f.code, e)}
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.zip,.rar" />
                              </label>
                            </div>
                            {samples.length > 0 ? (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {samples.map(s => (
                                  <div key={s.id} className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 group">
                                    <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="flex-1 truncate text-gray-700 dark:text-slate-300">{s.fileName}</span>
                                    <span className="text-gray-400 dark:text-slate-500 text-[10px]">
                                      {new Date(s.uploadedAt).toLocaleDateString()}
                                    </span>
                                    <button onClick={() => onDownloadSample(s)}
                                      className="text-blue-500 hover:text-blue-700 shrink-0" title="下载">
                                      <Download className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => onDeleteSample(f.code, s.id)}
                                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">暂无样本，点击"上传"添加</p>
                            )}
                          </div>

                          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                                <History className="w-3.5 h-3.5 text-green-500" />
                                成果文件 ({arts.length})
                              </h4>
                              <label className="text-xs text-green-600 dark:text-green-400 hover:underline cursor-pointer flex items-center gap-0.5">
                                <Upload className="w-3 h-3" />上传
                                <input ref={artifactInputRef} type="file" multiple className="hidden"
                                  onChange={(e) => handleArtifactUpload(f.code, e)}
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.zip,.rar" />
                              </label>
                            </div>
                            <input type="text" value={uploadNote} onChange={e => setUploadNote(e.target.value)}
                              placeholder="版本备注（可选）" className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-slate-600 rounded mb-2 bg-white dark:bg-slate-700 dark:text-slate-200" />
                            {arts.length > 0 ? (
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {arts.map(a => (
                                  <div key={a.id} className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-900/20 rounded px-2 py-1 group">
                                    <FileText className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                                    <span className="flex-1 truncate text-gray-700 dark:text-slate-300">{a.fileName}</span>
                                    <span className="px-1 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-[10px] font-mono">v{a.version}</span>
                                    <button onClick={() => onDownloadArtifact(a)}
                                      className="text-blue-500 hover:text-blue-700 shrink-0" title="下载">
                                      <Download className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => onDeleteArtifact(f.code, a.id)}
                                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition shrink-0">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">暂无成果，上传后自动分配版本号</p>
                            )}
                          </div>

                          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                AI 填写提示词
                              </h4>
                              <button onClick={() => openPromptEditor(f.code)}
                                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5">
                                <Pencil className="w-3 h-3" />编辑
                              </button>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                              {(aiPromptsMap[f.code] || f.aiPrompt || AI_PROMPT_TEMPLATE).slice(0, 120)}
                              {(aiPromptsMap[f.code] || f.aiPrompt || AI_PROMPT_TEMPLATE).length > 120 ? '...' : ''}
                            </div>
                            <button onClick={() => onAiFillForm(f.code)}
                              disabled={aiFillLoading}
                              className={`mt-2 w-full py-1.5 text-xs rounded-lg flex items-center justify-center gap-1 ${
                                aiFillLoading ? 'bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed' :
                                'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                              }`}>
                              {aiFillLoading ? <Loader className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {aiFillLoading ? 'AI填写中...' : 'AI 自动填写'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {formEditModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onCloseFormEdit()}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">{formEditModal.name}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">编号：{formEditModal.code}</p>
              </div>
              <button onClick={onCloseFormEdit} className="text-gray-400 dark:text-slate-500 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <textarea value={formEditContent} onChange={e => onFormEditContentChange(e.target.value)}
                placeholder="在此编辑表单内容，支持 Markdown 格式..."
                rows={16} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg p-3 text-sm text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-900 resize-none outline-none" />

              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> AI 填写提示词（点击编辑）
                  </h4>
                  <button onClick={() => openPromptEditor(formEditModal.code)}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5">
                    <Pencil className="w-3 h-3" />编辑提示词
                  </button>
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300 max-h-20 overflow-y-auto whitespace-pre-wrap font-mono">
                  {currentPrompt.slice(0, 300)}{currentPrompt.length > 300 ? '...' : ''}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0 rounded-b-2xl">
              <button onClick={() => onAiFillForm()} disabled={aiFillLoading}
                className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${
                  aiFillLoading ? 'bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed' :
                  'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100'
                }`}>
                {aiFillLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiFillLoading ? 'AI填写中...' : 'AI自动填写'}
              </button>
              <div className="flex gap-2">
                <button onClick={onCloseFormEdit} className="px-4 py-2 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg text-sm">取消</button>
                <button onClick={onSaveFormEdit} className={`px-4 py-2 text-white rounded-lg text-sm ${colors.bg} ${colors.hover}`}>完成</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPromptEditor && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowPromptEditor(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> AI 填写提示词编辑
              </h3>
              <button onClick={() => setShowPromptEditor(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                编辑 AI 自动填写时使用的提示词。支持以下变量占位符：<br />
                <code className="bg-gray-100 dark:bg-slate-900 px-1 rounded text-blue-600 dark:text-blue-400">{'{formName}'}</code>
                <code className="bg-gray-100 dark:bg-slate-900 px-1 rounded text-blue-600 dark:text-blue-400 ml-1">{'{formCode}'}</code>
                <code className="bg-gray-100 dark:bg-slate-900 px-1 rounded text-blue-600 dark:text-blue-400 ml-1">{'{fieldList}'}</code>
                <code className="bg-gray-100 dark:bg-slate-900 px-1 rounded text-blue-600 dark:text-blue-400 ml-1">{'{name}'}</code>
                <code className="bg-gray-100 dark:bg-slate-900 px-1 rounded text-blue-600 dark:text-blue-400 ml-1">{'{startDate}'}</code>
              </p>
              <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)}
                rows={14} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-900 resize-none outline-none" />
            </div>
            <div className="px-5 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
              <button onClick={() => setPromptDraft(AI_PROMPT_TEMPLATE)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg">恢复默认</button>
              <button onClick={() => setShowPromptEditor(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg text-sm">取消</button>
              <button onClick={savePrompt} className="px-4 py-2 text-white rounded-lg text-sm bg-purple-500 hover:bg-purple-600">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuideFormsTab;
