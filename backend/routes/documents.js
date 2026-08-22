import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { enqueueKbSync, SYNC_SOURCE } from '../middleware/kbSyncTrigger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const FILES_ROOT = process.env.FILES_PATH || path.join(process.cwd(), 'files');
const MAX_FILE_MB = 50; // 单文件大小上限（base64 旧端点，保留兼容）
const MAX_FILE_MB_MULTIPART = 200; // multipart 流式上传上限（支持 CAD 图纸 100MB+）
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.dwg', '.dxf', '.zip', '.rar', '.txt', '.csv', '.md', '.json', '.html'];

// v6.0: 日志前缀构造（环境变量驱动，支持环境标识拼接）
// 默认: [DOC-LIST] / [DOC-DL]
// 配 LOG_ENV_TAG=PROD 后: [PROD][DOC-DL]，便于多环境日志聚合区分
// 注意: 用函数延迟读取 process.env，避免 ESM 静态导入早于 dotenv.config() 执行
function logTag(envKey, fallback) {
  const prefix = process.env[envKey] || fallback;
  const tag = process.env.LOG_ENV_TAG || '';
  return tag ? `[${tag}][${prefix}]` : `[${prefix}]`;
}
// 每次调用时实时取 env，避免 ESM 模块加载顺序导致 env 未加载
const LOG_LIST = () => logTag('LOG_PREFIX_DOC_LIST', 'DOC-LIST');
const LOG_DL = () => logTag('LOG_PREFIX_DOC_DOWNLOAD', 'DOC-DL');

