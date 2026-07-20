// 移动端水印相机核心页 — 拍照/选图 → Canvas水印合成 → 上传
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Image as ImageIcon, MapPin, Settings2, UploadCloud, Loader2, RotateCcw } from 'lucide-react';
import { MobileProject, WatermarkTemplate, GeoResult, UploadItem } from '../types';
import { UserInfo } from '../../types';
import { drawWatermark, loadImageFromFile, formatWatermarkTime, buildWatermarkLines } from '../lib/watermark';
import { getPosition, geoFailureHint } from '../lib/geolocation';
import { uploadPhoto } from '../data/mobileApi';
import UploadQueue from '../components/UploadQueue';

interface Props {
  user: UserInfo;
  project: MobileProject;
  template: WatermarkTemplate;
  onBack: () => void;
  onOpenTemplates: () => void;
}

const CameraPage: React.FC<Props> = ({ user, project, template, onBack, onOpenTemplates }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState<UploadItem[]>([]);

  // 进入页面即定位
  useEffect(() => {
    getPosition().then(setGeo);
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const photographer = user.displayName || user.username;

  const buildContext = () => ({
    time: formatWatermarkTime(),
    projectName: project.name,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    address: manualAddress.trim(),
    photographer,
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    setError('');
    try {
      const img = await loadImageFromFile(file);
      const blob = await drawWatermark(img, template, buildContext());
      URL.revokeObjectURL(img.src);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPendingBlob(blob);
    } catch (err: any) {
      setError(err.message || '照片处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (!pendingBlob) return;
    const item: UploadItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'uploading',
      fileName: `水印照片_${formatWatermarkTime().replace(/[-: ]/g, '')}.jpg`,
      thumbUrl: previewUrl,
    };
    setQueue(q => [item, ...q]);
    const blob = pendingBlob;
    setPendingBlob(null);
    setPreviewUrl('');
    try {
      await uploadPhoto(blob, item.fileName, {
        projectId: project.id,
        location: manualAddress.trim(),
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        address: manualAddress.trim(),
        watermarkData: { template: template.name, lines: buildWatermarkLines(template, buildContext()) },
      });
      setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'done' } : x));
    } catch (err: any) {
      setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', error: err.message } : x));
    }
  };

  const geoText = geo?.ok
    ? `${geo.latitude!.toFixed(5)}, ${geo.longitude!.toFixed(5)}`
    : geo ? geoFailureHint(geo.reason) : '定位中…';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-2 py-2 flex items-center gap-1 sticky top-0 z-10">
        <button onClick={onBack} className="p-2.5 rounded-lg active:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-800 truncate">{project.name}</h1>
          <p className="text-xs text-slate-400">水印相机 · {template.name}</p>
        </div>
        <button onClick={onOpenTemplates} className="p-2.5 rounded-lg active:bg-slate-100" aria-label="水印模板设置">
          <Settings2 className="w-5 h-5 text-slate-600" />
        </button>
      </header>

      <main className="flex-1 p-4 space-y-4 pb-28">
        {/* 定位状态条 */}
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${geo?.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{geoText}</span>
          {!geo?.ok && geo && (
            <button onClick={() => { setGeo(null); getPosition().then(setGeo); }} className="shrink-0 underline">重试</button>
          )}
        </div>

        {/* 位置描述（手动补充，HTTP降级时为主要位置来源） */}
        <input
          type="text"
          value={manualAddress}
          onChange={e => setManualAddress(e.target.value)}
          placeholder="位置描述（如：3号楼基坑东侧）"
          className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* 预览区 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {processing ? (
            <div className="aspect-[4/3] flex items-center justify-center text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> 水印合成中…
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="水印照片预览" className="w-full" />
          ) : (
            <div className="aspect-[4/3] flex flex-col items-center justify-center text-slate-300">
              <Camera className="w-12 h-12 mb-2" />
              <p className="text-sm">拍照或选择照片后在此预览</p>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <UploadQueue items={queue} />
      </main>

      {/* 底部操作栏 */}
      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-3">
        {pendingBlob ? (
          <>
            <button
              onClick={() => { setPendingBlob(null); setPreviewUrl(''); }}
              className="h-12 px-4 rounded-xl border border-slate-300 text-slate-600 text-sm flex items-center gap-1.5 active:bg-slate-50"
            >
              <RotateCcw className="w-4 h-4" /> 重拍
            </button>
            <button
              onClick={handleUpload}
              className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-base font-medium flex items-center justify-center gap-2 active:bg-blue-700"
            >
              <UploadCloud className="w-5 h-5" /> 上传照片
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => albumInputRef.current?.click()}
              disabled={processing}
              className="h-12 px-4 rounded-xl border border-slate-300 text-slate-600 text-sm flex items-center gap-1.5 active:bg-slate-50 disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" /> 相册
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={processing}
              className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-base font-medium flex items-center justify-center gap-2 active:bg-blue-700 disabled:opacity-50"
            >
              <Camera className="w-5 h-5" /> 拍 照
            </button>
          </>
        )}
      </footer>

      {/* 隐藏 input：capture=environment 直接调起后置相机；相册入口不带 capture */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={albumInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
};

export default CameraPage;
