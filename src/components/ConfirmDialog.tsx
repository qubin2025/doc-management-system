import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title, message, confirmLabel = '确定', cancelLabel = '取消',
  danger = false, onConfirm, onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="p-5 text-center">
          <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
            danger ? 'bg-red-500/10' : 'bg-amber-500/10'
          }`}>
            <AlertTriangle size={24} className={danger ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{title}</h3>
          <p className="text-sm text-[var(--text-muted)]">{message}</p>
        </div>
        <div className="flex border-t border-[var(--border-primary)]">
          <button onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-sm font-medium text-white transition-colors border-l border-[var(--border-primary)] ${
              danger ? 'bg-red-500 hover:bg-red-400' : 'bg-sky-500 hover:bg-sky-400'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
