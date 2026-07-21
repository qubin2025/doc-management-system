import React, { useEffect, useState } from 'react';
import { ArrowLeft, Camera, MapPin, Clock, User as UserIcon, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { listMobilePhotos, getMobilePhotoFile, fetchProjectsWithId, MobilePhotoItem } from '../mobile/data/mobileApi';

/** 单个照片缩略卡片 — 通过 API 带 Auth 头加载图片(base64) */
const PhotoCard: React.FC<{ photo: MobilePhotoItem; onClick: () => void; formatTime: (t: string) => string }> = ({ photo, onClick, formatTime }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    getMobilePhotoFile(photo.id).then(d => setSrc(d.fileData)).catch(() => {});
  }, [photo.id]);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
    >
      <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden relative">
        {src ? (
          <img src={src} alt="水印照片" className="w-full h-full object-cover" />
        ) : (
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent h-12 opacity-0 group-hover:opacity-100 transition-opacity flex items-end px-2 pb-1">
          <span className="text-white text-xs truncate">{formatTime(photo.createdAt)}</span>
        </div>
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(photo.createdAt)}</p>
        {photo.address && <p className="text-xs text-gray-500 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {photo.address}</p>}
        <p className="text-xs text-gray-400 flex items-center gap-1"><UserIcon className="w-3 h-3" /> {photo.uploadedBy}</p>
      </div>
    </div>
  );
};

interface Props {
  projectName: string;
  onBack: () => void;
}

const MobilePhotoViewer: React.FC<Props> = ({ projectName, onBack }) => {
  const [photos, setPhotos] = useState<MobilePhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const projects = await fetchProjectsWithId();
      const proj = projects.find(p => p.name === projectName);
      if (!proj) { setError('找不到对应项目'); return; }
      const list = await listMobilePhotos(proj.id);
      setPhotos(list);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectName]);

  // 大图预览
  const openPreview = async (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    setPreviewIndex(index);
    setPreviewId(photo.id);
    setPreviewData('');
    try {
      const { fileData } = await getMobilePhotoFile(photo.id);
      setPreviewData(fileData);
    } catch { setPreviewData(''); }
  };

  const closePreview = () => { setPreviewId(null); setPreviewData(''); };

  const navPreview = (dir: -1 | 1) => {
    const next = previewIndex + dir;
    if (next >= 0 && next < photos.length) openPreview(next);
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    const d = new Date(t + 'Z');
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={onBack} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> 返回首页
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" /> 手机水印照片
          </h1>
          <p className="text-xs text-gray-500">项目：{projectName} · 共 {photos.length} 张</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载照片中…
          </div>
        )}
        {error && !loading && (
          <div className="text-center py-24">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">重试</button>
          </div>
        )}
        {!loading && !error && photos.length === 0 && (
          <div className="text-center py-24 text-gray-400">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">暂无手机水印照片</p>
            <p className="text-sm">使用手机浏览器打开 mobile.html 拍摄上传后，照片将在此展示</p>
          </div>
        )}

        {/* 照片网格 */}
        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((p, i) => (
              <PhotoCard key={p.id} photo={p} onClick={() => openPreview(i)} formatTime={formatTime} />
            ))}
          </div>
        )}
      </main>

      {/* 大图预览弹窗 */}
      {previewId && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closePreview}>
          <button onClick={closePreview} className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 z-10">
            <X className="w-6 h-6" />
          </button>
          {previewIndex > 0 && (
            <button onClick={e => { e.stopPropagation(); navPreview(-1); }} className="absolute left-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 z-10">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {previewIndex < photos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); navPreview(1); }} className="absolute right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 z-10">
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {previewData ? (
              <img src={previewData} alt="水印照片" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            ) : (
              <div className="flex items-center justify-center w-64 h-64"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>
            )}
            {/* 水印信息 */}
            {photos[previewIndex] && (
              <div className="mt-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-white text-sm max-w-lg">
                <p><strong>时间：</strong>{formatTime(photos[previewIndex].createdAt)}</p>
                {photos[previewIndex].address && <p><strong>地点：</strong>{photos[previewIndex].address}</p>}
                {photos[previewIndex].latitude != null && (
                  <p><strong>坐标：</strong>{photos[previewIndex].latitude?.toFixed(6)}, {photos[previewIndex].longitude?.toFixed(6)}</p>
                )}
                <p><strong>拍摄人：</strong>{photos[previewIndex].uploadedBy}</p>
                {(photos[previewIndex].watermarkData?.template as string) && (
                  <p><strong>模板：</strong>{String(photos[previewIndex].watermarkData.template)}</p>
                )}
              </div>
            )}
            <p className="text-white/50 text-xs mt-2">{previewIndex + 1} / {photos.length}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePhotoViewer;
