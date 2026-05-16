import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Upload, Plus, ArrowDown } from 'lucide-react';
import { DocumentItem, UploadInfo, FilterOptions } from '../types';
import UploadModal from './UploadModal';
import DownloadModal from './DownloadModal';
import FileListModal from './FileListModal';

interface DocumentTableProps {
  data: DocumentItem[];
  uploadInfo: Record<string, UploadInfo[]>;
  onUpload: (docId: string, info: UploadInfo) => void;
  onDelete: (docId: string, fileIndex: number) => void;
  filters: FilterOptions;
  currentUser: string;
  isAdmin: boolean;
  canUpload?: boolean;
  projectName: string;
}

const DocumentTable: React.FC<DocumentTableProps> = ({
  data,
  uploadInfo,
  onUpload,
  onDelete,
  filters,
  currentUser,
  isAdmin,
  canUpload = true,
  projectName
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['A1']));
  const [uploadModal, setUploadModal] = useState<{ show: boolean; docId: string }>({ show: false, docId: '' });
  const [downloadModal, setDownloadModal] = useState<{ show: boolean; docId: string }>({ show: false, docId: '' });
  const [fileListModal, setFileListModal] = useState<{ show: boolean; docId: string }>({ show: false, docId: '' });

  // 过滤数据
  const filteredData = data.filter(item => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.archiveUnit) {
      const unitMap: Record<string, keyof DocumentItem['archiveUnits']> = {
        '施工': 'construction',
        '监理': 'supervision',
        '建设': 'constructionUnit',
        '档案馆': 'archive'
      };
      if (!item.archiveUnits[unitMap[filters.archiveUnit]]) return false;
    }
    if (filters.searchKeyword) {
      const keyword = filters.searchKeyword.toLowerCase();
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.subCategoryName.toLowerCase().includes(keyword) ||
        item.tableCode.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword)
      );
    }
    return true;
  });

  // 按类别和子类别分组
  const groupedData = filteredData.reduce((acc, item) => {
    const key = `${item.category}-${item.subCategory}`;
    if (!acc[key]) {
      acc[key] = {
        category: item.category,
        subCategory: item.subCategory,
        subCategoryName: item.subCategoryName,
        items: []
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { category: string; subCategory: string; subCategoryName: string; items: DocumentItem[] }>);

  const toggleCategory = (key: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategories(newExpanded);
  };

  const handleUpload = (docId: string) => {
    setUploadModal({ show: true, docId });
  };

  const handleUploadSubmit = (info: UploadInfo) => {
    onUpload(uploadModal.docId, info);
    setUploadModal({ show: false, docId: '' });
  };

  // 获取某条资料的最新版本号
  const getLatestVersion = (docId: string): string => {
    const files = uploadInfo[docId];
    if (!files || files.length === 0) return '-';
    return files[files.length - 1].version;
  };

  // 获取上传文件名的显示文本
  const getUploadFileDisplay = (docId: string): string => {
    const files = uploadInfo[docId];
    if (!files || files.length === 0) return '-';
    if (files.length === 1) return files[0].fileName;
    return `${files[0].fileName} 等${files.length}个文件`;
  };

  // 渲染归档标记
  const renderArchiveMark = (required: boolean) => (
    <span className={`inline-block w-4 h-4 rounded-full ${required ? 'bg-green-500' : 'bg-gray-200'}`}>
      {required && <span className="sr-only">需要</span>}
    </span>
  );

  // 打开下载窗口
  const handleOpenDownload = (docId: string) => {
    setDownloadModal({ show: true, docId });
  };

  // 打开文件列表管理窗口
  const handleOpenFileList = (docId: string) => {
    const files = uploadInfo[docId];
    if (!files || files.length === 0) return;
    setFileListModal({ show: true, docId });
  };

  // 文件列表窗口中的删除
  const handleFileDelete = (fileIndex: number) => {
    onDelete(fileListModal.docId, fileIndex);
  };

  const docNameForDownload = data.find(d => d.id === downloadModal.docId)?.name || '';
  const docNameForFileList = data.find(d => d.id === fileListModal.docId)?.name || '';

  return (
    <div className="overflow-auto max-h-[calc(100vh-200px)] border border-gray-300 rounded-lg">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="border border-gray-300 p-2 w-8">展开</th>
            <th className="border border-gray-300 p-2 w-24">类别及编号</th>
            <th className="border border-gray-300 p-2 w-64">工程资料名称</th>
            <th className="border border-gray-300 p-2 w-24">表格编号</th>
            <th className="border border-gray-300 p-2 w-32">规范依据</th>
            <th className="border border-gray-300 p-2 w-20 text-center">施工</th>
            <th className="border border-gray-300 p-2 w-20 text-center">监理</th>
            <th className="border border-gray-300 p-2 w-20 text-center">建设</th>
            <th className="border border-gray-300 p-2 w-20 text-center">档案馆</th>
            <th className="border border-gray-300 p-2 w-48">上传文件名</th>
            <th className="border border-gray-300 p-2 w-32">上传时间</th>
            <th className="border border-gray-300 p-2 w-24">上传人</th>
            <th className="border border-gray-300 p-2 w-20">版本号</th>
            <th className="border border-gray-300 p-2 w-24">操作</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedData).map(([key, group]) => (
            <React.Fragment key={key}>
              {/* 子类别标题行 */}
              <tr
                className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                onClick={() => toggleCategory(key)}
              >
                <td className="border border-gray-300 p-2 text-center">
                  {expandedCategories.has(key) ? (
                    <ChevronDown className="w-4 h-4 mx-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mx-auto" />
                  )}
                </td>
                <td className="border border-gray-300 p-2 font-medium">
                  {group.subCategory}
                </td>
                <td colSpan={12} className="border border-gray-300 p-2 font-medium">
                  {group.subCategoryName}
                </td>
              </tr>
              {/* 明细行 */}
              {expandedCategories.has(key) && group.items.map((item, idx) => {
                const files = uploadInfo[item.id];
                const hasFiles = files && files.length > 0;
                const latestFile = hasFiles ? files[files.length - 1] : null;
                return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-yellow-50'}>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2 text-gray-500 text-center">
                    {item.id}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {item.name}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {item.tableCode || '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center text-xs">
                    {item.standard || '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {renderArchiveMark(item.archiveUnits.construction)}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {renderArchiveMark(item.archiveUnits.supervision)}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {renderArchiveMark(item.archiveUnits.constructionUnit)}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {renderArchiveMark(item.archiveUnits.archive)}
                  </td>
                  <td className="border border-gray-300 p-2 truncate max-w-48">
                    {hasFiles ? (
                      <button
                        onClick={() => handleOpenFileList(item.id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left max-w-full truncate"
                        title="点击管理文件"
                      >
                        {getUploadFileDisplay(item.id)}
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-2 text-gray-600 text-center">
                    {latestFile?.uploadTime || '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {latestFile?.uploader || '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    {getLatestVersion(item.id)}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* 上传 / 添加文件按钮 */}
                      {canUpload && (
                        <button
                          onClick={() => handleUpload(item.id)}
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title={hasFiles ? '添加文件' : '上传文档'}
                        >
                          {hasFiles ? <Plus className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                        </button>
                      )}
                      {/* 下载按钮：有文件时显示蓝色↓ */}
                      {hasFiles && (
                        <button
                          onClick={() => handleOpenDownload(item.id)}
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="下载文件"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* 上传弹窗 */}
      {uploadModal.show && (
        <UploadModal
          docName={data.find(d => d.id === uploadModal.docId)?.name || ''}
          onClose={() => setUploadModal({ show: false, docId: '' })}
          onSubmit={handleUploadSubmit}
          existingInfo={uploadInfo[uploadModal.docId]?.[uploadInfo[uploadModal.docId].length - 1]}
          projectName={projectName}
          matchData={data}
        />
      )}

      {/* 下载窗口 */}
      {downloadModal.show && (
        <DownloadModal
          docName={docNameForDownload}
          files={uploadInfo[downloadModal.docId] || []}
          onClose={() => setDownloadModal({ show: false, docId: '' })}
          projectName={projectName}
        />
      )}

      {/* 文件列表管理窗口 */}
      {fileListModal.show && (
        <FileListModal
          docName={docNameForFileList}
          files={uploadInfo[fileListModal.docId] || []}
          onClose={() => setFileListModal({ show: false, docId: '' })}
          canDelete={(uploader) => uploader === currentUser}
          canDeleteAny={isAdmin}
          onDelete={handleFileDelete}
          projectName={projectName}
        />
      )}
    </div>
  );
};

export default DocumentTable;
