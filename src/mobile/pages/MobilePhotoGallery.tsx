// 手机照片浏览页 — 网格展示 + 日期筛选 + 大图预览 + 左右滑动 + 水印信息
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ArrowLeft, Image, MapPin, Clock, User as UserIcon, Loader2, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { listMobilePhotos, getMobilePhotoFile, MobilePhotoItem } from '../data/mobileApi';
import { MobileProject } from '../types';

const MONTHS = ['全部', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const MobilePhotoGallery: React.FC<{ project: MobileProject; onBack: () => void }> = ({ project, onBack }) => {
  const [photos, setPhotos] = useState<MobilePhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewIdx, setPreviewIdx] = useState(-1);
  const [previewSrc, setPreviewSrc] = useState('');
  const [monthFilter, setMonthFilter] = useState(0); // 0 = 全部
  const touchStartX = useRef(0);

  useEffect(() => {
    listMobilePhotos(project.id).then(setPhotos).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [project.id]);

  const filteredPhotos = useMemo(() => {
    if (monthFilter === 0) return photos;
    return photos.filter(p => {
      const d = new Date(p.createdAt + 'Z');
      return d.getMonth() + 1 === monthFilter;
    });
  }, [photos, monthFilter]);

  // 按日期分组
  const dateGroups = useMemo(() => {
    const groups: Record<string, MobilePhotoItem[]> = {};
    for (const p of filteredPhotos) {
      const key = (p.createdAt || '').slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredPhotos]);

  const openPreview = async (i: number) => {
    setPreviewIdx(i);
    setPreviewSrc('');
    try {
      const { fileData } = await getMobilePhotoFile(filteredPhotos[i].id);
      setPreviewSrc(fileData);
    } catch { setPreviewSrc(''); }
  };

  const nav = (d: -1 | 1) => {
    const next = previewIdx + d;
    if (next >= 0 && next < filteredPhotos.length) openPreview(next);
  };

  // 触摸滑动
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 80) nav(diff > 0 ? 1 : -1);
  };

  const fmt = (t: string) => t ? new Date(t + 'Z').toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const fmtDate = (t: string) => t ? new Date(t + 'Z').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) : '';
  

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-2 py-2 flex items-center gap-1 sticky top-0 z-10">
        <button onClick={onBack} className="p-2.5 rounded-lg active:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <h1 className="flex-1 text-base font-semibold text-slate-800 flex items-center gap-2"><Image className="w-5 h-5 text-purple-500" />照片浏览</h1>
        <span className="text-xs text-slate-400">{filteredPhotos.length} 张</span>
      </header>

      {/* 月份筛选 */}
      <div className="bg-white border-b border-slate-100 px-3 py-2 overflow-x-auto">
        <div className="flex gap-1.5">
          {MONTHS.map((m, i) => (
            <button key={i} onClick={() => setMonthFilter(i)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${monthFilter === i ? 'bg-purple-100 text-purple-700' : 'text-slate-500 bg-slate-50'}`}>
              {i === 0 && <Calendar className="w-3 h-3 inline mr-0.5" />}{m}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-3">
        {loading && (<div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />加载中…</div>)}
        {error && (<div className="text-center py-24 text-sm text-red-600">{error}</div>)}
        {!loading && !error && filteredPhotos.length === 0 && (
          <div className="text-center py-24 text-slate-400">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{monthFilter ? `${monthFilter}月暂无照片` : '暂无水印照片'}</p>
          </div>
        )}

        {/* 按日期分组网格 */}
        {dateGroups.map(([date, items]) => (
          <div key={date} className="mb-4">
            <h3 className="text-xs font-semibold text-slate-500 mb-2 ml-1">{fmtDate(date)} · {items.length} 张</h3>
            <div className="grid grid-cols-3 gap-2">
              {items.map((p) => {
                const idx = filteredPhotos.indexOf(p);
                return (
                  <button key={p.id} onClick={() => openPreview(idx)}
                    className="aspect-square rounded-xl bg-white border border-slate-200 overflow-hidden active:opacity-80 relative">
                    <ThumbnailLoader photoId={p.id} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-1">
                      <p className="text-white text-xs truncate">{fmt(p.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* 大图预览弹窗 — 触摸滑动 */}
      {previewIdx >= 0 && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex items-center justify-between px-3 py-2">
            <button onClick={() => setPreviewIdx(-1)} className="p-2 text-white"><X className="w-6 h-6" /></button>
            <span className="text-white text-sm">{previewIdx + 1}/{filteredPhotos.length}</span>
            <div className="w-10" />
          </div>
          <div className="flex-1 flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
            {previewIdx > 0 && (
              <button onClick={() => nav(-1)} className="absolute left-2 p-2 rounded-full bg-white/20 text-white z-10"><ChevronLeft className="w-5 h-5" /></button>
            )}
            {previewSrc ? (
              <img src={previewSrc} alt="" className="max-w-full max-h-full object-contain" />
            ) : (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            )}
            {previewIdx < filteredPhotos.length - 1 && (
              <button onClick={() => nav(1)} className="absolute right-2 p-2 rounded-full bg-white/20 text-white z-10"><ChevronRight className="w-5 h-5" /></button>
            )}
          </div>
          {/* 底部水印信息 */}
          {photos[previewIdx] && (
            <div className="bg-white/10 backdrop-blur mx-4 mb-4 rounded-xl px-4 py-3 text-white text-xs space-y-1">
              <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {photos[previewIdx].createdAt}</div>
              {photos[previewIdx].address && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {photos[previewIdx].address}</div>}
              <div className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {photos[previewIdx].uploadedBy}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** 单个缩略图通过 API 加载 Base64 */
const ThumbnailLoader: React.FC<{ photoId: number }> = ({ photoId }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    getMobilePhotoFile(photoId).then(d => setSrc(d.fileData)).catch(() => {});
  }, [photoId]);
  return src ? (
    <img src={src} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
    </div>
  );
};

export default MobilePhotoGallery;
