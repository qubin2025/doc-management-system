// 上传队列展示 — 内存态，失败标红显示原因
import React from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { UploadItem } from '../types';

const UploadQueue: React.FC<{ items: UploadItem[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-slate-500">上传记录（本次会话）</h2>
      {items.map(item => (
        <div key={item.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center gap-2.5">
          {item.thumbUrl && item.status !== 'done'
            ? <img src={item.thumbUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
            : null}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 truncate">{item.fileName}</p>
            {item.status === 'error' && <p className="text-xs text-red-500 truncate">{item.error || '上传失败'}</p>}
          </div>
          {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
          {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {item.status === 'error' && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
        </div>
      ))}
    </div>
  );
};

export default UploadQueue;
