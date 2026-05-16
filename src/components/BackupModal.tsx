import React, { useState, useEffect } from 'react';
import { X, Download, Package, Loader2 } from 'lucide-react';
import * as api from '../data/api';

interface BackupModalProps {
  onClose: () => void;
}

interface BackupProject {
  id: number;
  name: string;
}

const BackupModal: React.FC<BackupModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'all' | 'project'>('all');
  const [projects, setProjects] = useState<BackupProject[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.fetchProjects().then((list: any[]) => {
      setProjects(list.map((p: any) => ({ id: p.id ?? 0, name: p.name })));
    }).catch(() => {});
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const url = mode === 'all'
      ? `${base}/backup/all`
      : `${base}/backup/project/${selectedProject}`;

    // 直接打开下载链接（浏览器会处理下载）
    const token = api.getAuthToken();
    window.open(url + (token ? `?token=${encodeURIComponent(token)}` : ''), '_blank');

    setTimeout(() => { setDownloading(false); setDone(true); }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">数据备份</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMode('all')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              全部项目
            </button>
            <button onClick={() => setMode('project')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'project' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              指定项目
            </button>
          </div>

          {mode === 'project' && (
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- 选择项目 --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            {mode === 'all'
              ? '备份所有项目数据，包括数据库和上传文件，打包为 ZIP 下载。'
              : '备份指定项目的文档记录和上传文件，打包为 ZIP 下载。'
            }
          </div>

          {done && (
            <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
              <Download className="w-4 h-4" /> 下载已开始，请查看浏览器下载列表。
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">关闭</button>
          <button onClick={handleDownload}
            disabled={downloading || (mode === 'project' && !selectedProject)}
            className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center gap-2">
            {downloading ? <><Loader2 className="w-4 h-4 animate-spin" /> 下载中...</> : <><Download className="w-4 h-4" /> 下载备份</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupModal;
