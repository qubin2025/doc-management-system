import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMsg { id: number; type: ToastType; message: string; }

let toastId = 0;
let addToastFn: ((msg: Omit<ToastMsg, 'id'>) => void) | null = null;

// 全局调用：toast('消息内容', 'success')
export function toast(message: string, type: ToastType = 'info') {
  if (addToastFn) addToastFn({ type, message });
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
};

const colors: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  warning: 'border-yellow-200 bg-yellow-50',
  info: 'border-blue-200 bg-blue-50',
};

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    addToastFn = (msg) => {
      const id = ++toastId;
      setToasts(prev => [...prev.slice(-4), { ...msg, id }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-start gap-2 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-right ${colors[t.type]}`}>
          {icons[t.type]}
          <p className="text-sm flex-1">{t.message}</p>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="text-gray-400 hover:text-gray-600 shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
