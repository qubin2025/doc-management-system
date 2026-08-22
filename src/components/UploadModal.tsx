import React, { useState, useCallback } from 'react';
import { X, Upload, File, Search, Loader, FileArchive, Zap } from 'lucide-react';
import { UploadInfo, DocumentItem } from '../types';
import { toast } from './Toast';
import { indexDocument } from '../data/ragService';
import * as api from '../data/api';
import { isCompressible, getCompressSuggestion, compressImage, formatFileSize, CompressResult } from '../utils/fileCompressor';

interface UploadModalProps {
  docName: string;
  onClose: () => void;
  onSubmit: (info: UploadInfo) => void;
  existingInfo?: UploadInfo;
  projectName: string;
  matchData?: DocumentItem[];
}

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB（multipart 流式上传，支持 CAD 大图纸）
const BASE64_THRESHOLD = 10 * 1024 * 1024; // >10MB 走 multipart，≤10MB 走 base64 兼容

// 智能匹配函数（通用）
const matchDocumentCategory = (fileName: string, data: DocumentItem[]): DocumentItem[] => {
  const keywords = fileName.toLowerCase().replace(/\.[^/.]+$/, '');
  const matches: { item: DocumentItem; score: number }[] = [];

  data.forEach(item => {
    let score = 0;
    const docName = item.name.toLowerCase();
    const keywords_lower = keywords.toLowerCase();
    if (docName.includes(keywords_lower) || keywords_lower.includes(docName)) {
      score = 100;
    } else {
      const docWords = docName.split(/[、，。（）()]/).filter(w => w.length > 2);
      docWords.forEach(word => {
        if (keywords_lower.includes(word)) {
          score += word.length * 2;
        }
      });
    }
    if (score > 0) {
      matches.push({ item, score });
    }
  });
  return matches.sort((a, b) => b.score - a.score).slice(0, 5).map(m => m.item);
};

