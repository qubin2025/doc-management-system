import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// 备份数据库
router.get('/', (req, res) => {
  const db = getDb();
  // 执行 VACUUM 优化然后备份
  db.exec('VACUUM');
  db.backup(`backup-${new Date().toISOString().split('T')[0]}.db`)
    .then(() => {
      res.json({ success: true, message: '备份完成' });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

// 获取所有文档数据（用于迁移）
router.get('/export', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, name FROM projects').all();
  const result = {};

  for (const proj of projects) {
    const docs = db.prepare(
      'SELECT doc_id, file_name, file_data, upload_time, uploader, version, standard FROM documents WHERE project_id = ? ORDER BY doc_id, upload_time DESC'
    ).all(proj.id);

    const grouped = {};
    for (const d of docs) {
      if (!grouped[d.doc_id]) {
        grouped[d.doc_id] = [];
      }
      grouped[d.doc_id].push({
        fileName: d.file_name,
        uploadTime: d.upload_time,
        uploader: d.uploader,
        version: d.version,
        fileData: d.file_data
      });
    }

    result[proj.name] = { standard: docs[0]?.standard || 'DB11/T695-2025', data: grouped };
  }

  res.json(result);
});

export default router;
