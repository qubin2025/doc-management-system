
import React, { useRef } from 'react';
import { FileText, Download, Printer, ChevronLeft, BookOpen, Clock, Shield, Star, Info } from 'lucide-react';

interface UserManualProps {
  onBack?: () => void;
  lang: 'en' | 'zh';
  t: any;
}

const UserManual: React.FC<UserManualProps> = ({ onBack, lang, t }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const downloadPdf = () => {
    window.print();
  };

  const downloadWord = () => {
    if (!contentRef.current) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Nexus3D Manual</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + contentRef.current.innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `Nexus3D_Manual_${lang}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const versions = [
    { ver: '1.1.8', date: '2024-05', desc: lang === 'zh' ? '系统重置功能与全局背景持久化。' : 'System reset and background persistence.' },
    { ver: '1.1.7', date: '2024-05', desc: lang === 'zh' ? '管理面板玻璃拟态透明化处理。' : 'Glassmorphism transparency for management panels.' },
    { ver: '1.1.6', date: '2024-05', desc: lang === 'zh' ? '移动端交互优化，防止按钮遮挡。' : 'Mobile UX optimization for visibility.' },
    { ver: '1.1.0', date: '2024-04', desc: lang === 'zh' ? '引入多级权限管理系统 (ACL)。' : 'Introduced multi-level access control (ACL).' },
    { ver: '1.0.0', date: '2024-03', desc: lang === 'zh' ? 'Nexus3D 初始版本发布。' : 'Nexus3D Initial Release.' },
  ];

  return (
    <div className="p-4 md:p-8 h-full flex flex-col max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 print:p-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-6 mb-8 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <BookOpen className="text-indigo-400" /> {t.manualTitle}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadPdf}
            className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl hover:bg-indigo-600/30 transition-all font-bold text-sm"
          >
            <Printer size={16} /> {t.downloadPdf}
          </button>
          <button 
            onClick={downloadWord}
            className="flex items-center gap-2 bg-green-600/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-xl hover:bg-green-600/30 transition-all font-bold text-sm"
          >
            <FileText size={16} /> {t.downloadWord}
          </button>
        </div>
      </header>

      <div 
        ref={contentRef} 
        className="flex-1 overflow-y-auto pr-2 space-y-12 text-gray-300 leading-relaxed print:text-black print:overflow-visible"
      >
        {/* Intro */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-white mb-2">
            <Info className="text-indigo-400" />
            <h3 className="text-2xl font-bold">{lang === 'zh' ? '项目简介' : 'Introduction'}</h3>
          </div>
          <p className="text-lg text-gray-400 italic font-medium">
            {t.manualIntro}
          </p>
        </section>

        {/* Versions */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-white">
            <Clock className="text-amber-400" />
            <h3 className="text-2xl font-bold">{t.manualVerTitle}</h3>
          </div>
          <div className="space-y-4 border-l-2 border-gray-800 ml-3 pl-8">
            {versions.map((v, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[37px] top-1.5 w-4 h-4 rounded-full bg-gray-950 border-2 border-gray-600" />
                <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-800/50 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-indigo-400 text-sm">v{v.ver}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">{v.date}</span>
                  </div>
                  <p className="text-sm">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-white">
            <Star className="text-green-400" />
            <h3 className="text-2xl font-bold">{t.manualFeaturesTitle}</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900/40 border border-gray-800/40 p-6 rounded-3xl">
              <h4 className="font-bold text-white mb-2 text-lg">1. {lang === 'zh' ? '3D 立体图谱' : '3D Visualization'}</h4>
              <p className="text-sm text-gray-400">{lang === 'zh' ? '支持任意角度拖拽、缩放及节点自动跟随相机。不同颜色代表不同职业分类。' : 'Supports dragging, zooming, and camera following. Colors represent professional categories.'}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 p-6 rounded-3xl">
              <h4 className="font-bold text-white mb-2 text-lg">2. {lang === 'zh' ? '搜索定位' : 'Search & Location'}</h4>
              <p className="text-sm text-gray-400">{lang === 'zh' ? '全局搜索功能，点击搜索结果可瞬间定位至该人物所在的 3D 节点空间。' : 'Global search instantly moves the camera to the specific 3D node location.'}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 p-6 rounded-3xl">
              <h4 className="font-bold text-white mb-2 text-lg">3. {lang === 'zh' ? '权限控制' : 'Access Control'}</h4>
              <p className="text-sm text-gray-400">{lang === 'zh' ? '基于 RBAC 模型的四级权限：超级管理员、管理员、集团领导、公司领导。' : 'Four levels of permissions based on RBAC: Super Admin, Admin, Group Leader, and Company Leader.'}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 p-6 rounded-3xl">
              <h4 className="font-bold text-white mb-2 text-lg">4. {lang === 'zh' ? '数据安全' : 'Data Security'}</h4>
              <p className="text-sm text-gray-400">{lang === 'zh' ? '全量数据的 CSV 导出/导入功能，以及针对管理员的系统重置保护。' : 'Full CSV export/import and system reset protection for admins.'}</p>
            </div>
          </div>
        </section>

        {/* Guide */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-white">
            <Shield className="text-indigo-400" />
            <h3 className="text-2xl font-bold">{t.manualGuideTitle}</h3>
          </div>
          <div className="space-y-8 bg-gray-900/20 p-8 rounded-3xl border border-gray-800/30">
            <div className="space-y-2">
              <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-xs">{lang === 'zh' ? '步骤 1: 登录认证' : 'Step 1: Authentication'}</h5>
              <p className="text-sm">{lang === 'zh' ? '输入授权的手机号码，并填入 6 位验证码（测试环境默认为 666666）。' : 'Enter authorized phone and 6-digit code (Default 666666 for test environment).'}</p>
            </div>
            <div className="space-y-2">
              <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-xs">{lang === 'zh' ? '步骤 2: 节点管理' : 'Step 2: Node Management'}</h5>
              <p className="text-sm">{lang === 'zh' ? '进入“管理面板”，您可以添加新的人物节点或建立人物之间的连接。不同关系类型（如工作、家庭）将显示不同的连线颜色。' : 'In Management, you can add nodes or create connections. Relation types show different colors.'}</p>
            </div>
            <div className="space-y-2">
              <h5 className="font-bold text-indigo-400 uppercase tracking-widest text-xs">{lang === 'zh' ? '步骤 3: 信息审计' : 'Step 3: Auditing'}</h5>
              <p className="text-sm">{lang === 'zh' ? '所有增删改查操作均会被记录在“审计日志”中，确保操作透明且可追溯。' : 'All CRUD operations are logged in Audit History for transparency.'}</p>
            </div>
          </div>
        </section>

        <footer className="pt-10 text-center text-xs text-gray-600 font-bold uppercase tracking-widest pb-20">
          &copy; 2024 Nexus3D Relationship Protocol. Produced by Senior UI Engineering Team.
        </footer>
      </div>
    </div>
  );
};

export default UserManual;