const UploadModal: React.FC<UploadModalProps> = ({
  docName,
  onClose,
  onSubmit,
  existingInfo,
  projectName,
  matchData = []
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploader, setUploader] = useState(existingInfo?.uploader || '');
  const [version, setVersion] = useState('V1.0');
  const [suggestions, setSuggestions] = useState<DocumentItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sizeError, setSizeError] = useState('');
  // v6.0: 压缩相关状态
  const [compressResult, setCompressResult] = useState<CompressResult | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [useCompressed, setUseCompressed] = useState(false);

  const processFile = (selectedFile: File) => {
    setSizeError('');
    // 重置压缩状态
    setCompressResult(null);
    setCompressing(false);
    setCompressProgress(0);
    setUseCompressed(false);

    if (selectedFile.size > MAX_FILE_SIZE) {
      setSizeError(`文件过大（${(selectedFile.size / 1024 / 1024).toFixed(1)}MB），限制200MB以内。超大图纸请拆分后上传。`);
      setFile(null);
      return;
    }
    setFile(selectedFile);
    if (matchData.length > 0) {
      const matches = matchDocumentCategory(selectedFile.name, matchData);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, []);

  const handleSubmit = async () => {
    if (!file && !existingInfo?.fileName) return;

    if (file) {
      setUploading(true);
      setUploadProgress(0);

      const uploadFile = getUploadFile();

      const meta = {
        uploadTime: new Date().toLocaleString('zh-CN'),
        uploader: uploader || '未知',
        version: version,
        standard: 'DB11/T695-2025',
      };

      try {
        if (uploadFile.size > BASE64_THRESHOLD) {
          // 大文件：multipart 流式上传（支持进度）
          await api.uploadDocumentMultipart(
            projectName,
            docName, // 使用 docName 作为 docId（与原逻辑一致）
            uploadFile,
            meta,
            (percent) => setUploadProgress(percent)
          );

          // 上传成功后，通知父组件更新本地状态（不传 fileData，只传元信息）
          const info: UploadInfo = {
            fileName: uploadFile.name,
            uploadTime: meta.uploadTime,
            uploader: meta.uploader,
            version: meta.version,
          };
          onSubmit(info);
          toast(`上传成功: ${uploadFile.name} (${(uploadFile.size / 1024 / 1024).toFixed(1)}MB)`, 'success');
        } else {
          // 小文件：保持原 base64 方式（兼容旧逻辑）
          const reader = new FileReader();
          reader.onload = () => {
            const info: UploadInfo = {
              fileName: uploadFile.name,
              uploadTime: meta.uploadTime,
              uploader: meta.uploader,
              version: meta.version,
              fileData: reader.result as string
            };
            onSubmit(info);
          };
          reader.onerror = () => {
            toast('文件读取失败，请重试。', 'error');
          };
          reader.readAsDataURL(uploadFile);
        }

        // AI索引 — 完全独立的 fire-and-forget，不阻塞上传
        indexDocument(uploadFile, projectName)
          .then(result => toast(`AI已学习: ${uploadFile.name} (${result.chunks}段)`, 'success'))
          .catch(() => {});

        setUploading(false);
        onClose();
      } catch (err: any) {
        setUploading(false);
        setUploadProgress(0);
        toast(err.message || '上传失败，请重试', 'error');
      }
    } else {
      const info: UploadInfo = {
        fileName: existingInfo?.fileName || '',
        uploadTime: new Date().toLocaleString('zh-CN'),
        uploader: uploader || '未知',
        version: version
      };
      onSubmit(info);
    }
  };

  const selectSuggestion = (_item: DocumentItem) => {
    setShowSuggestions(false);
  };

  // v6.0: 压缩图片
  const handleCompress = async () => {
    if (!file || !isCompressible(file)) return;
    setCompressing(true);
    setCompressProgress(0);
    try {
      const result = await compressImage(file, {
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        onProgress: (p) => setCompressProgress(p),
      });
      setCompressResult(result);
      if (!result.skipped) {
        setUseCompressed(true);
        toast(`压缩完成: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (减少${((1 - result.ratio) * 100).toFixed(0)}%)`, 'success');
      } else {
        toast('图片已足够小，无需压缩', 'info');
      }
    } catch (err: any) {
      toast(err.message || '压缩失败', 'error');
    } finally {
      setCompressing(false);
    }
  };

  // 获取实际上传的文件（压缩后或原文件）
  const getUploadFile = (): File => {
    if (useCompressed && compressResult && !compressResult.skipped) {
      return compressResult.file;
    }
    return file!;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">上传文档</h3>
            <p className="text-sm text-gray-500 mt-1">
              资料名称：{docName}
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {projectName}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 文件上传区域 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              uploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.jpg,.jpeg,.png,.zip,.rar,.txt,.csv,.md,.json,.html"
            />
            <label htmlFor="file-upload" className={uploading ? 'cursor-not-allowed' : 'cursor-pointer'}>
              {uploading ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Loader className="w-8 h-8 animate-spin" />
                    <span className="font-medium">
                      {uploadProgress > 0 ? `上传中 ${uploadProgress}%` : '正在处理文件...'}
                    </span>
                  </div>
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-green-600">
                    <File className="w-8 h-8" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)}MB
                    {file.size > BASE64_THRESHOLD && (
                      <span className="ml-2 text-blue-600">（将使用流式上传）</span>
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">点击或拖拽文件到此处上传</p>
                  <p className="text-xs text-gray-400 mt-1">
                    支持 PDF、Word、Excel、CAD(.dwg/.dxf)、图片、压缩包等格式（≤200MB）
                  </p>
                </>
              )}
            </label>
          </div>

          {/* v6.0: 压缩建议与操作 */}
          {file && !sizeError && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <FileArchive className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm text-gray-600">
                  {getCompressSuggestion(file) || '文件将直接上传'}
                </div>
              </div>

              {/* 图片压缩按钮 */}
              {isCompressible(file) && !compressResult && (
                <button
                  onClick={handleCompress}
                  disabled={compressing || uploading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  {compressing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      压缩中 {compressProgress}%
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      压缩图片（推荐，可减少 50-70% 体积）
                    </>
                  )}
                </button>
              )}

              {/* 压缩进度条 */}
              {compressing && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${compressProgress}%` }}
                  />
                </div>
              )}

              {/* 压缩结果 */}
              {compressResult && !compressResult.skipped && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {formatFileSize(compressResult.originalSize)} →{' '}
                      <span className="text-green-600 font-medium">{formatFileSize(compressResult.compressedSize)}</span>
                    </span>
                    <span className="text-green-600 font-medium">
                      减少 {((1 - compressResult.ratio) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUseCompressed(true)}
                      className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        useCompressed
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      使用压缩版
                    </button>
                    <button
                      onClick={() => setUseCompressed(false)}
                      className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        !useCompressed
                          ? 'bg-gray-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      使用原图
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 文件大小错误提示 */}
          {sizeError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {sizeError}
            </div>
          )}

          {/* 自动匹配建议 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Search className="w-4 h-4" />
                <span className="text-sm font-medium">智能匹配建议</span>
              </div>
              <div className="space-y-1">
                {suggestions.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(item)}
                    className={`p-2 rounded cursor-pointer text-sm ${
                      idx === 0 ? 'bg-blue-100 border border-blue-300' : 'bg-white hover:bg-blue-50'
                    }`}
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.category} - {item.subCategoryName} | 匹配度: {idx === 0 ? '最高' : idx === 1 ? '高' : '中'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 上传人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              上传人
            </label>
            <input
              type="text"
              value={uploader}
              onChange={(e) => setUploader(e.target.value)}
              placeholder="请输入上传人姓名"
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* 版本号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              版本号
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="如 V1.0"
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={(!file && !existingInfo?.fileName) || uploading}
            className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading && <Loader className="w-4 h-4 animate-spin" />}
            {uploading ? '处理中...' : '确认上传'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