// 安全检查：验证路径是否在允许的基准目录内
function isPathSafe(targetPath, baseDir) {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(baseDir);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

// 文件名安全化：只保留合法字符，防穿越
function sanitizeFilename(name) {
  const base = path.basename(name); // 剥离路径穿越
  return base.replace(/[^a-zA-Z0-9\u4e00-\u9fff._\-()（）]+/g, '_').slice(0, 200);
}

// 获取某个项目下的所有文档上传记录
router.get('/project/:projectId', requireAuth, (req, res) => {
  const db = getDb();
  const { standard } = req.query;
  const projectId = req.params.projectId;
  const userId = req.user?.username || 'anonymous';
  console.log(`${LOG_LIST()} 开始查询项目文档列表 user=${userId} projectId=${projectId} standard=${standard || 'ALL'}`);

  let query = 'SELECT id, doc_id, file_name, file_data, file_path, upload_time, uploader, version, standard FROM documents WHERE project_id = ?';
  const params = [projectId];
  if (standard) {
    query += ' AND standard = ?';
    params.push(standard);
  }
  query += ' ORDER BY doc_id, upload_time DESC';
  const docs = db.prepare(query).all(...params);
  console.log(`${LOG_LIST()} 数据库查询完成 projectId=${projectId} 命中记录=${docs.length}条`);

  const grouped = {};
  let base64Count = 0, diskCount = 0, missingCount = 0;
  for (const d of docs) {
    if (!grouped[d.doc_id]) grouped[d.doc_id] = [];
    // v6.0: hasFile 哨兵值 — 前端据此判断下载按钮可用
    // 小文件(Base64)和大文件(磁盘)都标记 hasFile=true，由前端按需调用下载端点
    const hasFile = !!(d.file_data || d.file_path);
    if (d.file_data) base64Count++;
    else if (d.file_path) diskCount++;
    else missingCount++;
    grouped[d.doc_id].push({
      id: d.id,
      fileName: d.file_name,
      uploadTime: d.upload_time,
      uploader: d.uploader,
      version: d.version,
      fileData: d.file_data,
      filePath: d.file_path,
      hasFile,
    });
  }
  const docGroupCount = Object.keys(grouped).length;
  console.log(`${LOG_LIST()} 分组完成 projectId=${projectId} docGroups=${docGroupCount} base64文件=${base64Count} 磁盘文件=${diskCount} 无数据文件=${missingCount}`);
  res.json(grouped);
});

// 获取所有文档记录（扁平列表）
router.get('/all/:projectId', requireAuth, (req, res) => {
  const db = getDb();
  const { standard } = req.query;
  let query = 'SELECT id, doc_id, file_name, upload_time, uploader, version, standard FROM documents WHERE project_id = ?';
  const params = [req.params.projectId];
  if (standard) {
    query += ' AND standard = ?';
    params.push(standard);
  }
  query += ' ORDER BY doc_id, upload_time DESC';
  const docs = db.prepare(query).all(...params);
  res.json(docs);
});

// 上传文档
router.post('/upload', requirePermission('can_upload'), (req, res) => {
  const { projectId, docId, fileName, fileData, uploadTime, version, standard } = req.body;

  if (!projectId || !docId || !fileName) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 验证 projectId 为合法数字
  const pid = Number(projectId);
  if (!Number.isInteger(pid) || pid <= 0) {
    return res.status(400).json({ error: '非法项目ID' });
  }

  // docId 安全检查：拒绝路径穿越字符
  if (docId.includes('..') || docId.includes('/') || docId.includes('\\')) {
    return res.status(400).json({ error: 'docId 包含非法字符' });
  }

  // 文件类型白名单验证（无论存储路径，必须检查）
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: `不支持的文件类型: ${ext}，允许的类型: ${ALLOWED_EXTENSIONS.join(', ')}` });
  }

  let filePath = null;
  // 如果有文件数据，写入磁盘
  if (fileData && fileData.length > 100) {
    // 单文件大小检查
    if (fileData.length > MAX_FILE_MB * 1024 * 1024) {
      return res.status(413).json({ error: `文件过大，请控制在${MAX_FILE_MB}MB以内` });
    }
    try {
      const safeName = sanitizeFilename(fileName);
      const safeDocId = sanitizeFilename(docId);
      const dir = path.join(FILES_ROOT, String(pid), safeDocId);
      fs.mkdirSync(dir, { recursive: true });
      const ts = Date.now();
      filePath = path.join(dir, `${ts}_${safeName}`);
      const base64 = fileData.split(',')[1] || fileData;
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      filePath = path.relative(process.cwd(), filePath);
      if (!filePath.startsWith('files' + path.sep) && filePath !== 'files') {
        console.error('Path escape attempt:', filePath);
        return res.status(400).json({ error: '文件路径异常，上传被拒绝' });
      }
    } catch (e) {
      console.error('File write error:', e.message);
      return res.status(500).json({ error: '文件写入失败' });
    }
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO documents (project_id, doc_id, file_name, file_data, file_path, upload_time, uploader, version, standard) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    pid, docId, fileName,
    filePath ? null : (fileData || null), // 文件存磁盘则不再存 Base64
    filePath,
    uploadTime || new Date().toLocaleString('zh-CN'),
    req.user?.username || '未知', // 使用认证用户，拒绝客户端伪造
    version || 'V1.0',
    standard || 'DB11/T695-2025'
  );

  // v5.7 迭代2: 文档上传入队知识库同步
  try {
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(pid);
    if (project) {
      const before = db.prepare("SELECT COUNT(*) as c FROM kb_sync_queue WHERE status IN ('pending','processing')").get();
      const r = enqueueKbSync(project.name, SYNC_SOURCE.DOCUMENT, result.lastInsertRowid, 'upsert', 0);
      const after = db.prepare("SELECT COUNT(*) as c FROM kb_sync_queue WHERE status IN ('pending','processing')").get();
      console.log(`[kbSync][document] 入队前: projectName=${project.name}, source=document, recordId=${result.lastInsertRowid}, action=upsert, queue=${JSON.stringify(before)}`);
      console.log(`[kbSync][document] 入队后: result=${JSON.stringify(r)}, queue=${JSON.stringify(after)}`);
    }
  } catch (e) {
    console.error('[kbSync][document] 上传入队失败:', e.message);
  }

  res.status(201).json({ id: result.lastInsertRowid, filePath });
});

