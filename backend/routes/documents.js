import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

const router = Router();
const FILES_ROOT = process.env.FILES_PATH || path.join(process.cwd(), 'files');
const MAX_FILE_MB = 50; // 单文件大小上限
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.dwg', '.zip', '.rar', '.txt', '.csv'];

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
  let query = 'SELECT id, doc_id, file_name, file_data, file_path, upload_time, uploader, version, standard FROM documents WHERE project_id = ?';
  const params = [req.params.projectId];
  if (standard) {
    query += ' AND standard = ?';
    params.push(standard);
  }
  query += ' ORDER BY doc_id, upload_time DESC';
  const docs = db.prepare(query).all(...params);

  const grouped = {};
  for (const d of docs) {
    if (!grouped[d.doc_id]) grouped[d.doc_id] = [];
    grouped[d.doc_id].push({
      id: d.id,
      fileName: d.file_name,
      uploadTime: d.upload_time,
      uploader: d.uploader,
      version: d.version,
      fileData: d.file_data,
      filePath: d.file_path,
    });
  }
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

  res.status(201).json({ id: result.lastInsertRowid, filePath });
});

// 下载文档（获取文件数据）
router.get('/download/:id', requireAuth, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT file_name, file_data, file_path FROM documents WHERE id = ?').get(req.params.id);

  if (!doc) return res.status(404).json({ error: '文件不存在' });

  // 优先从磁盘读取
  if (doc.file_path) {
    try {
      const absPath = path.resolve(process.cwd(), doc.file_path);
      if (!isPathSafe(absPath, FILES_ROOT)) return res.status(403).json({ error: '非法文件路径' });
      if (fs.existsSync(absPath)) {
        const buf = fs.readFileSync(absPath);
        return res.json({
          fileName: doc.file_name,
          fileData: 'data:application/octet-stream;base64,' + buf.toString('base64'),
        });
      }
    } catch (e) {
      console.error('File read error:', e.message);
    }
  }

  // 回退到数据库
  if (doc.file_data) {
    return res.json({ fileName: doc.file_name, fileData: doc.file_data });
  }

  res.status(404).json({ error: '文件数据不存在' });
});

// 删除单条文档记录
router.delete('/:id', requirePermission('can_upload'), (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT id, file_path FROM documents WHERE id = ?').get(req.params.id);
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

export default router;
