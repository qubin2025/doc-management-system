import React from 'react';
import ReactDOM from 'react-dom/client';
import MobileApp from './MobileApp';
import '../index.css';

// PWA Service Worker 仅在移动端入口注册
// immediate:false 防止登录页填写过程中被SW强制刷新
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: false });
  }).catch(() => { /* dev模式无SW，忽略 */ });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);
