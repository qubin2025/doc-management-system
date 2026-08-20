import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Sparkles, FileText, Loader2, BookOpen, RefreshCw, Zap, Play, Pause, Activity, Upload } from 'lucide-react';
import { vectorStore, VectorDoc } from '../data/vectorStore';
import * as api from '../data/api';
import { toast } from './Toast';
import lunr from 'lunr';
import ModuleHeader from './ModuleHeader';
import { kbSyncService, SyncResult } from '../data/kbSyncService';
// 5.6: 前端改为调用后端 Worker API（kbQueueProcessor 保留作为降级方案）
import { kbWorkerStart, kbWorkerStop, kbWorkerStatus, KbWorkerStatus, kbMigrateLocalVectors } from '../data/api';
// 5.13: 双跑期保留 — 前端降级处理器（后端不可用时启用 / 双跑加速模式启用）
import { startQueuePoller, stopQueuePoller, isPollerRunning } from '../data/kbQueueProcessor';

interface Props { onBack: () => void; }

const LIBS = ['全部', '规程规范', '政策法规', '项目经验', '方案模板', '工程归档'] as const;
const LIFECYCLES = ['全部', '前期工作', '招标采购', '工程施工', '竣工验收', '项目归档'] as const;
const PROFESSIONS = ['全部', '土建', '机电', '市政', '安全', '造价', '合同', '监理'] as const;

