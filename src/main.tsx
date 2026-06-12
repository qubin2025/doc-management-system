import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ToastContainer from './components/Toast'
import './index.css'

// 全局错误捕获 — 过滤良性错误
window.addEventListener('error', (e) => {
  // ResizeObserver 和 Script error 是良性浏览器警告，不覆盖页面
  if (e.message?.includes('ResizeObserver') || e.message?.includes('Script error')) return;
  const msg = `[全局错误] ${e.message} at ${e.filename}:${e.lineno}`;
  document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:red;background:#fff;min-height:100vh"><h2>运行时错误</h2><pre style="white-space:pre-wrap;word-break:break-all">${msg}\n\n${e.error?.stack || ''}</pre></div>`;
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || e.reason || '';
  if (msg.includes('ResizeObserver') || msg.includes('Script error')) return;
  document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:red;background:#fff;min-height:100vh"><h2>未捕获Promise错误</h2><pre style="white-space:pre-wrap;word-break:break-all">${msg}\n\n${e.reason?.stack || ''}</pre></div>`;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ToastContainer />
  </React.StrictMode>,
)
