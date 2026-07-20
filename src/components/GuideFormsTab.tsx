import React from 'react';
import { FileText, Sparkles, Loader, X } from 'lucide-react';
import { GuideForm } from '../types';

interface GuideFormsTabProps {
  forms: GuideForm[];
  colors: { bg: string; border: string; text: string; light: string; hover: string };
  formEditModal: { code: string; name: string } | null;
  formEditContent: string;
  aiFillLoading: boolean;
  onFormEditContentChange: (v: string) => void;
  onOpenFormEdit: (f: GuideForm) => void;
  onCloseFormEdit: () => void;
  onAiFillForm: () => void;
  onSaveFormEdit: () => void;
}

const GuideFormsTab: React.FC<GuideFormsTabProps> = ({
  forms, colors, formEditModal, formEditContent, aiFillLoading,
  onFormEditContentChange, onOpenFormEdit, onCloseFormEdit, onAiFillForm, onSaveFormEdit,
}) => {
  return (
    <div>
      {/* Forms Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 w-20">表单编号</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500">表单名称</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {forms.map(f => (
              <tr key={f.code} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{f.code}</td>
                <td className="px-4 py-2.5 text-sm text-gray-700">{f.name}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onOpenFormEdit(f)}
                      className="px-2.5 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50">
                      <FileText className="w-3 h-3 inline mr-1" />编辑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Editor Modal */}
      {formEditModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onCloseFormEdit()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-800">{formEditModal.name}</h3>
                <p className="text-xs text-gray-500">编号：{formEditModal.code}</p>
              </div>
              <button onClick={onCloseFormEdit} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <textarea value={formEditContent} onChange={e => onFormEditContentChange(e.target.value)}
                placeholder="在此编辑表单内容，支持 Markdown 格式..."
                rows={20} className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-800 bg-white resize-none outline-none" />
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex justify-between items-center shrink-0 rounded-b-2xl">
              <button onClick={onAiFillForm} disabled={aiFillLoading}
                className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${
                  aiFillLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                  'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                }`}>
                {aiFillLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiFillLoading ? 'AI填写中...' : 'AI自动填写'}
              </button>
              <div className="flex gap-2">
                <button onClick={onCloseFormEdit} className="px-4 py-2 text-gray-600 bg-white border rounded-lg text-sm">取消</button>
                <button onClick={onSaveFormEdit} className={`px-4 py-2 text-white rounded-lg text-sm ${colors.bg} ${colors.hover}`}>完成</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuideFormsTab;
