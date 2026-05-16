import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_ROOT = process.env.FILES_PATH || path.join(__dirname, '..', 'files');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'planning.db');

const router = Router();

// 单项目备份 ZIP
router.get('/project/:projectId', requireAuth, (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const docs = db.prepare(
    'SELECT id, doc_id, file_name, file_data, file_path, upload_time, uploader, version, standard FROM documents WHERE project_id = ? ORDER BY doc_id'
  ).all(project.id);

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = encodeURIComponent(`backup_${project.name}_${ts}.zip`);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  // 项目元数据
  const meta = {
    project: { id: project.id, name: project.name, exportedAt: new Date().toISOString() },
    documents: docs.map(d => ({ doc_id: d.doc_id, file_name: d.file_name, upload_time: d.upload_time, uploader: d.uploader, version: d.version, standard: d.standard })),
  };
  archive.append(JSON.stringify(meta, null, 2), { name: 'metadata.json' });

  // 添加文件
  for (const d of docs) {
    if (d.file_path) {
      const absPath = path.resolve(__dirname, '..', d.file_path);
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: `files/${d.doc_id}/${d.file_name}` });
      }
    } else if (d.file_data) {
      try {
        const base64 = d.file_data.split(',')[1] || d.file_data;
        archive.append(Buffer.from(base64, 'base64'), { name: `files/${d.doc_id}/${d.file_name}` });
      } catch {}
    }
  }

  archive.finalize();
});

// 全量备份 ZIP
router.get('/all', requireRole('admin'), (req, res) => {
  const db = getDb();
  db.exec('VACUUM');

  const projects = db.prepare('SELECT id, name FROM projects').all();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = encodeURIComponent(`backup_all_${ts}.zip`);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  // 数据库文件
  archive.file(DB_PATH, { name: 'planning.db' });

  // 所有项目数据摘要
  const summary = projects.map(p => {
    const count = db.prepare('SELECT COUNT(*) as c FROM documents WHERE project_id = ?').get(p.id);
    return { id: p.id, name: p.name, documentCount: count?.c || 0 };
  });
  archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), projects: summary }, null, 2), { name: 'summary.json' });

  // 文件目录
  if (fs.existsSync(FILES_ROOT)) {
    archive.directory(FILES_ROOT, 'files');
  }

  archive.finalize();
});

// JSON 导出（用于数据迁移）
router.get('/export', requireAuth, (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, name FROM projects').all();
  const result = {};

  for (const proj of projects) {
    const docs = db.prepare(
      'SELECT doc_id, file_name, file_data, upload_time, uploader, version, standard FROM documents WHERE project_id = ? ORDER BY doc_id, upload_time DESC'
    ).all(proj.id);

    const grouped = {};
    for (const d of docs) {
      if (!grouped[d.doc_id]) grouped[d.doc_id] = [];
      grouped[d.doc_id].push({
        fileName: d.file_name,
        uploadTime: d.upload_time,
        uploader: d.uploader,
        version: d.version,
        fileData: d.file_data,
      });
    }
    result[proj.name] = { standard: docs[0]?.standard || 'DB11/T695-2025', data: grouped };
  }

  res.json(result);
});

export default router;
