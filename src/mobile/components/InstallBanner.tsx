// 移动端 PWA 安装引导 — 自动检测浏览器，给出针对性指引
import React, { useEffect, useState } from 'react';
import { Download, X, Share2, Copy, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'mobile-pwa-dismissed';
const STORAGE_KEY_INSTALLED = 'mobile-pwa-installed';

const InstallBanner: React.FC = () => {
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [alreadyInstalled, setAlreadyInstalled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_INSTALLED) === '1'; } catch { return false; }
  });

  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent);
  const isQQ = () => /QQ\//i.test(navigator.userAgent) && !/MicroMessenger/i.test(navigator.userAgent);
  const isBuiltinBrowser = () => isWeChat() || isQQ();
  const isChrome = () => /Chrome/i.test(navigator.userAgent) && !/Edge/i.test(navigator.userAgent);

  const isStandalone = () => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  };

  // 监听原生安装事件（仅HTTPS/localhost可用）
  useEffect(() => {
    if (isStandalone() || alreadyInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      (e as BeforeInstallPromptEvent).prompt().then(() => {
        (e as BeforeInstallPromptEvent).userChoice.then(r => {
          if (r.outcome === 'accepted') {
            try { localStorage.setItem(STORAGE_KEY_INSTALLED, '1'); } catch {}
            setAlreadyInstalled(true);
          }
        });
      }).catch(() => setShowGuide(true));
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [alreadyInstalled]);

  // 监听独立模式
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        try { localStorage.setItem(STORAGE_KEY_INSTALLED, '1'); } catch {}
        setAlreadyInstalled(true);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleDismiss = () => {
    setShowGuide(false);
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  const handleDismissForever = () => {
    handleDismiss();
    try { localStorage.setItem(STORAGE_KEY_INSTALLED, '1'); } catch {}
    setAlreadyInstalled(true);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isStandalone() || alreadyInstalled) return null;

  // === 微信/QQ 内置浏览器：提示用系统浏览器打开 ===
  if (showGuide && isBuiltinBrowser()) {
    const browserName = isWeChat() ? '微信' : 'QQ';
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end" onClick={handleDismiss}>
        <div className="bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">用浏览器打开以安装</h3>
            <button onClick={handleDismiss} className="p-1 text-gray-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
            {browserName}内置浏览器不支持安装应用到桌面，请改用系统自带浏览器或 Chrome 打开。
          </div>
          <div className="space-y-3 text-sm text-gray-600 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">1</div>
              <span>点击{browserName}右上角 <strong>···</strong> → <strong>在浏览器中打开</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">2</div>
              <span>在浏览器中进入本页面，点击底部<strong>「添加到主屏幕」</strong></span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={copyUrl} className="flex-1 py-2.5 border border-blue-200 text-blue-600 text-sm rounded-xl flex items-center justify-center gap-1.5">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '已复制' : '复制链接'}
            </button>
            <button onClick={handleDismiss} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl">知道了</button>
          </div>
        </div>
      </div>
    );
  }

  // === iOS Safari 引导 ===
  if (showGuide && isIOS()) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end" onClick={handleDismiss}>
        <div className="bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">添加到主屏幕</h3>
            <button onClick={handleDismiss} className="p-1 text-gray-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-3 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">1</div>
              <span>点击 Safari 底部 <Share2 className="w-4 h-4 inline text-blue-500" /> <strong>分享</strong> 按钮</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">2</div>
              <span>滑动找到 <strong>「添加到主屏幕」</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">3</div>
              <span>点击右上角 <strong>「添加」</strong></span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleDismissForever} className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl">不再提示</button>
            <button onClick={handleDismiss} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl">知道了</button>
          </div>
        </div>
      </div>
    );
  }

  // === Android 引导 ===
  if (showGuide) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end" onClick={handleDismiss}>
        <div className="bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">安装到桌面</h3>
            <button onClick={handleDismiss} className="p-1 text-gray-400"><X className="w-5 h-5" /></button>
          </div>

          {/* Chrome 专属提示 */}
          {isChrome() && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800">
              你正在使用 <strong>Chrome 浏览器</strong>，支持一键安装。按下方步骤操作：
            </div>
          )}

          <div className="space-y-3 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">1</div>
              <span>点击浏览器右上角 <strong>⋮</strong>（三个点）菜单</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">2</div>
              <span>在菜单中找到 <strong>「安装应用」</strong> 或 <strong>「添加到主屏幕」</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">3</div>
              <span>在弹出的对话框点击 <strong>「安装」</strong></span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 mb-4">
            提示：部分国产浏览器的「添加到主屏幕」是添加网页书签，不是真正的 App 安装。推荐使用 <strong>Chrome</strong> 或 <strong>系统自带浏览器</strong> 以获得最佳体验。
          </p>
          <div className="flex gap-2">
            <button onClick={handleDismissForever} className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl">不再提示</button>
            <button onClick={handleDismiss} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl">知道了</button>
          </div>
        </div>
      </div>
    );
  }

  // === 默认：底部蓝色横幅（始终可见） ===
  if (dismissed) return null;

  return (
    <button
      onClick={() => setShowGuide(true)}
      className="fixed bottom-4 left-4 right-4 z-50 bg-blue-600 text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3 active:scale-[0.98] transition-transform"
    >
      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-semibold">
          {isBuiltinBrowser()
            ? '请在系统浏览器中打开本页面以安装App'
            : isIOS()
            ? '添加到主屏幕 — 像App一样使用'
            : '安装到桌面 — 一键启动'}
        </p>
      </div>
      <X className="w-4 h-4 opacity-60 hover:opacity-100 shrink-0" onClick={e => { e.stopPropagation(); handleDismiss(); }} />
    </button>
  );
};

export default InstallBanner;
