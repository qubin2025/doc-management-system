import React from 'react';
import ReactDOM from 'react-dom/client';
import MobileApp from './MobileApp';
import '../index.css';

// PWA Service Worker — 仅生产构建(dist/)注册
// dev模式跳过: 避免HMR WebSocket冲突导致手机端页面反复刷新
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: false });
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);
