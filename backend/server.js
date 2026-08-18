import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const LOG_DIR = resolve(PROJECT_ROOT, 'logs');
if (!existsSync(LOG_DIR)) { try { mkdirSync(LOG_DIR, { recursive: true }); } catch {} }

const LOG_TAG = '[BACKEND]';
const ts = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
const LOG = {
  info:  (m, d = '') => console.log (`${ts()} ${LOG_TAG} INFO  ${m}${d ? ' | ' + d : ''}`),
  ok:    (m, d = '') => console.log (`${ts()} ${LOG_TAG} OK    ${m}${d ? ' | ' + d : ''}`),
  warn:  (m, d = '') => console.warn(`${ts()} ${LOG_TAG} WARN  ${m}${d ? ' | ' + d : ''}`),
  error: (m, d = '') => console.error(`${ts()} ${LOG_TAG} ERROR ${m}${d ? ' | ' + d : ''}`),
  fatal: (m, d = '') => console.error(`${ts()} ${LOG_TAG} FATAL ${m}${d ? ' | ' + d : ''}`),
  phase: (n)   => console.log (`\n${ts()} ${LOG_TAG} ===== PHASE ${n} =====`),
};

LOG.phase('0: BOOTSTRAP');
LOG.info(`cwd=${process.cwd()}`);
LOG.info(`__dirname=${__dirname}`);
LOG.info(`PROJECT_ROOT=${PROJECT_ROOT}`);
LOG.info(`NODE_VERSION=${process.version}`);
LOG.info(`PID=${process.pid}  PPID=${process.ppid}`);
LOG.info(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
LOG.info('Loading .env...', `path=${resolve(__dirname, '.env')}  exists=${existsSync(resolve(__dirname, '.env'))}`);
const dotenvResult = dotenv.config({ path: resolve(__dirname, '.env') });
if (dotenvResult.error) {
  LOG.warn('.env parse error', dotenvResult.error.message);
} else {
  LOG.ok('.env loaded', `keys=${Object.keys(dotenvResult.parsed || {}).length}`);
}

LOG.phase('1: IMPORTS');
LOG.info('Importing Express middleware stack...');
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
LOG.ok('Middleware imports done', 'express|cors|helmet|morgan|rateLimit');

// 简单内存缓存 (60s TTL, 用于高频只读API)
const apiCache = new Map();
LOG.info('API memory cache initialized', 'mapSize=' + apiCache.size);
function cacheMiddleware(ttlMs = 60000) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = req.originalUrl;
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.time < ttlMs) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      apiCache.set(key, { data, time: Date.now() });
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    next();
  };
}

LOG.info('Importing route modules (17 files)...');
import { getDb } from './db.js';
import projectsRouter from './routes/projects.js';
import documentsRouter from './routes/documents.js';
import authRouter from './routes/auth.js';
import importRouter from './routes/import.js';
import backupRouter from './routes/backup.js';
import aiRouter from './routes/ai.js';
import aiAdminRouter from './routes/ai_admin.js';
import kgRouter from './routes/kg.js';
import kgGraphragRouter from './routes/kg_graphrag.js';
import ragflowRouter from './routes/ragflow.js';
import objectivesRouter from './routes/objectives.js';
import mcpRouter from './routes/mcp.js';
import baselinesRouter from './routes/baselines.js';
import auditRouter from './routes/audit.js';
import exportRouter from './routes/export.js';
import syncRouter from './routes/sync.js';
import mobileRouter from './routes/mobile.js';
import dataRouter from './routes/data.js';
import experienceRouter from './routes/experience.js';
import contractsRouter from './routes/contracts.js';
import guideRouter from './routes/guide.js';
import stakeholdersRouter from './routes/stakeholders.js';
import adminRouter from './routes/admin.js';
import kbSyncRouter from './routes/kbSync.js';
LOG.ok('Route imports complete', 'count=23 (db.js + 22 routers)');

LOG.phase('2: APP INIT');
const app = express();
const PORT = process.env.PORT || 3000;
LOG.info('Express app instance created', `PORT=${PORT}`);

