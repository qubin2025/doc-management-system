import React, { useState, useCallback } from 'react';
import { X, Upload, File, Search, Loader } from 'lucide-react';
import { UploadInfo, DocumentItem } from '../types';

interface UploadModalProps {
  docName: string;
  onClose: () => void;
  onSubmit: (info: UploadInfo) => void;
  existingInfo?: UploadInfo;
  projectName: string;
  matchData?: DocumentItem[];
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
  const [sizeError, setSizeError] = useState('');

  const processFile = (selectedFile: File) => {
    setSizeError('');
    if (selectedFile.size > MAX_FILE_SIZE) {
      setSizeError(`文件过大（${(selectedFile.size / 1024 / 1024).toFixed(1)}MB），限制50MB以内。请压缩后上传。`);
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

  const handleSubmit = () => {
    if (!file && !existingInfo?.fileName) return;

    if (file) {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const info: UploadInfo = {
          fileName: file.name,
          uploadTime: new Date().toLocaleString('zh-CN'),
          uploader: uploader || '未知',
          version: version,
          fileData: reader.result as string
        };
        onSubmit(info);
        // 关闭弹窗由父组件处理
      };
      reader.onerror = () => {
        setUploading(false);
        alert('文件读取失败，请重试。');
      };
      reader.readAsDataURL(file);
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.jpg,.png,.zip,.rar,.7z,.gz,.tar"
            />
            <label htmlFor="file-upload" className={uploading ? 'cursor-not-allowed' : 'cursor-pointer'}>
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <Loader className="w-8 h-8 animate-spin" />
                  <span className="font-medium">正在处理文件...</span>
                </div>
              ) : file ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <File className="w-8 h-8" />
                  <span className="font-medium">{file.name}</span>
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">点击或拖拽文件到此处上传</p>
                  <p className="text-xs text-gray-400 mt-1">
                    支持 PDF、Word、Excel、CAD、图片、压缩包等格式（≤50MB）
                  </p>
                </>
              )}
            </label>
          </div>

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
            disabled={!file && !existingInfo?.fileName || uploading}
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