// 下载文档（获取文件数据）
router.get('/download/:id', requireAuth, requirePermission('can_download'), (req, res) => {
  const db = getDb();
  const docId = req.params.id;
  const userId = req.user?.username || 'anonymous';
  console.log(`${LOG_DL()} 下载请求开始 user=${userId} docId=${docId}`);

  const doc = db.prepare('SELECT id, file_name, file_data, file_path FROM documents WHERE id = ?').get(docId);

  if (!doc) {
    console.error(`${LOG_DL()} 失败-记录不存在 docId=${docId} user=${userId}`);
    return res.status(404).json({ error: '文件不存在' });
  }

  const storageType = doc.file_path ? 'disk' : (doc.file_data ? 'base64' : 'missing');
  console.log(`${LOG_DL()} 记录命中 docId=${docId} fileName=${doc.file_name} 存储方式=${storageType} filePath=${doc.file_path || 'NULL'}`);

  // v6.0: 磁盘存储的文件 — 用 res.download 流式传输，避免 Base64 膨胀
  if (doc.file_path) {
    try {
      const absPath = path.resolve(process.cwd(), doc.file_path);
      const safe = isPathSafe(absPath, FILES_ROOT);
      const exists = fs.existsSync(absPath);
      console.log(`${LOG_DL()} 磁盘路径解析 docId=${docId} absPath=${absPath} pathSafe=${safe} fileExists=${exists}`);

      if (!safe) {
        console.error(`${LOG_DL()} 失败-路径非法 docId=${docId} absPath=${absPath}`);
        return res.status(403).json({ error: '非法文件路径' });
      }
      if (exists) {
        const stat = fs.statSync(absPath);
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        console.log(`${LOG_DL()} 开始流式下载 docId=${docId} fileName=${doc.file_name} size=${sizeMB}MB`);
        return res.download(absPath, doc.file_name, (err) => {
          if (err) {
            console.error(`${LOG_DL()} 流式下载中断 docId=${docId} error=${err.message} code=${err.code || 'N/A'}`);
          } else {
            console.log(`${LOG_DL()} 流式下载完成 docId=${docId} fileName=${doc.file_name} size=${sizeMB}MB`);
          }
        });
      } else {
        console.error(`${LOG_DL()} 失败-文件不存在 docId=${docId} absPath=${absPath} (数据库记录有file_path但磁盘文件丢失)`);
      }
    } catch (e) {
      console.error(`${LOG_DL()} 失败-磁盘读取异常 docId=${docId} error=${e.message} stack=${e.stack?.split('\n')[0]}`);
    }
  }

  // 回退: Base64 存储的小文件（保持向后兼容）
  if (doc.file_data) {
    const sizeKB = (doc.file_data.length / 1024).toFixed(1);
    console.log(`${LOG_DL()} 返回Base64数据 docId=${docId} size=${sizeKB}KB`);
    return res.json({ fileName: doc.file_name, fileData: doc.file_data });
  }

  console.error(`${LOG_DL()} 失败-文件数据不存在 docId=${docId} file_path=NULL file_data=NULL (上传时数据未正确写入或已被清理)`);
  res.status(404).json({ error: '文件数据不存在' });
});

// 删除单条文档记录
router.delete('/:id', requirePermission('can_upload'), (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT d.id, d.file_path, p.name as project_name FROM documents d LEFT JOIN projects p ON d.project_id = p.id WHERE d.id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: '记录不存在' });

  // 删除磁盘文件
  if (doc.file_path) {
    try {
      const absPath = path.resolve(process.cwd(), doc.file_path);
      if (!isPathSafe(absPath, FILES_ROOT)) return res.status(403).json({ error: '非法文件路径' });
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch (e) {
      console.error('File delete error:', e.message);
    }
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);

  // v5.7 迭代2: 文档删除入队（删除联动 — 清理向量库）
  if (doc.project_name) {
    try {
      const r = enqueueKbSync(doc.project_name, SYNC_SOURCE.DOCUMENT, req.params.id, 'delete', 0);
      console.log(`[kbSync][document] 删除入队: projectName=${doc.project_name}, recordId=${req.params.id}, action=delete, result=${JSON.stringify(r)}`);
    } catch (e) {
      console.error('[kbSync][document] 删除入队失败:', e.message);
    }
  }

  res.json({ success: true });
});

