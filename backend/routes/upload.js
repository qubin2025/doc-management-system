/**
 * 临时图片上传 — 用于AI视觉分析
 * POST /api/upload/image → 返回 { id, url }
 * 图片保存到 backend/temp-images/ (重启时清空)
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '..', 'temp-images');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: TEMP_DIR,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 单文件20MB

const router = Router();

// POST /api/upload/image — 上传图片供AI分析
router.post('/image', requireAuth, (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      console.error('[UPLOAD-ERR]', err.message, err.code);
      return res.status(500).json({ error: err.message || '上传失败', code: err.code });
    }
    next();
  });
}, (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: '未选择文件' });

  const results = files.map(f => ({
    id: path.basename(f.filename, path.extname(f.filename)),
    name: f.originalname,
    size: f.size,
    url: `/temp-images/${f.filename}`,
    localPath: f.path,
  }));

  // 清理30分钟前的旧文件
  const now = Date.now();
  fs.readdir(TEMP_DIR, (err, items) => {
    if (err) return;
    for (const item of items) {
      const p = path.join(TEMP_DIR, item);
      fs.stat(p, (_, stat) => { if (stat && now - stat.mtimeMs > 30 * 60 * 1000) fs.unlink(p, () => {}); });
    }
  });

  res.json({ ok: true, images: results });
});

export default router;
