
import React from 'react';
import { AuditLogEntry } from '../types';
import { History, Activity, User, Clock, Info, Download, Upload, ShieldAlert, ChevronLeft } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  onBack?: () => void;
  t: any;
}

const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, onBack, t }) => {
  const getActionIcon = (action: string) => {
    if (action.startsWith('ADD')) return <Activity size={24} />;
    if (action.startsWith('DELETE')) return <ShieldAlert size={24} />;
    if (action === 'EXPORT_DATA') return <Download size={24} />;
    if (action === 'IMPORT_DATA') return <Upload size={24} />;
    return <Info size={24} />;
  };

  const getActionColor = (action: string) => {
    if (action.startsWith('ADD')) return 'bg-green-500/10 text-green-500';
    if (action.startsWith('DELETE')) return 'bg-red-500/10 text-red-500';
    if (action === 'EXPORT_DATA') return 'bg-indigo-500/10 text-indigo-500';
    if (action === 'IMPORT_DATA') return 'bg-emerald-500/10 text-emerald-500';
    if (action === 'VERSION_UPDATE') return 'bg-amber-500/10 text-amber-500';
    return 'bg-blue-500/10 text-blue-500';
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
      <header className="flex items-center justify-between border-b border-gray-800 pb-6 mb-8">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden p-2 -ml-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <History className="text-indigo-400 hidden sm:block" /> {t.auditTitle}
            </h2>
            <p className="text-gray-400 text-sm mt-1">{t.auditDesc}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{t.totalOps}</p>
          <p className="text-xl md:text-2xl font-black text-indigo-400">{logs.length}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 md:pr-4">
        {logs.map(log => (
          <div key={log.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 md:p-5 hover:border-gray-700 transition-colors flex gap-4 md:gap-6 items-start">
            <div className={`p-2 md:p-3 rounded-lg shrink-0 ${getActionColor(log.action)}`}>
              {getActionIcon(log.action)}
            </div>
            <div className="flex-1 space-y-1 overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-bold text-gray-100 flex items-center gap-2 text-sm md:text-base">
                  {log.action.replace('_', ' ')}
                </h4>
                <div className="flex items-center gap-4 text-[10px] md:text-xs text-gray-500 font-mono">
                  <span className="flex items-center gap-1 shrink-0"><Clock size={12}/> {new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-gray-400 text-xs md:text-sm break-words leading-relaxed">{log.details}</p>
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                <User size={12} className="text-gray-600" />
                <span className="text-[10px] md:text-xs text-indigo-400 font-semibold">{log.userName}</span>
                <span className="text-[9px] md:text-[10px] text-gray-600 px-1.5 py-0.5 border border-gray-800 rounded">ID: {log.userId}</span>
              </div>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-4">
            <Info size={48} className="opacity-20" />
            <p className="text-lg">{t.noLogs}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogView;
