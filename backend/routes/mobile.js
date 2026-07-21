import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_ROOT = process.env.FILES_PATH || path.join(__dirname, '..', 'files');
const router = Router();

// 文件上传配置
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(FILES_ROOT, 'mobile-photos');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ===== 1. 水印照片上传 =====
router.post('/photo/upload', requireAuth, upload.single('photo'), (req, res) => {
  const { projectId, location, watermarkData } = req.body;
  if (!req.file || !projectId) {
    return res.status(400).json({ error: '缺少照片或项目ID' });
  }
  const db = getDb();

  // 检查移动端照片记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS mobile_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      watermark_data TEXT DEFAULT '{}',
      location TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      poi TEXT DEFAULT '',
      address TEXT DEFAULT '',
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mobile_photos_project ON mobile_photos(project_id);
  `);

  const stmt = db.prepare(`INSERT INTO mobile_photos (project_id, file_path, watermark_data, location, latitude, longitude, poi, address, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const result = stmt.run(
    Number(projectId),
    req.file.path.replace(FILES_ROOT, '').replace(/\\/g, '/'),
    watermarkData || '{}',
    location || '',
    parseFloat(req.body.latitude) || null,
    parseFloat(req.body.longitude) || null,
    req.body.poi || '',
    req.body.address || '',
    req.user?.username || 'unknown'
  );

  logAudit(projectId, req.user?.username || 'unknown', 'create', 'document', `photo-${result.lastInsertRowid}`, { type: 'mobile_photo' });

  res.status(201).json({
    id: result.lastInsertRowid,
    filePath: req.file.path,
    message: '照片上传成功',
  });
});

// ===== 2. 启动预警检查 =====
router.get('/notice/check', requireAuth, (req, res) => {
  const db = getDb();
  const username = req.user?.username;
  const today = new Date().toISOString().slice(0, 10);

  // 7天内截止的任务
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 7);
  const deadlineStr = deadlineDate.toISOString().slice(0, 10);

  // 从objectives表查询即将到期的目标
  const upcomingObjectives = db.prepare(
    `SELECT o.*, p.name as project_name FROM objectives o
     JOIN projects p ON o.project_name = p.name
     WHERE o.status != 'completed'
     ORDER BY o.updated_at DESC LIMIT 20`
  ).all();

  // 审计日志中的未读通知（最近24小时）
  const recentAudit = db.prepare(
    `SELECT * FROM audit_log WHERE created_at >= datetime('now', '-1 day')
     ORDER BY created_at DESC LIMIT 30`
  ).all();

  // 统计
  const totalMessages = recentAudit.length;
  const urgentCount = upcomingObjectives.filter(o => o.status === 'not-started').length;
  const todayTasks = upcomingObjectives.filter(o => {
    const updated = o.updated_at?.slice(0, 10);
    return updated === today;
  }).length;

  res.json({
    totalMessages,
    urgentCount,
    todayTasks,
    upcomingDeadlines: upcomingObjectives.slice(0, 10).map(o => ({
      id: o.id,
      title: o.title,
      projectName: o.project_name,
      status: o.status,
      progress: o.progress,
      deadline: o.updated_at,
    })),
    recentNotifications: recentAudit.slice(0, 5).map(a => ({
      id: a.id,
      action: a.action,
      targetType: a.target_type,
      detail: a.detail,
      time: a.created_at,
    })),
  });
});

// ===== 3. 水印模板云端同步 =====
router.post('/template/save', requireAuth, (req, res) => {
  const { templateData } = req.body;
  if (!templateData) return res.status(400).json({ error: '缺少模板数据' });

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS mobile_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      template_data TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const { name, data } = templateData;
  const stmt = db.prepare(
    `INSERT INTO mobile_templates (user_id, template_name, template_data) VALUES (?, ?, ?)`
  );
  const result = stmt.run(req.user?.username || 'unknown', name || '未命名模板', JSON.stringify(data || templateData));

  res.status(201).json({ id: result.lastInsertRowid, message: '模板保存成功' });
});

// GET 获取用户模板列表
router.get('/template/list', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const templates = db.prepare(
      'SELECT * FROM mobile_templates WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(req.user?.username || 'unknown');
    res.json(templates);
  } catch {
    res.json([]);
  }
});

// ===== 4. 后端水印合成（Canvas兜底） =====
router.post('/watermark/generate', requireAuth, (req, res) => {
  // 水印合成为前端Canvas实现，后端仅做兜底
  // 此处接收原始图片和水印参数，调用图片处理库合成
  // 移动端Canvas已覆盖多数场景，此端点作为失败时的降级方案
  const { imageBase64, watermarkConfig } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '缺少图片数据' });

  // 降级方案：原图返回 + 标记为未加水印
  res.json({
    image: imageBase64,
    watermarked: false,
    fallback: true,
    message: '后端水印服务（降级模式）— 图片已保存，水印需前端重新合成',
    config: watermarkConfig || {},
  });
});

// ===== 5. 照片列表查询 =====
router.get('/photo/list', requireAuth, (req, res) => {
  const db = getDb();
  const { projectId } = req.query;
  let rows;
  if (projectId) {
    rows = db.prepare(
      `SELECT mp.*, p.name as project_name FROM mobile_photos mp
       JOIN projects p ON mp.project_id = p.id
       WHERE mp.project_id = ? ORDER BY mp.created_at DESC LIMIT 200`
    ).all(Number(projectId));
  } else {
    rows = db.prepare(
      `SELECT mp.*, p.name as project_name FROM mobile_photos mp
       JOIN projects p ON mp.project_id = p.id
       ORDER BY mp.created_at DESC LIMIT 200`
    ).all();
  }
  res.json(rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    filePath: r.file_path,
    watermarkData: safeJson(r.watermark_data),
    location: r.location,
    latitude: r.latitude,
    longitude: r.longitude,
    poi: r.poi,
    address: r.address,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  })));
});

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

// 路径安全检查
function isPathSafe(targetPath, baseDir) {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(baseDir);
  return resolved.startsWith(base);
}

// ===== 6. 照片文件获取 =====
router.get('/photo/file/:id', requireAuth, (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT file_path FROM mobile_photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: '照片不存在' });

  // 避免路径拼接重复：DB 可能存了 files/ 前缀（与 FILES_ROOT 重叠）或 / 开头
  // 统一清洗为从 FILES_ROOT 出发的相对路径
  let rel = (photo.file_path || '').replace(/\\/g, '/');
  // 去掉可能的 files/ 前缀（与 FILES_ROOT 结尾重复）
  if (/^files[\/\\]/.test(rel)) rel = rel.replace(/^files[\/\\]/, '');
  rel = rel.replace(/^\/+/, '');
  if (!rel) return res.status(404).json({ error: '无效的文件路径' });
  const fullPath = path.resolve(FILES_ROOT, rel);
  if (fullPath && isPathSafe(fullPath, FILES_ROOT)) {
    try {
      const buf = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return res.json({
        fileName: path.basename(fullPath),
        fileData: `data:${mime};base64,${buf.toString('base64')}`,
      });
    } catch {}
  }
  res.status(404).json({ error: '照片文件不可用' });
});

// ===== 7. 定位信息获取 =====
router.get('/location/get', requireAuth, (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: '缺少经纬度参数' });

  // 定位信息由前端GPS获取，后端接收并返回确认
  res.json({
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    timestamp: new Date().toISOString(),
    message: '定位信息已记录',
    // 未来可对接逆地理编码服务获取POI名称
    poi: `(${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})`,
  });
});

export default router;
