import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, LogOut, Sun, Moon, Sparkles, Shield,
  ClipboardCheck, FileSearch, HardHat, CheckCircle2,
  Bot, Zap, BookOpen, Target, FileText, Camera,
  AlertTriangle, CalendarDays, TrendingUp, FlaskConical,
  BarChart3, Building2, Upload, Download, GitBranch,
  FileCheck, Users, Briefcase, History
} from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import ModelAdmin from './ModelAdmin';
import { useProject } from '../data/ProjectContext';
import type { ThemeMode } from '../data/themeEngine';

interface HomePageProps {
  themeMode: ThemeMode;
  onNavigate: (view: string, params?: { chapterId?: string }) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

/** 功能模块卡片数据 */
interface ModuleCard {
  view: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
  desc: string;
  gradient?: string;
  border: string;
}

const HomePage: React.FC<HomePageProps> = ({ themeMode, onNavigate, onToggleTheme, onLogout }) => {
  const { currentProject, isAdmin, auth } = useProject();
  const [showModelAdmin, setShowModelAdmin] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    fetch('/api/admin/system').then(r => r.json()).then(d => setVersion(d.version || '')).catch(() => {});
  }, []);

  const guideModules = [
    { id: 'ch1', icon: <ClipboardCheck className="w-6 h-6 text-blue-600" />, number: 1, title: '前期工作', desc: '项目立项、可行性研究、用地规划许可、建设许可、施工许可等前期管理' },
    { id: 'ch2', icon: <FileSearch className="w-6 h-6 text-amber-600" />, number: 2, title: '招标采购', desc: '招标文件编制、招标公告、评标定标、中标通知、合同签订与备案' },
    { id: 'ch3', icon: <HardHat className="w-6 h-6 text-emerald-600" />, number: 3, title: '工程施工', desc: '施工准备、质量管理、进度控制、安全监督、变更管理、监理协调' },
    { id: 'ch4', icon: <CheckCircle2 className="w-6 h-6 text-indigo-600" />, number: 4, title: '竣工验收及移交', desc: '竣工预验收、正式验收、备案归档、工程移交、竣工结算、保修管理' },
  ];

  const featureModules: ModuleCard[] = [
    { view: 'agent-console', icon: <Bot className="w-6 h-6 text-purple-600" />, title: 'AI智能体', badge: 'NEW', badgeColor: 'bg-purple-500', desc: '自主规划执行 · ReAct推理 · 多工具编排', gradient: 'from-indigo-50 to-purple-50', border: 'border-purple-200' },
    { view: 'skill-panel', icon: <Zap className="w-6 h-6 text-amber-600" />, title: '技能面板', badge: 'NEW', badgeColor: 'bg-amber-500', desc: '7个AI技能 · 审查/生成/填写 · 一键执行', gradient: 'from-amber-50 to-yellow-50', border: 'border-amber-200' },
    { view: 'pmbok', icon: <BookOpen className="w-6 h-6 text-blue-600" />, title: 'PMBOK框架', badge: 'NEW', badgeColor: 'bg-blue-500', desc: '10大知识领域 · 49过程 · 8大绩效域', gradient: 'from-blue-50 to-cyan-50', border: 'border-blue-200' },
    { view: 'tailoring-engine', icon: <ClipboardCheck className="w-6 h-6 text-purple-600" />, title: '模块裁剪', badge: 'NEW', badgeColor: 'bg-purple-500', desc: '项目特征问卷 · PMBOK裁剪建议 · 灵活组装模块', gradient: 'from-purple-50 to-violet-50', border: 'border-purple-200' },
    { view: 'target-manager', icon: <Target className="w-6 h-6 text-sky-600" />, title: '目标管理', badge: 'NEW', badgeColor: 'bg-sky-500', desc: 'OKR/WBS分解 · 目标-工作项联动 · 达成度自动计算', gradient: 'from-sky-50 to-blue-50', border: 'border-sky-200' },
    { view: 'standard-select', icon: <FileText className="w-6 h-6 text-blue-600" />, title: '工程资料管理', badge: '已上线 v1.0', badgeColor: 'bg-green-100 text-green-700', desc: '建筑/市政工程资料分类保存管理，DB11/T 695-2025 & DB11/T 808-2020 附录A', border: 'border-blue-300' },
    { view: 'land-reserve', icon: <FileText className="w-6 h-6 text-teal-600" />, title: '土储中心归档资料', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '土储中心归档移交资料规程，86项分类归档管理，上传自动填充', border: 'border-teal-300' },
    { view: 'mobile-photos', icon: <Camera className="w-6 h-6 text-cyan-600" />, title: '手机水印照片', badge: 'NEW', badgeColor: 'bg-cyan-500', desc: '工程现场手机拍照上传，含GPS/时间/项目/拍摄人水印，自动与电脑端同步', gradient: 'from-cyan-50 to-blue-50', border: 'border-cyan-300' },
    { view: 'issue-manager', icon: <AlertTriangle className="w-6 h-6 text-red-600" />, title: '现场问题管理', badge: 'NEW', badgeColor: 'bg-red-500', desc: '手机端上报现场问题，电脑端统一跟踪处理，状态流转闭环管理', gradient: 'from-red-50 to-orange-50', border: 'border-red-300' },
    { view: 'daily-report-manager', icon: <CalendarDays className="w-6 h-6 text-emerald-600" />, title: '项目日报', badge: '手机端', badgeColor: 'bg-emerald-100 text-emerald-700', desc: '手机端日报同步查看，天气/人机/安全数据汇总，AI趋势分析', gradient: 'from-emerald-50 to-teal-50', border: 'border-emerald-300' },
    { view: 'progress-manager', icon: <TrendingUp className="w-6 h-6 text-lime-600" />, title: '进度管理', badge: 'NEW', badgeColor: 'bg-lime-500', desc: '手机端进度快报与计划自动匹配，未关联提醒，进度可视化统计', gradient: 'from-lime-50 to-green-50', border: 'border-lime-300' },
    { view: 'experience', icon: <FlaskConical className="w-6 h-6 text-fuchsia-600" />, title: '项目经验库', badge: 'NEW', badgeColor: 'bg-fuchsia-500', desc: '从已完成项目自动提取经验模式，跨项目聚合分析，AI智能提示', gradient: 'from-fuchsia-50 to-pink-50', border: 'border-fuchsia-300' },
    { view: 'dashboard', icon: <BarChart3 className="w-6 h-6 text-purple-600" />, title: '项目仪表盘', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: 'CPI/SPI/完整度/质量分 KPI实时监控，异常预警，多项目对比', border: 'border-purple-300' },
    { view: 'plan-manager', icon: <Building2 className="w-6 h-6 text-indigo-600" />, title: '计划管理', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '项目进度甘特图、各章节完成度、里程碑节点、预计工期', border: 'border-indigo-300' },
    { view: 'supplier', icon: <Upload className="w-6 h-6 text-orange-600" />, title: '供应商库', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '供应商信息管理、资质审核标记、评价星级、供应商资源池', border: 'border-orange-300' },
    { view: 'cost', icon: <Download className="w-6 h-6 text-cyan-600" />, title: '造价数据', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '工程量清单录入、单位价格、分类汇总、成本合计', border: 'border-cyan-300' },
    { view: 'knowledge-base', icon: <BookOpen className="w-6 h-6 text-blue-600" />, title: '知识库', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '全文检索+语义搜索、文档自动索引、向量化知识库', border: 'border-blue-300' },
    { view: 'knowledge-graph', icon: <GitBranch className="w-6 h-6 text-purple-600" />, title: '知识图谱', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '项目-表单-文档-人员关系图谱、节点可点击跳转', border: 'border-purple-300' },
    { view: 'policy-library', icon: <FileText className="w-6 h-6 text-red-600" />, title: '政策库', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '全过程工程咨询服务相关政策法规、管理办法、技术标准', border: 'border-red-300' },
    { view: 'regulations-library', icon: <Shield className="w-6 h-6 text-teal-600" />, title: '制度规范库', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '土储中心制度规范、地方标准、工作规程、档案管理', border: 'border-teal-300' },
    { view: 'analysis', icon: <Sparkles className="w-6 h-6 text-purple-600" />, title: '智能分析', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: 'AI综合项目分析、风险预警、知识图谱、智能建议', border: 'border-emerald-300' },
    { view: 'construction-review', icon: <FileCheck className="w-6 h-6 text-amber-600" />, title: '施工组织设计审查', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '专项方案+施组审查、标准合规验证、知识图谱追溯', border: 'border-amber-300' },
    { view: 'contract-review', icon: <FileText className="w-6 h-6 text-blue-600" />, title: '合同审查', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '合同条款合规审查、风险条款识别、知识库标准对照', border: 'border-blue-300' },
    { view: 'contract-manager', icon: <BookOpen className="w-6 h-6 text-violet-600" />, title: '合同管理', badge: 'NEW', badgeColor: 'bg-violet-500', desc: '合同台账·AI审查·生成模板·沉淀知识', border: 'border-violet-300', gradient: 'from-violet-50 to-purple-50' },
    { view: 'plan-generator', icon: <Sparkles className="w-6 h-6 text-green-600" />, title: 'AI方案生成', badge: 'Phase3', badgeColor: 'bg-green-100 text-green-700', desc: 'AI逐章生成施工方案、标准条款自动注入、Word导出', border: 'border-green-300' },
    { view: 'bid-review', icon: <FileSearch className="w-6 h-6 text-indigo-600" />, title: '招投标文件审查', badge: '已上线', badgeColor: 'bg-green-100 text-green-700', desc: '招标文件合规性审查、评标要素提取、知识库辅助', border: 'border-indigo-300' },
  ];

  const mgmtModules: ModuleCard[] = [
    { view: 'stakeholder', icon: <Users className="w-6 h-6 text-orange-600" />, title: '干系人管理', desc: '登记册 · 权力/利益矩阵 · 参与策略', gradient: 'from-orange-50 to-amber-50', border: 'border-orange-200' },
    { view: 'risk', icon: <AlertTriangle className="w-6 h-6 text-red-600" />, title: '风险管理', desc: '登记册 · 概率×影响矩阵 · 应对跟踪', gradient: 'from-red-50 to-rose-50', border: 'border-red-200' },
    { view: 'resource', icon: <Briefcase className="w-6 h-6 text-blue-600" />, title: '资源与沟通', desc: '团队 · RACI矩阵 · 沟通记录', gradient: 'from-blue-50 to-cyan-50', border: 'border-blue-200' },
    { view: 'baseline', icon: <History className="w-6 h-6 text-teal-600" />, title: '基线管理', desc: '三大基线快照 · 版本对比 · KPI追踪', gradient: 'from-teal-50 to-emerald-50', border: 'border-teal-200' },
  ];

  const renderCard = (m: ModuleCard) => {
    const isNew = m.badge === 'NEW' || m.badge?.startsWith('NEW');
    const bgClass = m.gradient ? `bg-gradient-to-br ${m.gradient}` : 'bg-white';
    return (
      <button key={m.view} onClick={() => onNavigate(m.view)}
        className={`${bgClass} rounded-xl shadow-sm p-5 text-left border-2 ${m.border} hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative overflow-hidden`}>
        {m.badge && (
          <div className={`absolute top-2 right-2 px-1.5 py-0.5 text-xs rounded-full ${m.badgeColor || 'bg-purple-500'} ${m.badgeColor?.includes('text-') ? '' : 'text-white'} font-bold`}>
            {m.badge}
          </div>
        )}
        <div className={`w-11 h-11 rounded-lg ${isNew ? 'bg-purple-100' : 'bg-gray-50'} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
          {m.icon}
        </div>
        <h3 className="text-base font-bold text-gray-800 mb-1">{m.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
      </button>
    );
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <header className="bg-slate-300/70 backdrop-blur-md shadow-sm border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 sticky top-0 z-30">
        <div className={`text-center py-1.5 text-xs font-bold ${currentProject ? 'bg-blue-500 text-white' : 'bg-blue-400 text-white'}`}>
          {currentProject ? `当前项目：${currentProject}` : '全局模式 — 未进入具体项目，AI将回答全局信息'}
        </div>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">中航建科 · 工程咨询管理平台</h1>
              <p className="text-xs text-gray-600">项目全过程数智化管理</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> 项目看板
            </button>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isAdmin ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {isAdmin ? '管理员' : auth?.user?.role === 'project_manager' ? '项目经理' : auth?.user?.role === 'construction_unit' ? '建设单位' : '用户'}
            </span>
            {isAdmin && (
              <button onClick={() => setShowModelAdmin(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="模型配置">
                <Sparkles className="w-3.5 h-3.5" /> 模型
              </button>
            )}
            {isAdmin && (
              <button onClick={() => onNavigate('admin')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="系统管理">
                <Shield className="w-3.5 h-3.5" /> 管理
              </button>
            )}
            {currentProject && <GlobalSearch projectName={currentProject} onNavigate={(view, params) => {
              if (params?.chapterId) { onNavigate('guide-chapter', { chapterId: params.chapterId }); }
              else onNavigate(view);
            }} />}
            <button onClick={onToggleTheme}
              title={themeMode === 'dark' ? '切换亮色主题' : '切换暗色主题'}
              className="p-1.5 rounded-lg transition-colors hover:scale-110"
              style={{ background: themeMode === 'dark' ? 'rgba(251,191,36,0.12)' : 'rgba(30,58,138,0.06)', border: themeMode === 'dark' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(30,58,138,0.12)' }}>
              {themeMode === 'dark'
                ? <Sun className="w-3.5 h-3.5 text-amber-400" />
                : <Moon className="w-3.5 h-3.5 text-indigo-500" />
              }
            </button>
            <button onClick={onLogout} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-3.5 h-3.5" /> 退出
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* 指南工作模块 */}
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">指南工作模块</h2>
        <p className="text-center text-gray-500 mb-8 text-sm">各模块以项目为单位严格按照指南手册内容执行，大模型智能分析驱动全过程管理</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {guideModules.map((m) => (
            <button key={m.id} onClick={() => onNavigate('guide-chapter', { chapterId: m.id })}
              className="bg-white rounded-xl shadow-sm p-5 text-left border-2 border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 hover:border-gray-300 group cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">{m.icon}</div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-gray-800">第{m.number}章 {m.title}</h3>
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">已上线</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* 功能模块 */}
        <div className="flex items-center gap-4 mb-12">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400 font-medium">功能模块</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">功能模块</h2>
        <p className="text-center text-gray-500 mb-8 text-sm">各模块以项目为单位打通数据联系，大模型智能分析驱动全过程管理</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featureModules.map(renderCard)}
        </div>

        {/* 管理模块 */}
        <h2 className="text-2xl font-bold text-gray-800 text-center mt-8 mb-2">管理模块</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">干系人 · 风险 · 资源 · 基线 — PMBOK全套管理工具</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {mgmtModules.map(renderCard)}
        </div>

        {/* 高级工具 */}
        <h2 className="text-2xl font-bold text-gray-800 text-center mt-6 mb-2">高级工具</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">工作流引擎 · 审计日志 — 自动化与合规工具</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <button onClick={() => onNavigate('workflow')}
            className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl shadow-sm p-5 text-left border-2 border-violet-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer">
            <div className="w-11 h-11 rounded-lg bg-violet-100 flex items-center justify-center mb-3"><Zap className="w-6 h-6 text-violet-600" /></div>
            <h3 className="text-base font-bold text-gray-800 mb-1">工作流引擎</h3>
            <p className="text-xs text-gray-500 leading-relaxed">4个预设模板 · 一键执行 · 步骤可视化</p>
          </button>
          {isAdmin && (
            <>
              <button onClick={() => onNavigate('knowledge-review')}
                className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl shadow-sm p-5 text-left border-2 border-purple-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer">
                <div className="w-11 h-11 rounded-lg bg-purple-100 flex items-center justify-center mb-3"><BookOpen className="w-6 h-6 text-purple-600" /></div>
                <h3 className="text-base font-bold text-gray-800 mb-1">知识审核</h3>
                <p className="text-xs text-gray-500 leading-relaxed">审批知识条目 · 质量把关 · 合规管理</p>
              </button>
              <button onClick={() => onNavigate('audit-log')}
                className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl shadow-sm p-5 text-left border-2 border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group cursor-pointer">
                <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center mb-3"><Shield className="w-6 h-6 text-gray-600" /></div>
                <h3 className="text-base font-bold text-gray-800 mb-1">审计日志</h3>
                <p className="text-xs text-gray-500 leading-relaxed">操作追溯 · 合规审计 · 安全监控</p>
              </button>
            </>
          )}
        </div>
      </div>
      <footer className="text-center text-xs text-gray-400 py-8">中航建科 · 工程咨询管理平台{version && <span className="ml-1">v{version}</span>}</footer>
    </div>
    {showModelAdmin && <ModelAdmin onClose={() => setShowModelAdmin(false)} />}
    </>
  );
};

// TODO Phase 2: 拆分为 Header/GuideModules/FeatureGrid/ManagementModules/AdvancedTools 子组件（当前~230行，预留拆分空间）
export default HomePage;