const KnowledgeBase: React.FC<Props> = ({ onBack }) => {
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'fulltext'|'semantic'|'hybrid'>('fulltext');
  const [results, setResults] = useState<VectorDoc[]>([]);
  const [graphResults, setGraphResults] = useState<{nodes:any[];edges:any[]}|null>(null);
  const [graphragTrace, setGraphragTrace] = useState<{nodes:any[];edges:any[];context:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const [allDocs, setAllDocs] = useState<VectorDoc[]>([]);
  const [libFilter, setLibFilter] = useState(0);
  const [lifecycle, setLifecycle] = useState(0);
  const [profession, setProfession] = useState(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  // 5.6: 改为后端 Worker 状态（替代本地 polling/queueStats）
  const [workerStatus, setWorkerStatus] = useState<KbWorkerStatus | null>(null);
  const [workerBusy, setWorkerBusy] = useState(false);  // 操作中（启动/停止/处理）
  const [workerMsg, setWorkerMsg] = useState('');  // 操作反馈消息
  const [workerDetailOpen, setWorkerDetailOpen] = useState(false);  // 5.11: Worker 健康监控详情面板开关
  // 5.12: localStorage 向量迁移到 SQLite 状态
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState('');
  const [migrateProgress, setMigrateProgress] = useState<{ done: number; total: number; inserted: number; skipped: number } | null>(null);
  // 5.13: 双跑期保留 — Worker 模式 (backend 默认 / frontend 降级 / hybrid 双跑加速)
  const [workerMode, setWorkerMode] = useState<'backend' | 'frontend' | 'hybrid'>('backend');
  const [backendFailCount, setBackendFailCount] = useState(0);  // 连续失败次数（≥3 自动降级）
  const [modeSwitchOpen, setModeSwitchOpen] = useState(false);  // 模式切换菜单

  // v5.7 迭代4: 用户权限感知 — 加载当前用户可访问项目 + 最高敏感等级
  const [myProjects, setMyProjects] = useState<api.MyProjectAccess[]>([]);
  const [maxSensitivity, setMaxSensitivity] = useState<number>(2);  // 默认 2=机密（全局 admin 或未登录时）
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    // 读取当前用户信息判断是否 admin
    try {
      const auth = JSON.parse(localStorage.getItem('doc-system-auth') || '{}');
      const user = auth?.user;
      if (user?.role === 'admin') {
        setIsAdmin(true);
        setMaxSensitivity(2);
        return;  // 全局 admin 不需要拉取 my-projects（拥有全部权限）
      }
    } catch {}
    // 非 admin 用户：拉取 my-projects 计算 maxSensitivity
    api.fetchMyProjects().then(projects => {
      setMyProjects(projects);
      // 取用户在所有项目中的最高敏感等级
      const maxSens = projects.length > 0 ? Math.max(...projects.map(p => p.sensitivity)) : 0;
      setMaxSensitivity(maxSens);
    }).catch(() => {
      // 拉取失败：保守起见设为 0（仅公开）
      setMaxSensitivity(0);
    });
  }, []);

  // 方案模板库 → 读取 contract_templates
  useEffect(() => {
    if (libFilter !== 4) { setTemplates([]); return; } // 4 = 方案模板
    const t = JSON.parse(localStorage.getItem('doc-system-auth') || '{}')?.token;
    fetch('/api/contracts/templates/list', { headers: { Authorization: 'Bearer ' + (t || '') } })
      .then(r => r.json()).then(d => setTemplates(d || [])).catch(() => {});
  }, [libFilter]);

  useEffect(() => {
    // v5.7 迭代4: 加载文档时按用户权限过滤（admin 不过滤，非 admin 按 maxSensitivity 过滤）
    const all = vectorStore.getAllDocs();
    if (isAdmin) {
      setAllDocs(all);
    } else {
      const allowed = new Set((myProjects.length > 0 ? myProjects : []).map(p => p.name));
      setAllDocs(all.filter(d => {
        const sens = d.metadata?.sensitivity ?? 0;
        if (sens > maxSensitivity) return false;
        // 有项目权限列表时，仅显示用户有访问权的项目文档
        if (myProjects.length > 0) {
          const projName = d.metadata?.projectName;
          return !projName || allowed.has(projName);
        }
        return true;
      }));
    }
  }, [isAdmin, myProjects, maxSensitivity]);

  // 5.11: Worker 健康监控辅助函数
  const formatUptime = (ms: number): string => {
    if (!ms || ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m${s % 60 > 0 ? ` ${s % 60}s` : ''}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  };
  const formatDateTime = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch { return iso; }
  };

  // Lunr 全文索引
  const lunrIdx = useMemo(() => {
    if (allDocs.length === 0) return null;
    return lunr(function (this: any) {
      this.ref('id');
      this.field('text');
      this.field('fileName');
      allDocs.forEach(d => this.add({ id: d.id, text: d.text, fileName: d.metadata?.fileName || '' }));
    });
  }, [allDocs]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true); setGraphResults(null);
    try {
      if (searchMode === 'hybrid') {
        // 混合检索：优先LightRAG，降级后端混合检索
        try {
          const r = await api.lightragSearch(search.trim(), 10, 'hybrid');
          if (r?.results) {
            const docs = r.results.filter((x:any)=>x.type!=='graph').map((x:any) => ({
              id: x.source||'', text: x.content||'', embedding: [0], metadata: {fileName:x.source||'', source:x.source||''}, score: x.score||0
            })) as any;
            setResults(docs);
            const g = r.results.find((x:any)=>x.type==='graph');
            if (g) setGraphResults(g);
            return;
          }
        } catch {}
        // 5.9: 改为调用后端混合检索（向量+BM25 融合在后端完成）
        const qEmbed = await api.embedText(search.trim(), 'query');
        const hybridResp = await api.kbSearchHybrid(qEmbed, search.trim(), { topK: 15 });
        const hits: VectorDoc[] = (hybridResp.results || []).map(r => ({
          id: r.id,
          text: r.text,
          embedding: [],
          metadata: {
            fileName: r.docName || r.docId,
            source: r.docId,
            projectName: r.project,
            sensitivity: r.sensitivity,
            score: r.score,
            vecScore: (r as any).vecScore,
            bm25Score: (r as any).bm25Score,
            ...(r.metadata || {}),
          },
        }));
        // 5.9: 后端已做 sensitivity 过滤，前端仅做项目权限过滤（非 admin）
        setResults(isAdmin ? hits : hits.filter(d => {
          if (myProjects.length > 0) {
            const projName = d.metadata?.projectName;
            return !projName || myProjects.some(p => p.name === projName);
          }
          return (d.metadata?.sensitivity ?? 0) <= 0;
        }));
      } else if (searchMode === 'semantic') {
        const qEmbed = await api.embedText(search.trim(), 'query');
        // 5.7: 改为调用后端检索 API（后端自动处理 sensitivity 过滤）
        const searchResp = await api.kbSearch(qEmbed, { topK: 10 });
        const hits: VectorDoc[] = (searchResp.results || []).map(r => ({
          id: r.id,
          text: r.text,
          embedding: [],
          metadata: {
            fileName: r.docName || r.docId,
            source: r.docId,
            projectName: r.project,
            sensitivity: r.sensitivity,
            score: r.score,
            ...(r.metadata || {}),
          },
        }));
        // 5.7: 后端已做 sensitivity 过滤，前端仅做项目权限过滤（非 admin）
        setResults(isAdmin ? hits : hits.filter(d => {
          if (myProjects.length > 0) {
            const projName = d.metadata?.projectName;
            return !projName || myProjects.some(p => p.name === projName);
          }
          return (d.metadata?.sensitivity ?? 0) <= 0;
        }));
      } else {
        if (!lunrIdx) { setResults([]); setLoading(false); return; }
        setResults(lunrIdx.search(search.trim()).map((h: any) => allDocs.find(d => d.id === h.ref)!).filter(Boolean));
      }
    } catch (e: any) { toast('搜索失败: ' + e.message, 'error'); }
    finally { setLoading(false); }
    // 合规查询→GraphRAG溯源
    if (/标准|规范|GB|JGJ|DB|条款|合规|验收/.test(search.trim())) {
      const token = localStorage.getItem('doc-system-token') || JSON.parse(localStorage.getItem('doc-system-auth')||'{}')?.token;
      fetch('/api/kg/graphrag/search?keyword=' + encodeURIComponent(search.trim()) + '&depth=1&seedLimit=5', { headers: { Authorization: 'Bearer ' + (token||'') } })
        .then(r => r.json()).then(d => { if (d.nodes) setGraphragTrace(d); }).catch(() => {});
    } else { setGraphragTrace(null); }
  };

  // 分类统计
  const categories = useMemo(() => {
    const cats: Record<string, number> = {};
    allDocs.forEach(d => {
      const proj = d.metadata?.projectName || '未分类';
      cats[proj] = (cats[proj] || 0) + 1;
    });
    return cats;
  }, [allDocs]);

  const handleShowAll = () => { setResults(allDocs); setSearch(''); };
  const handleClear = () => { setResults([]); setSearch(''); };

  const handleSync = async (forceFull: boolean) => {
    if (syncing) return;
    setSyncing(true); setSyncMsg('开始同步业务数据...');
    try {
      const result = await kbSyncService.syncAll(forceFull, (msg) => setSyncMsg(msg));
      setLastSync(result);
      if (result.success) {
        toast(`同步完成：日报 ${result.daily.synced} 段 / 问题 ${result.issues.synced} 条 / 经验 ${result.experiences.synced} 条，耗时 ${(result.duration / 1000).toFixed(1)}s`, 'success');
        setAllDocs(vectorStore.getAllDocs()); // 刷新列表
        // 5.6: 同步成功后触发后端 Worker 处理队列
        setSyncMsg('触发后端 Worker 处理队列...');
        try {
          const r = await kbWorkerStart();
          if (r.success && r.action === 'started') {
            toast('Worker 已启动处理队列', 'info');
          }
          const status = await kbWorkerStatus();
          setWorkerStatus(status);
        } catch (e: unknown) {
          // Worker 触发失败不影响同步结果
          console.warn('Worker 启动失败（不影响同步结果）:', e);
        }
      } else {
        toast(`同步失败：${result.error || '未知错误'}`, 'error');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast('同步异常: ' + msg, 'error');
    } finally {
      setSyncing(false);
      setSyncMsg('');
    }
  };

  // 5.6: 组件挂载时获取后端 Worker 状态
  // 5.6 + 5.13: 后端健康检查轮询（挂载时立即检查一次 + 每 3s 持续检查）
  // 失败计数 ≥3 自动降级到 frontend 模式；workerMode 切换时重启轮询
  useEffect(() => {
    let active = true;
    const checkHealth = () => {
      kbWorkerStatus()
        .then((s) => {
          if (!active) return;
          setWorkerStatus(s);
          setBackendFailCount(0);
        })
        .catch(() => {
          if (!active) return;
          setBackendFailCount((c) => {
            const next = c + 1;
            if (next >= 3 && workerMode === 'backend') {
              setWorkerMode('frontend');
              toast('后端 Worker 连续 3 次无响应，已自动切换到前端降级模式', 'info');
            }
            return next;
          });
        });
    };
    checkHealth();  // 立即检查一次
    const t = setInterval(checkHealth, 3000);
    return () => { active = false; clearInterval(t); };
  }, [workerMode]);

  // 5.13: 根据 workerMode 启停前端轮询器
  // backend: 不启动前端轮询（仅后端 Worker 处理）
  // frontend: 启动前端轮询（后端不可用时的降级模式）
  // hybrid: 启动前端轮询 + 同时启用后端 Worker（双跑加速，原子领取避免重复处理）
  useEffect(() => {
    if (workerMode === 'frontend' || workerMode === 'hybrid') {
      if (!isPollerRunning()) {
        startQueuePoller((msg) => setWorkerMsg(msg));
        console.log(`[5.13] 前端轮询已启动 (mode=${workerMode})`);
      }
    } else {
      if (isPollerRunning()) {
        stopQueuePoller();
        console.log('[5.13] 前端轮询已停止 (mode=backend)');
      }
    }
    return () => {
      if (isPollerRunning()) stopQueuePoller();
    };
  }, [workerMode]);

  // 5.13: hybrid 模式时自动启动后端 Worker（如未运行）
  useEffect(() => {
    if (workerMode === 'hybrid' && !workerStatus?.worker.isRunning && !workerBusy) {
      kbWorkerStart()
        .then((r) => {
          if (r.success) toast('双跑模式：后端 Worker 已启动', 'success');
        })
        .catch((e) => console.warn('[5.13] 后端 Worker 启动失败（不影响前端轮询）:', e));
    }
  }, [workerMode, workerStatus?.worker.isRunning, workerBusy]);

  // 5.13: 切换 Worker 模式
  const handleSwitchWorkerMode = (mode: 'backend' | 'frontend' | 'hybrid') => {
    if (mode === workerMode) { setModeSwitchOpen(false); return; }
    setWorkerMode(mode);
    setModeSwitchOpen(false);
    const labels = { backend: '后端 Worker 模式', frontend: '前端降级模式', hybrid: '双跑加速模式' };
    toast(`已切换到${labels[mode]}`, 'info');
  };

  // 5.6: 启动/停止后端 Worker
  const handleToggleWorker = async () => {
    if (workerBusy) return;
    setWorkerBusy(true);
    try {
      if (workerStatus?.worker.isRunning) {
        setWorkerMsg('正在停止 Worker（等待优雅退出）...');
        const r = await kbWorkerStop();
        if (r.success) { toast(`Worker 已停止（${r.elapsedMs}ms）`, 'info'); setWorkerMsg(''); }
        else { toast('停止失败: ' + r.message, 'error'); }
      } else {
        setWorkerMsg('正在启动 Worker...');
        const r = await kbWorkerStart();
        if (r.success) { toast(r.message, 'success'); setWorkerMsg(''); }
        else { toast('启动失败: ' + r.message, 'error'); }
      }
      const status = await kbWorkerStatus();
      setWorkerStatus(status);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast('Worker 操作异常: ' + msg, 'error');
    } finally {
      setWorkerBusy(false);
      setWorkerMsg('');
    }
  };

  // 5.6: 触发后端 Worker 处理一批（如果未运行则启动）
  const handleTriggerWorker = async () => {
    if (workerBusy) return;
    setWorkerBusy(true);
    setWorkerMsg('触发后端处理...');
    try {
      const r = await kbWorkerStart();
      if (r.success) {
        toast(r.action === 'started' ? 'Worker 已启动，开始处理队列' : 'Worker 已在运行中', 'success');
      } else {
        toast('触发失败: ' + r.message, 'error');
      }
      // 等待 2s 让 Worker 跑一轮，然后刷新状态
      setTimeout(async () => {
        const status = await kbWorkerStatus();
        setWorkerStatus(status);
        setAllDocs(vectorStore.getAllDocs());
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast('触发处理异常: ' + msg, 'error');
    } finally {
      setWorkerBusy(false);
      setWorkerMsg('');
    }
  };

  // 5.12: 把 localStorage 中的旧向量数据迁移到后端 SQLite vector_embeddings 表
  const handleMigrateLocalVectors = async () => {
    if (migrating) return;
    setMigrating(true);
    setMigrateProgress(null);
    try {
      // 1. 从 localStorage 读取所有 vector-store-* 数据
      const allDocs: VectorDoc[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('vector-store-')) continue;
        try {
          const data = JSON.parse(localStorage.getItem(k) || '{}');
          if (Array.isArray(data?.vectors)) {
            for (const d of data.vectors) {
              if (d && d.id && d.text && Array.isArray(d.embedding)) {
                allDocs.push(d);
              }
            }
          }
        } catch {}
      }
      if (allDocs.length === 0) {
        toast('localStorage 中无可迁移的向量数据', 'info');
        return;
      }
      // 2. 分批迁移（每批 100 条）
      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);
      let totalInserted = 0;
      let totalSkipped = 0;
      for (let i = 0; i < totalBatches; i++) {
        const batch = allDocs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setMigrateMsg(`迁移批次 ${i + 1}/${totalBatches}（${batch.length} 条）...`);
        const r = await kbMigrateLocalVectors(batch);
        if (!r.success) {
          toast(`批次 ${i + 1} 迁移失败: ${r.error || '未知错误'}`, 'error');
          break;
        }
        totalInserted += r.inserted || 0;
        totalSkipped += r.skipped || 0;
        setMigrateProgress({
          done: (i + 1) * BATCH_SIZE,
          total: allDocs.length,
          inserted: totalInserted,
          skipped: totalSkipped,
        });
      }
      toast(`迁移完成：成功 ${totalInserted} 条 · 跳过 ${totalSkipped} 条 · 总计 ${allDocs.length} 条`, 'success');
      // 3. 刷新 Worker 状态
      const status = await kbWorkerStatus();
      setWorkerStatus(status);
      setAllDocs(vectorStore.getAllDocs());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast('迁移异常: ' + msg, 'error');
    } finally {
      setMigrating(false);
      setMigrateMsg('');
      setTimeout(() => setMigrateProgress(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ModuleHeader
        title="知识库"
        subtitle={`${allDocs.length} 条索引 · 全文/语义/混合检索`}
        icon={<img src="/zhjk-logo.png" alt="中航建科" className="h-10 w-auto" />}
        colorClass="blue"
        onBack={onBack}
        backLabel="返回首页"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              title="增量同步：日报/问题/经验 → 向量库"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? (syncMsg || '同步中...') : '同步业务数据'}
            </button>
            <button
              onClick={handleTriggerWorker}
              disabled={syncing || workerBusy}
              title="5.6: 触发后端 Worker 处理队列（如未运行则启动）"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Zap className={`w-3.5 h-3.5 ${workerBusy ? 'animate-pulse' : ''}`} />
              {workerBusy ? '处理中...' : '处理队列'}
            </button>
            <button
              onClick={handleMigrateLocalVectors}
              disabled={migrating || syncing || workerBusy}
              title="5.12: 将浏览器 localStorage 中的旧向量数据迁移到后端 SQLite（保留原文+embedding）"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className={`w-3.5 h-3.5 ${migrating ? 'animate-bounce' : ''}`} />
              {migrating ? (migrateMsg || '迁移中...') : '迁移本机数据'}
            </button>
            <button
              onClick={handleToggleWorker}
              disabled={workerBusy}
              title={workerStatus?.worker.isRunning ? '5.6: 停止后端 Worker（优雅退出，15s 强制超时）' : '5.6: 启动后端 Worker（自动轮询处理队列）'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                workerStatus?.worker.isRunning
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              }`}
            >
              {workerStatus?.worker.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {workerStatus?.worker.isRunning ? '停止 Worker' : '启动 Worker'}
            </button>
            {/* 5.13: Worker 模式切换菜单（不依赖 workerStatus，随时可切换） */}
            <div className="relative">
              <button
                onClick={() => setModeSwitchOpen(!modeSwitchOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                title="5.13: 切换 Worker 处理模式（后端/前端降级/双跑加速）"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  workerMode === 'backend' ? 'bg-blue-500' :
                  workerMode === 'frontend' ? 'bg-amber-500' : 'bg-purple-500 animate-pulse'
                }`} />
                {workerMode === 'backend' ? '后端模式' : workerMode === 'frontend' ? '前端降级' : '双跑加速'}
              </button>
              {modeSwitchOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModeSwitchOpen(false)} />
                  <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
                    <div className="px-3 py-2 text-[12px] text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                      Worker 处理模式 · 失败 {backendFailCount}/3
                    </div>
                    {([
                      { key: 'backend', label: '后端 Worker 模式', desc: '默认 · 仅后端处理队列' },
                      { key: 'frontend', label: '前端降级模式', desc: '后端不可用时启用 · 浏览器内处理' },
                      { key: 'hybrid', label: '双跑加速模式', desc: '前后端同时处理 · 原子领取避免冲突' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => handleSwitchWorkerMode(opt.key)}
                        className={`w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${workerMode === opt.key ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-slate-300'}`}
                      >
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-[12px] text-gray-500 dark:text-slate-400">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />
      {syncing && syncMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-4 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          {syncMsg}
        </div>
      )}
      {lastSync && !syncing && (
        <div className="bg-gray-50 dark:bg-slate-900/40 border-b border-gray-200 dark:border-slate-800 px-4 py-1.5 text-xs text-gray-600 dark:text-slate-400 flex items-center gap-4">
          <span>最近同步：日报 {lastSync.daily.synced} 段 · 问题 {lastSync.issues.synced} 条 · 经验 {lastSync.experiences.synced} 条 · 耗时 {(lastSync.duration / 1000).toFixed(1)}s</span>
          <button onClick={() => handleSync(true)} className="text-emerald-600 dark:text-emerald-400 hover:underline">全量重同步</button>
        </div>
      )}
      {workerStatus && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-1.5 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium">
            <span className={`w-2 h-2 rounded-full ${workerStatus?.worker.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
            {workerStatus?.worker.isRunning ? `Worker 运行中 (in-flight: ${workerStatus.worker.inFlightTasks})` : 'Worker 已停止'}
          </span>
          <span>待处理 <strong className="text-blue-900 dark:text-blue-100">{workerStatus?.queue?.pending || 0}</strong></span>
          <span>处理中 <strong className="text-blue-900 dark:text-blue-100">{workerStatus?.queue?.processing || 0}</strong></span>
          <span>已完成 <strong className="text-blue-900 dark:text-blue-100">{workerStatus?.queue?.done || 0}</strong></span>
          <span className={(workerStatus?.queue?.failed || 0) > 0 ? 'text-red-600 dark:text-red-400' : ''}>
            失败 <strong>{workerStatus?.queue?.failed || 0}</strong>
          </span>
          {(workerStatus?.worker.pendingBackoff || 0) > 0 && (
            <span className="text-amber-600 dark:text-amber-400">退避中 {workerStatus?.worker.pendingBackoff}</span>
          )}
          {(workerStatus?.stats.skipped || 0) > 0 && (
            <span className="text-amber-600 dark:text-amber-400">已跳过 {workerStatus?.stats.skipped}</span>
          )}
          {workerMsg && <span className="truncate max-w-md text-blue-500 dark:text-blue-400">{workerMsg}</span>}
          {/* 5.13: 当前模式徽章（只读展示，切换请用顶栏的下拉菜单） */}
          <span
            className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded border ${
              workerMode === 'backend'
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : workerMode === 'frontend'
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
            }`}
            title={`5.13: 当前 Worker 模式 — ${workerMode === 'backend' ? '仅后端处理' : workerMode === 'frontend' ? '前端降级（后端不可用）' : '前后端双跑加速'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              workerMode === 'backend' ? 'bg-blue-500' :
              workerMode === 'frontend' ? 'bg-amber-500' : 'bg-purple-500 animate-pulse'
            }`} />
            {workerMode === 'backend' ? '后端模式' : workerMode === 'frontend' ? '前端降级' : '双跑加速'}
          </span>
          <button
            onClick={() => setWorkerDetailOpen(!workerDetailOpen)}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            title="5.11: 展开/收起 Worker 健康监控详情"
          >
            <Activity className="w-3 h-3" />
            {workerDetailOpen ? '收起详情' : '查看详情'}
          </button>
        </div>
      )}
      {workerStatus && workerDetailOpen && (
        <div className="bg-white dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-800 px-4 py-3 text-xs">
          {/* 概览统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 border border-blue-100 dark:border-blue-800">
              <div className="text-[12px] text-blue-600 dark:text-blue-400">处理总数</div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{workerStatus.stats.processed}</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800">
              <div className="text-[12px] text-emerald-600 dark:text-emerald-400">已恢复</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{workerStatus.stats.recovered}</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 border border-amber-100 dark:border-amber-800">
              <div className="text-[12px] text-amber-600 dark:text-amber-400">重试次数</div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{workerStatus.stats.retried}</div>
            </div>
            <div className={`rounded-lg p-2.5 border ${(workerStatus.stats.failed || 0) > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700'}`}>
              <div className={`text-[12px] ${(workerStatus.stats.failed || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>终态失败</div>
              <div className={`text-lg font-bold ${(workerStatus.stats.failed || 0) > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-slate-300'}`}>{workerStatus.stats.failed}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2.5 border border-purple-100 dark:border-purple-800">
              <div className="text-[12px] text-purple-600 dark:text-purple-400">轮询周期</div>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{workerStatus.stats.cycles}</div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2.5 border border-cyan-100 dark:border-cyan-800">
              <div className="text-[12px] text-cyan-600 dark:text-cyan-400">运行时长</div>
              <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{formatUptime(workerStatus.worker.uptime)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700">
              <div className="text-[12px] text-slate-500 dark:text-slate-400">Worker ID</div>
              <div className="text-[12px] font-mono text-slate-700 dark:text-slate-300 truncate" title={workerStatus.worker.workerId}>{workerStatus.worker.workerId}</div>
            </div>
          </div>
          {/* 队列可视化 + 时间信息 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* 队列进度条 */}
            <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-2.5">
              <div className="font-medium text-gray-700 dark:text-slate-300 mb-2">队列状态分布</div>
              {(() => {
                const q = workerStatus.queue || {};
                const total = Object.values(q).reduce((a: number, b: number) => a + b, 0);
                if (total === 0) return <div className="text-[12px] text-gray-400 dark:text-slate-500">队列为空</div>;
                const segments = [
                  { label: '待处理', value: q.pending || 0, color: 'bg-blue-500' },
                  { label: '处理中', value: q.processing || 0, color: 'bg-amber-500' },
                  { label: '已完成', value: q.done || 0, color: 'bg-emerald-500' },
                  { label: '失败', value: q.failed || 0, color: 'bg-red-500' },
                ].filter(s => s.value > 0);
                return (
                  <>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700 mb-2">
                      {segments.map(s => (
                        <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {segments.map(s => (
                        <span key={s.label} className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${s.color}`} />
                          <span className="text-gray-600 dark:text-slate-400">{s.label}</span>
                          <strong className="text-gray-800 dark:text-slate-200">{s.value}</strong>
                          <span className="text-gray-400 dark:text-slate-500">({((s.value / total) * 100).toFixed(1)}%)</span>
                        </span>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
            {/* 时间信息 + 最近错误 */}
            <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-2.5">
              <div className="font-medium text-gray-700 dark:text-slate-300 mb-2">运行时间线</div>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">启动时间</span>
                  <span className="font-mono text-gray-800 dark:text-slate-200">{formatDateTime(workerStatus.stats.startedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">最近周期</span>
                  <span className="font-mono text-gray-800 dark:text-slate-200">{formatDateTime(workerStatus.stats.lastCycleAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">状态快照</span>
                  <span className="font-mono text-gray-800 dark:text-slate-200">{formatDateTime(workerStatus.timestamp)}</span>
                </div>
                {workerStatus.stats.lastError && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                    <div className="text-red-600 dark:text-red-400 font-medium mb-1">最近错误</div>
                    <div className="text-[12px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded p-2 break-all">
                      {workerStatus.stats.lastError}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {migrateProgress && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 px-4 py-2 text-xs text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center justify-between mb-1">
            <span>迁移进度：已处理 {Math.min(migrateProgress.done, migrateProgress.total)}/{migrateProgress.total} 条 · 成功 {migrateProgress.inserted} · 跳过 {migrateProgress.skipped}</span>
            <span className="font-medium">{((migrateProgress.done / migrateProgress.total) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (migrateProgress.done / migrateProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 w-full">
        {/* 5大知识库选项卡 */}
        <div className="flex gap-1 mb-3 bg-white rounded-xl border p-1 overflow-x-auto">
          {LIBS.map((lib, i) => (
            <button key={lib} onClick={() => setLibFilter(i)}
              className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition ${i === libFilter ? 'bg-blue-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
              {lib}
            </button>
          ))}
        </div>
        {/* 三维筛选 */}
        <div className="flex gap-2 mb-4 text-xs">
          <select value={lifecycle} onChange={e => setLifecycle(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
            {LIFECYCLES.map((l, i) => <option key={l} value={i}>{i === 0 ? '生命周期' : l}</option>)}
          </select>
          <select value={profession} onChange={e => setProfession(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
            {PROFESSIONS.map((p, i) => <option key={p} value={i}>{i === 0 ? '专业' : p}</option>)}
          </select>
          {libFilter > 0 && <span className="px-2 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs">{LIBS[libFilter]} · {LIFECYCLES[lifecycle] !== '全部' ? LIFECYCLES[lifecycle] + ' · ' : ''}{PROFESSIONS[profession] !== '全部' ? PROFESSIONS[profession] : '全部专业'}</span>}
        </div>
        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">索引总量</div><div className="text-2xl font-black text-blue-600">{allDocs.length}</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">项目数</div><div className="text-2xl font-black text-purple-600">{Object.keys(categories).length}</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-gray-500">向量维度</div><div className="text-2xl font-black text-green-600">768</div></div>
        </div>

        {/* 搜索栏 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入关键词搜索..." className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
            {search && <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            {(['fulltext','semantic','hybrid'] as const).map(m => (
              <button key={m} onClick={() => setSearchMode(m)}
                className={`px-2.5 py-1.5 ${searchMode===m?'bg-blue-500 text-white':'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {m==='fulltext'?'全文':m==='semantic'?<><Sparkles className="w-3 h-3 inline mr-0.5"/>语义</>:<><Sparkles className="w-3 h-3 inline mr-0.5"/>混合</>}
              </button>
            ))}
          </div>
          <button onClick={handleSearch} disabled={loading} className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
          </button>
          <button onClick={handleShowAll} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">全部</button>
        </div>

        {/* 分类 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.entries(categories).map(([c, n]) => (
            <button key={c} onClick={() => { setSearch(c); handleSearch(); }}
              className="px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100">{c} ({n})</button>
          ))}
        </div>

        {/* 图谱搜索结果 */}
        {graphResults && graphResults.nodes && graphResults.nodes.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4">
            <h3 className="text-xs font-semibold text-purple-600 mb-2">知识图谱匹配 ({graphResults.nodes.length}节点 · {graphResults.edges?.length||0}关系)</h3>
            <div className="flex flex-wrap gap-2">
              {graphResults.nodes.map((n:any) => (
                <span key={n.id} className={`px-2 py-0.5 rounded-full text-[10px] ${n.type==='STANDARD'?'bg-blue-50 text-blue-600':n.type==='LOCATION'?'bg-green-50 text-green-600':'bg-gray-100 text-gray-600'}`}>{n.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* 方案模板 + GraphRAG 溯源 */}
        {libFilter === 4 && templates.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4"><h3 className="text-xs font-semibold text-violet-700 mb-2">方案模板 ({templates.length})</h3>
            {templates.map((t: any) => <div key={t.id} className="flex gap-3 p-2 bg-violet-50 rounded-lg text-sm"><span className="font-medium">{t.name}</span><span className="text-xs text-gray-400">{t.category}</span><span className="text-xs text-gray-400 ml-auto">{t.created_at?.slice(0, 10)}</span></div>)}
          </div>
        )}
        {graphragTrace?.nodes && graphragTrace.nodes.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4 mb-4">
            <h3 className="text-xs font-semibold text-indigo-700 mb-2">GraphRAG 标准溯源 ({graphragTrace.nodes.length}节点)</h3>
            <div className="flex flex-wrap gap-1.5">{graphragTrace.nodes.map((n: any) => <span key={n.id||n.label} className="px-2 py-0.5 rounded-full text-xs bg-white border border-indigo-200 text-indigo-700">{n.label?.slice(0,50)}</span>)}</div>
            {graphragTrace.edges && graphragTrace.edges.length > 0 && <div className="mt-2 text-xs text-indigo-500">{graphragTrace.edges.slice(0,5).map((e:any,i:number)=><span key={i} className="mr-3">{e.from}→{e.type}→{e.to}</span>)}</div>}
          </div>
        )}

        {/* 搜索结果 */}
        <div className="space-y-3">
          {(results.length === 0 && !graphResults) || (results.length === 0 && searchMode!=='hybrid') ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">知识库为空</p>
              <p className="text-xs mt-1">在项目资料管理页上传文件后自动索引至此处</p>
            </div>
          ) : (
            results.map((doc, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 hover:border-blue-200 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-gray-700">{doc.metadata?.fileName || '未知文档'}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-gray-400">
                    {doc.metadata?.projectName && <span>{doc.metadata.projectName}</span>}
                    {doc.metadata?.uploadTime && <span>{new Date(doc.metadata.uploadTime).toLocaleDateString('zh-CN')}</span>}
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-3">{doc.text?.slice(0, 300)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