// 获取统计信息
router.get('/stats/:projectId', requireAuth, (req, res) => {
  const db = getDb();
  const { standard } = req.query;
  let query = 'SELECT COUNT(DISTINCT doc_id) as count FROM documents WHERE project_id = ?';
  const params = [req.params.projectId];
  if (standard) {
    query += ' AND standard = ?';
    params.push(standard);
  }
  const result = db.prepare(query).get(...params);
  res.json({ uploadedDocs: result?.count || 0 });
});

// ========== v6.0: multipart/form-data 流式上传（支持 200MB 大文件 / CAD 图纸） ==========
// 临时上传目录（multer 先落盘，路由中再移动到项目目录）
const TMP_UPLOAD_DIR = path.join(FILES_ROOT, '_tmp_upload');
if (!fs.existsSync(TMP_UPLOAD_DIR)) {
  fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
}

const multipartUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeName = sanitizeFilename(file.originalname);
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
  limits: { fileSize: MAX_FILE_MB_MULTIPART * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
});

/**
 * multipart 流式上传端点
 * Content-Type: multipart/form-data
 * fields: file (文件), projectId, docId, uploadTime, version, standard
 */
router.post('/upload/multipart', requirePermission('can_upload'), multipartUpload.single('file'), (req, res) => {
  const { projectId, docId, uploadTime, version, standard } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: '未接收到文件' });
  }
  if (!projectId || !docId) {
    // 清理临时文件
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: '缺少必要参数 projectId 或 docId' });
  }

  const pid = Number(projectId);
  if (!Number.isInteger(pid) || pid <= 0) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: '非法项目ID' });
  }

  if (docId.includes('..') || docId.includes('/') || docId.includes('\\')) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: 'docId 包含非法字符' });
  }

  const fileName = req.file.originalname;
  const ext = path.extname(fileName).toLowerCase();

  // 移动文件到项目目录
  let filePath = null;
  try {
    const safeName = sanitizeFilename(fileName);
    const safeDocId = sanitizeFilename(docId);
    const dir = path.join(FILES_ROOT, String(pid), safeDocId);
    fs.mkdirSync(dir, { recursive: true });
    const finalPath = path.join(dir, `${Date.now()}_${safeName}`);
    fs.renameSync(req.file.path, finalPath);

    filePath = path.relative(process.cwd(), finalPath);
    if (!filePath.startsWith('files' + path.sep) && filePath !== 'files') {
      console.error('[multipart] Path escape attempt:', filePath);
      try { fs.unlinkSync(finalPath); } catch (_) {}
      return res.status(400).json({ error: '文件路径异常，上传被拒绝' });
    }
  } catch (e) {
    console.error('[multipart] File move error:', e.message);
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(500).json({ error: '文件保存失败' });
  }

  // 写入数据库
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO documents (project_id, doc_id, file_name, file_data, file_path, upload_time, uploader, version, standard) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    pid, docId, fileName,
    null, // multipart 上传文件存磁盘，不存 base64
    filePath,
    uploadTime || new Date().toLocaleString('zh-CN'),
    req.user?.username || '未知',
    version || 'V1.0',
    standard || 'DB11/T695-2025'
  );

  // 入队知识库同步（服务端 AI 向量化）
  try {
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(pid);
    if (project) {
      const r = enqueueKbSync(project.name, SYNC_SOURCE.DOCUMENT, result.lastInsertRowid, 'upsert', 0);
      console.log(`[kbSync][multipart] 入队: projectName=${project.name}, recordId=${result.lastInsertRowid}, fileName=${fileName}, size=${(req.file.size / 1024 / 1024).toFixed(1)}MB, result=${JSON.stringify(r)}`);
    }
  } catch (e) {
    console.error('[kbSync][multipart] 上传入队失败:', e.message);
  }

  res.status(201).json({
    id: result.lastInsertRowid,
    filePath,
    fileName,
    fileSize: req.file.size,
    fileType: ext,
  });
});

// multer 错误处理中间件（文件过大等）
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `文件过大，multipart 上传限制 ${MAX_FILE_MB_MULTIPART}MB` });
    }
    return res.status(400).json({ error: `上传错误: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

export default router;
