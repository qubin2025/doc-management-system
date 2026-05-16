import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

const router = Router();
const FILES_ROOT = process.env.FILES_PATH || path.join(process.cwd(), 'files');

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
  const { projectId, docId, fileName, fileData, uploadTime, uploader, version, standard } = req.body;

  if (!projectId || !docId || !fileName) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  let filePath = null;
  // 如果有文件数据，写入磁盘
  if (fileData && fileData.length > 100) {
    try {
      const dir = path.join(FILES_ROOT, String(projectId), docId);
      fs.mkdirSync(dir, { recursive: true });
      const ts = Date.now();
      filePath = path.join(dir, `${ts}_${fileName}`);
      const base64 = fileData.split(',')[1] || fileData;
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      filePath = path.relative(process.cwd(), filePath);
    } catch (e) {
      console.error('File write error:', e.message);
    }
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO documents (project_id, doc_id, file_name, file_data, file_path, upload_time, uploader, version, standard) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    projectId, docId, fileName,
    filePath ? null : (fileData || null), // 文件存磁盘则不再存 Base64
    filePath,
    uploadTime || new Date().toLocaleString('zh-CN'),
    uploader || req.user?.username || '未知',
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
      if (fs.existsSync(absPath)) {
        const buf = fs.readFileSync(absPath);
        return res.json({
          fileName: doc.file_name,
          fileData: 'data:application/octet-stream;base64,' + buf.toString('base64'),
        });
      }
    } catch {}
  }

  // 回退到数据库
  if (doc.file_data) {
    return res.json({ fileName: doc.file_name, fileData: doc.file_data });
  }

  res.status(404).json({ error: '文件数据不存在' });
});

// 删除单条文档记录
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT id, file_path FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: '记录不存在' });

  // 删除磁盘文件
  if (doc.file_path) {
    try {
      const absPath = path.resolve(process.cwd(), doc.file_path);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch {}
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
