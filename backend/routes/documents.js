import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// 获取某个项目下的所有文档上传记录
router.get('/project/:projectId', (req, res) => {
  const db = getDb();
  const { standard } = req.query;
  let query = 'SELECT id, doc_id, file_name, file_data, upload_time, uploader, version, standard FROM documents WHERE project_id = ?';
  const params = [req.params.projectId];
  if (standard) {
    query += ' AND standard = ?';
    params.push(standard);
  }
  query += ' ORDER BY doc_id, upload_time DESC';
  const docs = db.prepare(query).all(...params);

  // 按 doc_id 分组
  const grouped = {};
  for (const d of docs) {
    if (!grouped[d.doc_id]) {
      grouped[d.doc_id] = [];
    }
    grouped[d.doc_id].push({
      id: d.id,
      fileName: d.file_name,
      uploadTime: d.upload_time,
      uploader: d.uploader,
      version: d.version,
      fileData: d.file_data
    });
  }
  res.json(grouped);
});

// 获取所有文档记录（扁平列表）
router.get('/all/:projectId', (req, res) => {
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
router.post('/upload', (req, res) => {
  const { projectId, docId, fileName, fileData, uploadTime, uploader, version, standard } = req.body;

  if (!projectId || !docId || !fileName) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO documents (project_id, doc_id, file_name, file_data, upload_time, uploader, version, standard) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    projectId,
    docId,
    fileName,
    fileData || null,
    uploadTime || new Date().toLocaleString('zh-CN'),
    uploader || '未知',
    version || 'V1.0',
    standard || 'DB11/T695-2025'
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// 下载文档（获取文件数据）
router.get('/download/:id', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT file_name, file_data FROM documents WHERE id = ?').get(req.params.id);
  if (!doc || !doc.file_data) {
    return res.status(404).json({ error: '文件不存在' });
  }
  res.json({ fileName: doc.file_name, fileData: doc.file_data });
});

// 删除单条文档记录
router.delete('/:id', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: '记录不存在' });
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 获取统计信息
router.get('/stats/:projectId', (req, res) => {
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
