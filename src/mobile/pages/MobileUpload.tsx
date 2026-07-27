// 手机文件上传页 — 选文件 → Base64 编码 → 上传到 documents 表
import React, { useRef, useState } from 'react';
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { MobileProject } from '../types';
import { uploadDocument } from '../data/mobileApi';

const MobileUpload: React.FC<{ project: MobileProject; onBack: () => void }> = ({ project, onBack }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(''); setDone(false); }
  };

  const handleUpload = async () => {
    if (!file) { setError('请先选择文件'); return; }
    if (!docId.trim()) { setError('请输入资料类别'); return; }
    setUploading(true);
    setError('');
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });
      await uploadDocument({
        projectId: project.id,
        docId: docId.trim(),
        fileName: file.name,
        fileData: base64,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-2 py-2 flex items-center gap-1 sticky top-0 z-10">
        <button onClick={onBack} className="p-2.5 rounded-lg active:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="flex-1 text-base font-semibold text-slate-800 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-500" /> 文件上传
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {done ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-800 mb-1">上传成功</p>
            <p className="text-sm text-slate-500 mb-6">{file?.name}</p>
            <button onClick={() => { setFile(null); setDocId(''); setDone(false); }}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-xl active:bg-blue-700">
              继续上传
            </button>
          </div>
        ) : (
          <>
            {/* 选文件区 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[3/1] rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 active:bg-blue-50"
            >
              {file ? (
                <>
                  <FileText className="w-10 h-10 text-blue-500" />
                  <p className="text-sm text-slate-700 font-medium">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-300" />
                  <p className="text-sm text-slate-400">点击选择文件</p>
                  <p className="text-xs text-slate-300">支持 PDF/Word/Excel/图片</p>
                </>
              )}
            </button>

            {/* 资料类别 */}
            <input
              type="text"
              value={docId}
              onChange={e => setDocId(e.target.value)}
              placeholder="资料类别（如：C1-施工组织设计）"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="w-full h-12 rounded-xl bg-blue-600 text-white text-base font-medium flex items-center justify-center gap-2 active:bg-blue-700 disabled:opacity-50"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? '上传中…' : '上传文件'}
            </button>

            <p className="text-xs text-slate-400 text-center">
              上传到项目「{project.name}」· 电脑端工程资料管理中可见
            </p>
          </>
        )}
      </main>

      <input ref={fileInputRef} type="file" className="hidden"
        onChange={handleFile}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.jpg,.jpeg,.png,.zip,.rar" />
    </div>
  );
};

export default MobileUpload;