// Middleware
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN;
LOG.info('Runtime flags', `isProduction=${isProduction}  corsOrigin=${corsOrigin || '(not set)'}`);

// 安全头（生产环境全面启用）
LOG.info('Mounting Helmet security headers...', `isProduction=${isProduction}  CSP=${isProduction ? 'default' : 'disabled'}  HSTS=${isProduction ? '31536000' : 'off'}`);
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
}));
LOG.ok('Helmet mounted');

// CORS — 生产白名单，开发全开
const corsCfg = isProduction
  ? { origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : false, methods: ['GET','POST','PUT','DELETE'], credentials: true, maxAge: 86400 }
  : { origin: true, credentials: true };
LOG.info('Mounting CORS...', isProduction ? `origins=${JSON.stringify(corsCfg.origin)}  strict` : 'origin=*  dev mode');
app.use(cors(corsCfg));
LOG.ok('CORS mounted');

LOG.info('Mounting morgan request logger...', `format=${isProduction ? 'combined' : 'short'}`);
app.use(morgan(isProduction ? 'combined' : 'short'));
LOG.info('Mounting express.json body parser...', `limit=${isProduction ? '10mb' : '100mb'}`);
app.use(express.json({ limit: isProduction ? '10mb' : '100mb' }));

// 认证端点限流（防暴力破解：每分钟5次）
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '登录尝试过于频繁，请1分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
LOG.info('Mounting auth rate limiter', 'window=60s  max=5  paths=/api/auth/login,/api/auth/register');
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 请求错误日志
LOG.info('Mounting 4xx/5xx error logging middleware');
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const ms = Date.now() - start;
    if (_res.statusCode >= 400) {
      console.warn(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${_res.statusCode} (${ms}ms)`);
    }
  });
  next();
});

// 全局限流 — 生产环境更严格
const globalLimitWindow = 60 * 1000;
const globalLimitMax = isProduction ? 100 : 500;
LOG.info('Mounting global rate limiter', `window=${globalLimitWindow}ms  max=${globalLimitMax}/min`);
app.use(rateLimit({
  windowMs: globalLimitWindow,
  max: globalLimitMax,
  message: { error: '请求过于频繁，请稍后重试' },
  standardHeaders: true,
  legacyHeaders: false,
}));

LOG.phase('3: DATABASE');
LOG.info('Opening SQLite DB...', `DB_PATH=${process.env.DB_PATH || 'backend/data/planning.db (default)'}`);
let dbOk = false;
try {
  const db = getDb();
  const test = db.prepare('SELECT 1 as v').get();
  dbOk = (test?.v === 1);
  LOG.ok('SQLite connected', `testQuery=${dbOk ? 'SELECT 1=1 OK' : 'unexpected'}  DB handle=ok`);
} catch (e) {
  dbOk = false;
  LOG.fatal('SQLite open failed', e.message);
  LOG.error('Stack', e.stack?.split('\n').slice(0,3).join(' | '));
}

// 生产模式：静态文件 + PWA 入口
const distPath = resolve(__dirname, '..', 'dist');
const distExists = existsSync(distPath);
LOG.info('Static dist path check', `path=${distPath}  exists=${distExists}  isProduction=${isProduction}`);
if (isProduction && distExists) {
  LOG.info('Mounting static + /mobile PWA endpoint', 'maxAge=7d');
  app.use(express.static(distPath, { maxAge: '7d' }));
  // /mobile → mobile.html（PWA 入口）
  app.get('/mobile', (_req, res) => res.sendFile(resolve(distPath, 'mobile.html')));
  LOG.ok('Static & mobile PWA mounted');
} else if (isProduction && !distExists) {
  LOG.warn('Production mode but /dist missing — no static files will be served. Run: npm run build');
}

// 健康检查端点
app.get('/api/health', async (_req, res) => {
  const services = { db: false, neo4j: false, ragflow: false, ai: false };
  try { const { getDb } = await import('./db.js'); getDb().prepare('SELECT 1').get(); services.db = true; } catch {}
  try { const r = await fetch('http://localhost:7474', { signal: AbortSignal.timeout(2000) }); services.neo4j = r.ok; } catch {}
  try { const r = await fetch('http://localhost:9380/api/v1/version', { signal: AbortSignal.timeout(2000) }); services.ragflow = r.ok; } catch {}
  services.ai = !!process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-');
  const allOk = Object.values(services).every(Boolean);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    version: '5.1.0',
    uptime: process.uptime(),
    services,
    timestamp: new Date().toISOString(),
  });
});

LOG.phase('4: ROUTES');
const routes = [
  ['/api/projects', projectsRouter, true, 60000],
  ['/api/kg',       kgRouter,       true, 30000],
  ['/api/documents', documentsRouter, false],
  ['/api/auth',      authRouter,      false],
  ['/api/import',    importRouter,    false],
  ['/api/backup',    backupRouter,    false],
  ['/api/ai',        aiRouter,        false],
  ['/api/ai',        aiAdminRouter,   false],
  ['/api/kg',        kgGraphragRouter,false],
  ['/api/ragflow',   ragflowRouter,   false],
  ['/api/objectives',objectivesRouter,false],
  ['/api/mcp',       mcpRouter,       false],
  ['/api/baselines', baselinesRouter, false],
  ['/api/audit',     auditRouter,     false],
  ['/api/export',    exportRouter,    false],
  ['/api/sync',      syncRouter,      false],
  ['/api/mobile',    mobileRouter,    false],
  ['/api/data',      dataRouter,      false],
  ['/api/experience',experienceRouter,false],
  ['/api/contracts', contractsRouter, false],
  ['/api/guide',     guideRouter,     false],
  ['/api/stakeholders', stakeholdersRouter, false],
  ['/api/admin',     adminRouter,    false],
  ['/api/kb',        kbSyncRouter,   false],
];
LOG.info('Mounting routes...', `total=${routes.length}`);
for (const [path, router, useCache, ttl] of routes) {
  try {
    if (useCache) {
      app.use(path, cacheMiddleware(ttl), router);
      LOG.ok('Mounted (cached)', `path=${path}  ttl=${ttl}ms`);
    } else {
      app.use(path, router);
      LOG.ok('Mounted', `path=${path}`);
    }
  } catch (e) {
    LOG.error('Mount FAILED', `path=${path}  err=${e.message}`);
  }
}
LOG.ok('All routes mounted', `count=${routes.length}`);

LOG.phase('5: ROOT ENDPOINTS');
LOG.info('Registering /api (health), /api/health, /api/stats');
// Health check（无需登录）
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: '工程资料管理系统 API', version: '1.7.0', uptime: process.uptime() });
});

// 系统统计（管理员可见）
app.get('/api/stats', async (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const documents = db.prepare('SELECT COUNT(*) as c FROM documents').get().c;
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const activeUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active=1').get().c;
    let objectives = 0, baselines = 0, artifacts = 0, auditLogs = 0;
    try {
      objectives = db.prepare('SELECT COUNT(*) as c FROM objectives').get().c;
      baselines = db.prepare('SELECT COUNT(*) as c FROM baselines').get().c;
      artifacts = db.prepare('SELECT COUNT(*) as c FROM knowledge_artifacts').get().c;
      auditLogs = db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c;
    } catch { /* 新表可能尚未创建 */ }

    // 服务健康检查（并发探测）
    const health = {
      // AI模型
      deepseek: !!(process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('your-')),
      qwen: !!(process.env.QWEN_API_KEY && !process.env.QWEN_API_KEY.includes('your-')),
      zhipu: !!(process.env.ZHIPU_API_KEY && !process.env.ZHIPU_API_KEY.includes('your-')),
      dashscope: !!(process.env.DASHSCOPE_API_KEY && !process.env.DASHSCOPE_API_KEY.includes('your-')),
      // 基础设施
      neo4j: false,
      ragflow: false,
      paddleocr: false,
      lightrag: false,
    };

    // 并发探测外部服务（2秒超时）
    const probe = async (url) => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(url, { signal: ctrl.signal });
        return r.ok;
      } catch { return false; }
    };

    const [rf, po, lr, n4j] = await Promise.all([
      probe('http://localhost:9380/api/v1/version'),
      probe('http://localhost:8001/api/parse/health'),
      probe('http://localhost:8000/api/lightrag/health'),
      probe(process.env.NEO4J_URI ? process.env.NEO4J_URI.replace('bolt://', 'http://').replace(':7687', ':7474') : ''),
    ]);
    health.ragflow = rf;
    health.paddleocr = po;
    health.lightrag = lr;
    health.neo4j = n4j;

    res.json({
      projects, documents, users, activeUsers,
      objectives, baselines, artifacts, auditLogs,
      health,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch { res.json({ projects: 0, documents: 0, users: 0, activeUsers: 0 }); }
});

// 启动时环境检查
import { execSync } from 'child_process';

LOG.phase('6: PORT BIND');
LOG.info('Calling app.listen()...', `port=${PORT}  host=0.0.0.0`);
const listenStartMs = Date.now();

const server = app.listen(PORT, '0.0.0.0', async () => {
  const listenMs = Date.now() - listenStartMs;
  LOG.ok('app.listen succeeded', `port=${PORT}  bindMs=${listenMs}`);
  LOG.ok('Server running', `http://localhost:${PORT}`);
  LOG.ok('DB path', process.env.DB_PATH || 'backend/data/planning.db (default)');

  LOG.phase('7: POST-START DB INTEGRITY');
  LOG.info('Running DB integrity pragma...');
  try {
    const { getDb } = await import('./db.js');
    const db = getDb();
    const integrity = db.pragma('integrity_check');
    if (integrity[0]?.integrity_check === 'ok') {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      LOG.ok('DB integrity', `ok (${tables.length} tables)`);
      const counts = {};
      const bigTables = ['projects','documents','users','objectives','baselines','knowledge_artifacts','audit_log','daily_reports','issues','progress_reports','experience_items'];
      for (const t of bigTables) {
        try { counts[t] = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; } catch {}
      }
      LOG.info('Major table counts', JSON.stringify(counts));
    } else {
      LOG.warn('DB integrity check FAILED', JSON.stringify(integrity).slice(0,200));
    }
  } catch (e) { LOG.warn('DB integrity check skipped', e.message); }

  LOG.ok('Files path', process.env.FILES_PATH || 'backend/files/ (default)');

  // 必填环境检查
  LOG.phase('8: ENV CHECK (required)');
  const checks = [
    { key: 'DEEPSEEK_API_KEY', name: 'AI引擎(DeepSeek)', required: true },
    { key: 'NEO4J_URI', name: '知识图谱(Neo4j)', required: false },
  ];
  for (const c of checks) {
    const raw = process.env[c.key] || '';
    const set = !!raw;
    const ok = set && !raw.includes('your-');
    const masked = set ? raw.slice(0, 8) + '***(len=' + raw.length + ')' : '(not set)';
    const line = `${c.name}  key=${c.key}  present=${set}  valid=${ok}  preview=${masked}`;
    if (ok) LOG.ok(line); else if (c.required) LOG.warn(line + '  → AI功能不可用(必填)'); else LOG.info(line + '  → 可选，离线模式');
  }

  // 可选服务检查：条件满足时要求启动
  LOG.phase('9: SERVICE PROBES');

  // Docker → RAGFlow + Neo4j
  LOG.info('Checking Docker daemon...');
  let dockerOk = false;
  try { execSync('docker info', { timeout: 3000, stdio: 'ignore' }); dockerOk = true; } catch (e) { LOG.warn('Docker not available', e.message?.slice(0,80) || ''); }
  LOG.ok(dockerOk ? 'Docker daemon: RUNNING' : 'Docker daemon: NOT RUNNING');

  if (dockerOk) {
    // RAGFlow
    LOG.info('Probe RAGFlow', 'url=http://localhost:9380/api/v1/version  timeout=2000ms');
    try {
      const t0 = Date.now();
      const rf = await fetch('http://localhost:9380/api/v1/version', { signal: AbortSignal.timeout(2000) });
      LOG.ok(rf.ok ? 'RAGFlow(9380): ONLINE' : 'RAGFlow(9380): RESPONDED_NON_OK', `status=${rf.status}  latency=${Date.now()-t0}ms`);
    } catch (e) { LOG.warn('RAGFlow(9380): OFFLINE', `${e.name} ${e.message?.slice(0,80)}  → docker compose -p docmgmt up -d ragflow`); }

    // Neo4j — 自动重试3次（Docker刚启动时Neo4j需要预热）
    let neo4jOk = false;
    for (let i = 0; i < 3; i++) {
      LOG.info('Probe Neo4j', `attempt=${i+1}/3  url=http://localhost:7474  timeout=3000ms`);
      try {
        const t0 = Date.now();
        const n4j = await fetch('http://localhost:7474', { signal: AbortSignal.timeout(3000) });
        if (n4j.ok) { LOG.ok('Neo4j(7474): ONLINE · GraphRAG可用', `status=${n4j.status}  latency=${Date.now()-t0}ms  bolt=${process.env.NEO4J_URI||'(not set)'}`); neo4jOk = true; break; }
        LOG.warn('Neo4j respond non-200', `status=${n4j.status}`);
      } catch (e) { LOG.warn('Neo4j probe failed', `${e.name} ${e.message?.slice(0,80)}`); }
      if (i < 2) { LOG.info('Waiting 2s before next Neo4j retry...'); await new Promise(r => setTimeout(r, 2000)); }
    }
    if (!neo4jOk) LOG.warn('Neo4j(7474): NOT CONNECTED', '→ docker compose -p docmgmt up -d neo4j');
  } else {
    LOG.info('Skip RAGFlow/Neo4j probes (Docker not running)', '→ 启动Docker Desktop后执行 docker compose -p docmgmt up -d neo4j ragflow');
  }

  // Python → OCR + LightRAG
  LOG.info('Checking Python runtime...');
  let pythonOk = false, pythonVer = '';
  try { pythonVer = (execSync('python --version', { timeout: 3000, encoding: 'utf8' })).trim(); pythonOk = true; }
  catch (e) { LOG.warn('Python not available', e.message?.slice(0,80) || ''); }
  LOG.ok(pythonOk ? `Python runtime: OK (${pythonVer})` : 'Python runtime: NOT FOUND');

  if (pythonOk) {
    LOG.info('Probe PaddleOCR parser', 'url=http://localhost:8001/api/parse/health  timeout=2000ms');
    try {
      const t0 = Date.now();
      const po = await fetch('http://localhost:8001/api/parse/health', { signal: AbortSignal.timeout(2000) });
      const pd = await po.json();
      LOG.ok('文档解析(8001): ONLINE', `engine=${pd.ocr_engine||'easyocr'}  formats=${(pd.formats||[]).length}  latency=${Date.now()-t0}ms`);
    } catch (e) { LOG.warn('文档解析(8001): OFFLINE', `${e.name} ${e.message?.slice(0,80)}  → python services/paddleocr-server/main.py`); }

    LOG.info('Probe LightRAG', 'url=http://localhost:8000/api/lightrag/health  timeout=2000ms');
    try {
      const t0 = Date.now();
      const lr = await fetch('http://localhost:8000/api/lightrag/health', { signal: AbortSignal.timeout(2000) });
      const ld = await lr.json();
      LOG.ok('LightRAG(8000): ONLINE', `docs=${ld.documents}  entities=${ld.entities}  vectors=${ld.vectors}  ai=${ld.ai_enabled}  latency=${Date.now()-t0}ms`);
    } catch (e) { LOG.warn('LightRAG(8000): OFFLINE', `${e.name} ${e.message?.slice(0,80)}  → python services/lightrag-server/main.py`); }
  } else {
    LOG.info('Skip PaddleOCR/LightRAG probes (Python not available)', '文档解析/LightRAG 不可用');
  }

  // Ollama 本地AI
  LOG.info('Probe Ollama (optional)', 'url=http://localhost:11434/api/tags  timeout=3000ms');
  try {
    const t0 = Date.now();
    const ol = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (ol.ok) {
      const tags = await ol.json();
      const models = (tags.models || []).map(m => m.name).join(', ');
      LOG.ok('Ollama(11434): ONLINE', `models=${models || '无'}  latency=${Date.now()-t0}ms`);
    } else {
      LOG.warn('Ollama respond non-200', `status=${ol.status}`);
    }
  } catch (e) { LOG.info('Ollama(11434): NOT STARTED', `${e.name}  本地AI模型不可用(可选)`); }

  const totalMs = Date.now() - listenStartMs;
  LOG.phase(`STARTUP COMPLETE in ${totalMs}ms`);
  LOG.ok('Ready for traffic', `URL=http://localhost:${PORT}  totalMs=${totalMs}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    LOG.fatal(`PORT ${PORT} ALREADY IN USE (EADDRINUSE)`, '→ 请先关闭占用进程: netstat -ano | findstr ' + PORT);
  } else {
    LOG.fatal('server.on(error)', `${err && err.code ? err.code : 'UNKNOWN'}  ${err && err.message ? err.message : String(err)}`);
    try { LOG.error('Stack', err && err.stack ? String(err.stack).split('\n').slice(0,5).join(' | ') : ''); } catch {}
  }
  process.exit(1);
});
server.on('listening', () => { LOG.ok('server event: listening'); });
server.on('close', () => { LOG.info('server event: close'); });

// ── 全局异常捕获 + 自动重启 ──
LOG.phase('10: SIGNAL HANDLERS');
LOG.info('Registering: uncaughtException · unhandledRejection · SIGTERM · SIGINT');
let restarting = false;
process.on('uncaughtException', (err) => {
  LOG.fatal('uncaughtException', `${err.name} ${err.message}`);
  LOG.error('Stack', err.stack?.split('\n').slice(0,8).join(' | '));
  if (!restarting) {
    restarting = true;
    LOG.info('[守护] 3秒后自动重启 (spawn detached child)…');
    setTimeout(() => {
      // v5.3: ESM 模块不支持 require，spawn 已在文件顶部 import
      LOG.info('Spawning child process', `argv=${[process.argv[0], ...process.argv.slice(1)].join(' ')}`);
      try {
        const child = spawn(process.argv[0], process.argv.slice(1), { detached: true, stdio: 'inherit' });
        LOG.ok('Child spawned', `childPid=${child.pid}`);
        child.unref();
        LOG.info('Parent exiting(1)...');
        process.exit(1);
      } catch (e) {
        LOG.fatal('Spawn child FAILED', e.message);
        process.exit(2);
      }
    }, 3000);
  } else {
    LOG.warn('Already in restarting state — hard exit(1)');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  const reasonObj = (reason !== null && typeof reason === 'object') ? reason : null;
  const msg = reasonObj
    ? (reasonObj.message ? reasonObj.message : String(reason))
    : String(reason);
  LOG.fatal('unhandledRejection', msg);
  LOG.error('Promise hint', String(promise || '').slice(0,200));
  try {
    const stack = reasonObj && reasonObj.stack ? String(reasonObj.stack) : '';
    if (stack) LOG.error('Reason stack', stack.split('\n').slice(0,5).join(' | '));
  } catch {}
});

process.on('SIGTERM', () => {
  LOG.info('Caught SIGTERM — graceful shutdown start');
  const t0 = Date.now();
  server.closeAllConnections?.();
  server.close(() => { LOG.ok(`SIGTERM — server closed in ${Date.now()-t0}ms`); process.exit(0); });
  setTimeout(() => { LOG.warn('SIGTERM — force exit after 5s timeout'); process.exit(0); }, 5000);
});

process.on('SIGINT', () => {
  LOG.info('Caught SIGINT (Ctrl+C) — graceful shutdown start');
  const t0 = Date.now();
  server.closeAllConnections?.();
  server.close(() => { LOG.ok(`SIGINT — server closed in ${Date.now()-t0}ms`); process.exit(0); });
  setTimeout(() => { LOG.warn('SIGINT — force exit after 5s timeout'); process.exit(0); }, 5000);
});

LOG.info('Signal handlers registered');

export default app;
