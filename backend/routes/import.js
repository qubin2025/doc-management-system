import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// 从 localStorage 格式导入数据
router.post('/', (req, res) => {
  const { projectName, standard, data } = req.body;
  // data 格式: { "docId": [{ fileName, uploadTime, uploader, version, fileData }] }

  if (!projectName || !data) {
    return res.status(400).json({ error: '缺少项目名称或数据' });
  }

  const db = getDb();

  // 确保项目存在
  let project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName);
  if (!project) {
    const result = db.prepare('INSERT INTO projects (name) VALUES (?)').run(projectName);
    project = { id: result.lastInsertRowid };
  }

  const insertStmt = db.prepare(
    'INSERT INTO documents (project_id, doc_id, file_name, file_data, upload_time, uploader, version, standard) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  let count = 0;
  const insertMany = db.transaction(() => {
    for (const [docId, files] of Object.entries(data)) {
      if (!Array.isArray(files)) continue;
      for (const file of files) {
        insertStmt.run(
          project.id,
          docId,
          file.fileName || '',
          file.fileData || null,
          file.uploadTime || new Date().toLocaleString('zh-CN'),
          file.uploader || '未知',
          file.version || 'V1.0',
          standard || 'DB11/T695-2025'
        );
        count++;
      }
    }
  });

  try {
    insertMany();
    res.json({ success: true, imported: count, projectId: project.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
