import React, { useState } from 'react';
import { X, Download, File, Clock, User, Tag, Check, Trash2 } from 'lucide-react';
import { UploadInfo } from '../types';

interface FileListModalProps {
  docName: string;
  files: UploadInfo[];
  onClose: () => void;
  canDelete: (uploader: string) => boolean;
  canDeleteAny: boolean;
  onDelete: (fileIndex: number) => void;
  projectName: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const FileListModal: React.FC<FileListModalProps> = ({
  docName, files, onClose, canDelete, canDeleteAny, onDelete, projectName
}) => {
  const [downloadedSet, setDownloadedSet] = useState<Set<number>>(new Set());
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // v6.0: 统一下载入口，支持 Base64 小文件 + 磁盘大文件两种模式
  const handleDownload = async (file: UploadInfo, idx: number) => {
    const meta = file as any;
    const hasFile = meta.hasFile !== false; // 兼容旧数据：无 hasFile 字段时回退到 fileData 判断
    const canDownload = hasFile && (file.fileData || meta.id);

    if (!canDownload) return;
    setDownloadingIdx(idx);

    try {
      // 模式 1: Base64 内联数据（小文件）
      if (file.fileData && file.fileData.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = file.fileData;
        a.download = file.fileName;
        a.click();
      }
      // 模式 2: 磁盘存储（大文件 / multipart）— 按需调用下载端点
      else if (meta.id) {
        const token = localStorage.getItem('doc-system-token') || '';
        const resp = await fetch(`${API_BASE}/documents/download/${meta.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`下载失败 (HTTP ${resp.status})`);

        // 判断响应类型：JSON (Base64) 还是二进制流 (res.download)
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await resp.json();
          if (data.fileData) {
            const a = document.createElement('a');
            a.href = data.fileData;
            a.download = data.fileName || file.fileName;
            a.click();
          } else {
            throw new Error('响应无文件数据');
          }
        } else {
          // 二进制流 — 直接用 blob URL 触发下载
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
      }
      // 模式 3: 有 fileData 但非 data: 前缀（历史遗留）
      else if (file.fileData) {
        const a = document.createElement('a');
        a.href = file.fileData;
        a.download = file.fileName;
        a.click();
      } else {
        throw new Error('文件数据不可用');
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

  const handleDelete = (idx: number) => {
    if (deleteConfirm === idx) {
      onDelete(idx);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(idx);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const fileCanDelete = (uploader: string) => canDeleteAny || canDelete(uploader);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h3 className="text-lg font-semibold">文件管理</h3>
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
                const deletable = fileCanDelete(file.uploader);

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-colors ${
                      isDownloaded
                        ? 'bg-green-50 border-green-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <File className="w-4 h-4 text-blue-500 shrink-0" />
                          <span
                            className={`font-medium text-sm truncate cursor-pointer hover:underline ${
                              canDownload ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title={file.fileName}
                            onClick={() => canDownload && handleDownload(file, idx)}
                          >
                            {file.fileName}
                          </span>
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
                          {!file.fileData && meta.id && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
                              云端
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* 下载按钮 */}
                        <button
                          onClick={() => handleDownload(file, idx)}
                          disabled={!canDownload || isDownloading || isDownloaded}
                          title={isDownloading ? '下载中…' : canDownload ? '下载文件' : '文件不可用'}
                          className={`p-1.5 text-white rounded transition-all ${
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
                            <Check className="w-3.5 h-3.5" />
                          ) : isDownloading ? (
                            <Download className="w-3.5 h-3.5 animate-pulse" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {/* 删除按钮 */}
                        <button
                          onClick={() => deletable && handleDelete(idx)}
                          disabled={!deletable}
                          title={deletable ? (deleteConfirm === idx ? '再次点击确认删除' : '删除文件') : '无删除权限（仅管理员或上传人可删除）'}
                          className={`p-1.5 rounded transition-all ${
                            deletable
                              ? deleteConfirm === idx
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* 删除确认提示 */}
                    {deleteConfirm === idx && (
                      <p className="text-xs text-red-600 mt-1.5 ml-6">
                        即将删除此文件，请再次点击删除按钮确认
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50 shrink-0">
          <p className="text-xs text-gray-400">
            点击文件名下载 • 仅管理员和上传人可删除文件
          </p>
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

export default FileListModal;
