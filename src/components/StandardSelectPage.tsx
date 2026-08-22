import React from 'react';
import { Building2, Landmark } from 'lucide-react';
import type { StandardType } from '../types';
import ModuleHeader from './ModuleHeader';

interface StandardSelectProps {
  onBack: () => void;
  onSelectStandard: (std: StandardType) => void;
}

interface StandardInfo {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  headerBg: string;
}

const STANDARD_INFO: Record<string, StandardInfo> = {
  'DB11/T695-2025': {
    title: '建筑工程资料管理系统',
    subtitle: '《建筑工程资料管理规程》DB11/T 695-2025 附录A',
    icon: <Building2 className="w-12 h-12" />,
    headerBg: 'bg-blue-500',
  },
  'DB11/T808-2020': {
    title: '市政工程资料管理系统',
    subtitle: '《市政基础设施工程资料管理规程》DB11/T 808-2020 附录A',
    icon: <Landmark className="w-12 h-12" />,
    headerBg: 'bg-teal-600',
  },
};

const STANDARDS: StandardType[] = ['DB11/T695-2025', 'DB11/T808-2020'];

const StandardSelectPage: React.FC<StandardSelectProps> = ({ onBack, onSelectStandard }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <ModuleHeader
        title="工程资料管理系统"
        subtitle="请选择资料管理规程"
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-9 w-auto" />}
        onBack={onBack}
      />
      <div className="flex items-center justify-center p-4 pt-12">
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {STANDARDS.map((std) => {
              const info = STANDARD_INFO[std];
              return (
                <button key={std} onClick={() => onSelectStandard(std)}
                  className="bg-white rounded-xl shadow-lg p-8 text-left hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border-2 border-gray-200 hover:border-blue-400 group">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${info.headerBg} bg-opacity-10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <div className={std === 'DB11/T695-2025' ? 'text-blue-600' : 'text-teal-600'}>{info.icon}</div>
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">
                    {std === 'DB11/T695-2025' ? '建筑工程资料管理规程' : '市政基础设施工程资料管理规程'}
                  </h2>
                  <p className="text-sm text-gray-500 mb-1">{std}</p>
                  <p className="text-xs text-gray-400">
                    {std === 'DB11/T695-2025' ? '附录A — 建筑工程资料分类保存表' : '附录A — 市政工程资料分类保存表'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandardSelectPage;
