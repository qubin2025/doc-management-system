import React, { useState } from 'react';
import { X, Download, File, Clock, User, Tag, Check } from 'lucide-react';
import { UploadInfo } from '../types';

interface DownloadModalProps {
  docName: string;
  files: UploadInfo[];
  onClose: () => void;
  projectName: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const DownloadModal: React.FC<DownloadModalProps> = ({ docName, files, onClose, projectName }) => {
  const [downloadedSet, setDownloadedSet] = useState<Set<number>>(new Set());
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);

  const handleDownload = async (file: UploadInfo, idx: number) => {
    const meta = file as any;
    const hasFile = meta.hasFile !== false;
    const canDownload = hasFile && (file.fileData || meta.id);
    if (!canDownload) return;
    setDownloadingIdx(idx);

    try {
      // 模式 1: Base64 内联
      if (file.fileData && file.fileData.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = file.fileData;
        a.download = file.fileName;
        a.click();
      }
      // 模式 2: 按需从服务器获取
      else if (meta.id) {
        const token = localStorage.getItem('doc-system-token') || '';
        const resp = await fetch(`${API_BASE}/documents/download/${meta.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`下载失败 (HTTP ${resp.status})`);

        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await resp.json();
          if (data.fileData) {
            const a = document.createElement('a');
            a.href = data.fileData;
            a.download = data.fileName || file.fileName;
            a.click();
          }
        } else {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      } else {
        return;
      }

      setDownloadedSet(prev => new Set(prev).add(idx));
      setTimeout(() => {
        setDownloadedSet(prev => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }, 2000);
    } catch (e: any) {
      console.error('Download failed:', e.message);
      alert(`下载失败：${e.message}`);
    } finally {
      setDownloadingIdx(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h3 className="text-lg font-semibold">文件下载</h3>
            <p className="text-sm text-gray-500 mt-1">
              资料名称：{docName}
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {projectName}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 文件列表 */}
        <div className="p-4 overflow-y-auto flex-1">
          {files.length === 0 ? (
            <p className="text-center text-gray-400 py-8">暂无上传文件</p>
          ) : (
            <div className="space-y-3">
              {files.map((file, idx) => {
                const meta = file as any;
                const hasFile = meta.hasFile !== false;
                const canDownload = hasFile && (!!file.fileData || !!meta.id);
                const isDownloaded = downloadedSet.has(idx);
                const isDownloading = downloadingIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isDownloaded
                        ? 'bg-green-50 border-green-300'
                        : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <File className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-medium text-sm truncate" title={file.fileName}>
                          {file.fileName}
                        </span>
                        {!file.fileData && meta.id && (
                          <span className="text-xs text-green-500">云端</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 ml-6">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {file.version}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {file.uploadTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {file.uploader}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file, idx)}
                      disabled={!canDownload || isDownloading || isDownloaded}
                      title={isDownloading ? '下载中…' : canDownload ? '下载文件' : '文件不可用'}
                      className={`ml-3 px-3 py-1.5 text-white rounded-lg transition-all flex items-center gap-1 text-sm shrink-0 min-w-[72px] justify-center ${
                        isDownloaded
                          ? 'bg-green-500 cursor-default'
                          : isDownloading
                            ? 'bg-blue-400 cursor-wait'
                            : canDownload
                              ? 'bg-blue-500 hover:bg-blue-600'
                              : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {isDownloaded ? (
                        <>
                          <Check className="w-4 h-4" />
                          已下载
                        </>
                      ) : isDownloading ? (
                        <>
                          <Download className="w-4 h-4 animate-pulse" />
                          下载中
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          下载
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-end p-4 border-t bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
