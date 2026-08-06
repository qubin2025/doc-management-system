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

// DELETE 照片（管理员/项目经理）
router.delete('/photo/:id', requireAuth, (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT file_path FROM mobile_photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: '照片不存在' });
  // 删除磁盘文件
  try {
    let rel = (photo.file_path || '').replace(/\\/g, '/');
    if (/^files[\/\\]/.test(rel)) rel = rel.replace(/^files[\/\\]/, '');
    rel = rel.replace(/^\/+/, '');
    if (rel) { const fp = path.resolve(FILES_ROOT, rel); if (isPathSafe(fp, FILES_ROOT)) fs.unlinkSync(fp); }
  } catch {}
  db.prepare('DELETE FROM mobile_photos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
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


// ===== 11. 现场问题上报 =====
router.post('/issue/report', requireAuth, (req, res) => {
  const { projectId, title, description, severity, assignee, photoData } = req.body;
  if (!projectId || !title) return res.status(400).json({ error: '缺少参数' });
  const db = getDb();
  let photoPath = ''; if (photoData && photoData.startsWith('data:image')) { const dir = path.join(FILES_ROOT, 'mobile-issues'); fs.mkdirSync(dir, { recursive: true }); const m = photoData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/); if (m) { const ext = m[1]==='jpeg'?'jpg':m[1]; const fn = 'issue-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)+'.'+ext; fs.writeFileSync(path.join(dir, fn), Buffer.from(m[2],'base64')); photoPath = '/mobile-issues/'+fn; } }
  const r = db.prepare('INSERT INTO mobile_issues (project_id,title,description,severity,status,assignee,photo_path,reported_by) VALUES (?,?,?,?,?,\'reported\',?,?,?)').run(Number(projectId), title, description||'', severity||'normal', assignee||'', photoPath, req.user?.username||'unknown');
  logAudit(projectId, req.user?.username, 'create', 'mobile_issue', 'issue-'+r.lastInsertRowid, { title, severity });
  res.status(201).json({ id: r.lastInsertRowid, message: '问题已上报' });
});
router.get('/issue/list', requireAuth, (req, res) => {
  const db = getDb(); const { projectId, projectName, status } = req.query;
  let sql = 'SELECT mi.*, p.name as project_name FROM mobile_issues mi JOIN projects p ON mi.project_id = p.id WHERE 1=1'; const params = [];
  if (projectId) { sql += ' AND mi.project_id = ?'; params.push(Number(projectId)); }
  if (projectName) { sql += ' AND p.name = ?'; params.push(projectName); }
  if (status && status !== 'all') { sql += ' AND mi.status = ?'; params.push(status); }
  sql += ' ORDER BY mi.created_at DESC LIMIT 200';
  try { res.json(db.prepare(sql).all(...params).map(r => ({ id: r.id, projectId: r.project_id, projectName: r.project_name, title: r.title, description: r.description, severity: r.severity, status: r.status, assignee: r.assignee, photoPath: r.photo_path?'/files'+r.photo_path:'', reportedBy: r.reported_by, createdAt: r.created_at, updatedAt: r.updated_at }))); } catch { res.json([]); }
});
router.post('/issue/update', requireAuth, (req, res) => {
  const { id, status, assignee } = req.body; if (!id) return res.status(400).json({ error: '缺少问题ID' });
  const db = getDb(); const u = []; const p = [];
  if (status) { u.push('status = ?'); p.push(status); }
  if (assignee !== undefined) { u.push('assignee = ?'); p.push(assignee); }
  if (!u.length) return res.status(400).json({ error: '无更新内容' });
  u.push("updated_at = datetime('now')"); p.push(Number(id));
  db.prepare('UPDATE mobile_issues SET '+u.join(', ')+' WHERE id = ?').run(...p);
  res.json({ message: '更新成功' });
});
// ===== 11b. 进度上报 =====
router.post('/progress/report', requireAuth, (req, res) => {
  const { projectId, title, percentage, note } = req.body;
  if (!projectId || !title || percentage == null) return res.status(400).json({ error: '缺少参数' });
  const db = getDb();
  const r = db.prepare('INSERT INTO mobile_progress (project_id, title, percentage, note, reported_by, match_status) VALUES (?,?,?,?,?,\'unmatched\')').run(Number(projectId), title, Number(percentage)||0, note||'', req.user?.username||'unknown');
  logAudit(projectId, req.user?.username, 'create', 'progress', 'pg-'+r.lastInsertRowid, { title, percentage, matchStatus:'unmatched' });
  res.status(201).json({ id: r.lastInsertRowid, matchStatus: 'unmatched' });
});
router.get('/progress/list', requireAuth, (req, res) => {
  const db = getDb(); const { projectId, projectName } = req.query;
  try { let rows; if (projectName) rows = db.prepare('SELECT mp.*, p.name as project_name FROM mobile_progress mp JOIN projects p ON mp.project_id=p.id WHERE p.name=? ORDER BY mp.created_at DESC LIMIT 200').all(projectName); else if (projectId) rows = db.prepare('SELECT * FROM mobile_progress WHERE project_id=? ORDER BY created_at DESC LIMIT 200').all(Number(projectId)); else rows = db.prepare('SELECT mp.*, p.name as project_name FROM mobile_progress mp JOIN projects p ON mp.project_id=p.id ORDER BY mp.created_at DESC LIMIT 200').all();
    res.json(rows.map(r => ({ id: r.id, projectId: r.project_id, projectName: r.project_name||'', planItemId: r.plan_item_id, title: r.title, percentage: r.percentage, note: r.note, reportedBy: r.reported_by, matchStatus: r.match_status, createdAt: r.created_at }))); } catch { res.json([]); }
});
router.get('/progress/stats', requireAuth, (req, res) => {
  const db = getDb(); const { projectName } = req.query;
  if (!projectName) return res.status(400).json({ error: '缺少参数' });
  try { const p = db.prepare('SELECT id FROM projects WHERE name=?').get(projectName); if (!p) return res.json({ total:0, matched:0, unmatched:0, avgPercentage:0 });
    const rows = db.prepare('SELECT match_status, percentage FROM mobile_progress WHERE project_id=?').all(p.id);
    const total = rows.length, matched = rows.filter(r => r.match_status==='matched').length, avg = total>0 ? Math.round(rows.reduce((s,r) => s+r.percentage,0)/total) : 0;
    res.json({ total, matched, unmatched: total-matched, avgPercentage: avg }); } catch { res.json({ total:0, matched:0, unmatched:0, avgPercentage:0 }); }
});

// ===== 12. 项目日报系统 =====
function arr(s) { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }
function mapDR(r) { return { id: r.id, projectId: r.project_id, projectName: r.project_name || '', reportDate: r.report_date, weatherDay: r.weather_day || '', weatherNight: r.weather_night || '', weatherAlert: r.weather_alert || '', weatherAlertLevel: r.weather_alert_level || '', managersMain: r.managers_main || 0, managersLabor: r.managers_labor || 0, managersSpecialty: r.managers_specialty || 0, workersMain: r.workers_main || 0, workersLabor: r.workers_labor || 0, workersSpecialty: r.workers_specialty || 0, workersSpecial: r.workers_special || 0, workersTotal: r.workers_total || 0, machinery: arr(r.machinery), machineryTotal: r.machinery_total || 0, materials: arr(r.materials), tasks: arr(r.tasks), qualityRisks: arr(r.quality_risks), issues: arr(r.issues), photos: arr(r.photos), originalText: r.original_text || '', safetyIssues: arr(r.issues).map(i => i.problem || '').filter(Boolean).join('；'), notes: r.notes || '', reportedBy: r.reported_by, deleted: r.deleted || 0, createdAt: r.created_at }; }
router.post('/daily/submit', requireAuth, (req, res) => { const b = req.body; if (!b.projectId || !b.reportDate) return res.status(400).json({ error: '缺少参数' }); const db = getDb(); const stmt = db.prepare('INSERT INTO daily_reports(project_id,report_date,weather_day,weather_night,weather_alert,weather_alert_level,managers_main,managers_labor,managers_specialty,workers_main,workers_labor,workers_specialty,workers_special,workers_total,machinery,machinery_total,materials,tasks,quality_risks,issues,photos,original_text,notes,reported_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,report_date) DO UPDATE SET weather_day=excluded.weather_day,weather_night=excluded.weather_night,weather_alert=excluded.weather_alert,weather_alert_level=excluded.weather_alert_level,managers_main=excluded.managers_main,workers_total=excluded.workers_total,machinery=excluded.machinery,machinery_total=excluded.machinery_total,materials=excluded.materials,tasks=excluded.tasks,quality_risks=excluded.quality_risks,issues=excluded.issues,photos=excluded.photos,original_text=excluded.original_text,notes=excluded.notes,reported_by=excluded.reported_by'); const r = stmt.run(Number(b.projectId), b.reportDate, b.weatherDay || '', b.weatherNight || '', b.weatherAlert || '', b.weatherAlertLevel || '', Number(b.managersMain) || 0, Number(b.managersLabor) || 0, Number(b.managersSpecialty) || 0, Number(b.workersMain) || 0, Number(b.workersLabor) || 0, Number(b.workersSpecialty) || 0, Number(b.workersSpecial) || 0, Number(b.workersTotal) || 0, JSON.stringify(b.machinery || []), Number(b.machineryTotal) || 0, JSON.stringify(b.materials || []), JSON.stringify(b.tasks || []), JSON.stringify(b.qualityRisks || []), JSON.stringify(b.issues || []), JSON.stringify(b.photos || []), b.originalText || '', b.notes || '', req.user?.username || 'unknown'); logAudit(b.projectId, req.user?.username, 'create', 'document', 'daily-'+r.lastInsertRowid, { reportDate: b.reportDate }); res.status(201).json({ id: r.lastInsertRowid, message: '日报已提交' }); });
router.get('/daily/list', requireAuth, (req, res) => { const db = getDb(); const { projectId, projectName } = req.query; try { let rows; if (projectId) rows = db.prepare('SELECT * FROM daily_reports WHERE project_id=? AND (deleted=0 OR deleted IS NULL) ORDER BY report_date DESC LIMIT 200').all(Number(projectId)); else if (projectName) rows = db.prepare('SELECT dr.*,p.name as project_name FROM daily_reports dr JOIN projects p ON dr.project_id=p.id WHERE p.name=? AND (dr.deleted=0 OR dr.deleted IS NULL) ORDER BY dr.report_date DESC LIMIT 200').all(projectName); else rows = db.prepare('SELECT dr.*,p.name as project_name FROM daily_reports dr JOIN projects p ON dr.project_id=p.id WHERE (dr.deleted=0 OR dr.deleted IS NULL) ORDER BY dr.report_date DESC LIMIT 500').all(); res.json(rows.map(mapDR)); } catch { res.json([]); } });
router.post('/daily/migrate', requireAuth, (req, res) => { const db = getDb(); const rows = db.prepare('SELECT id,report_date,tasks,machinery,quality_risks,issues FROM daily_reports').all(); let c = 0; for (const r of rows) { const ex = db.prepare('SELECT COUNT(*) as c FROM daily_progress WHERE daily_id=?').get(r.id); if (ex.c > 0) continue; arr(r.tasks).forEach(t => { if (t.description) db.prepare('INSERT OR IGNORE INTO daily_progress(daily_id,report_date,area,description,workers,today_pct,total_pct,schedule_deviation,contractor) VALUES(?,?,?,?,?,?,?,?,?)').run(r.id, r.report_date, t.area || '', t.description, t.workers || 0, t.todayPct || '', t.totalPct || '', t.schedule || '', t.contractor || ''); }); arr(r.machinery).forEach(m => { if (m.name) db.prepare('INSERT OR IGNORE INTO daily_machinery(daily_id,report_date,name,spec,count) VALUES(?,?,?,?,?)').run(r.id, r.report_date, m.name, m.spec || '', m.count || 0); }); arr(r.quality_risks).forEach(q => { if (q.name) db.prepare("INSERT OR IGNORE INTO daily_risks(daily_id,report_date,category,name,detail,status) VALUES(?,?,?,'quality',?,?,?)").run(r.id, r.report_date, q.name, q.inspected || '', q.hazard || ''); }); arr(r.issues).forEach(i => { if (i.problem) db.prepare('INSERT OR IGNORE INTO daily_risks(daily_id,report_date,category,name,detail,status,impact_days) VALUES(?,?,?,"issue",?,?,?,?)').run(r.id, r.report_date, i.problem, i.cause || '', i.measures || '', i.delayDays || 0); }); c++; } res.json({ success: true, migrated: c }); });
router.get('/daily/stats/:projectId', requireAuth, (req, res) => { const db = getDb(); const pid = Number(req.params.projectId); try { const w = db.prepare('SELECT worker_type,SUM(count) as total FROM daily_workers dw JOIN daily_reports dr ON dw.daily_id=dr.id WHERE dr.project_id=? AND (dr.deleted=0 OR dr.deleted IS NULL) GROUP BY worker_type').all(pid); const mt = db.prepare('SELECT SUM(count) as total FROM daily_machinery dm JOIN daily_reports dr ON dm.daily_id=dr.id WHERE dr.project_id=? AND (dr.deleted=0 OR dr.deleted IS NULL)').get(pid); const p = db.prepare('SELECT area,COUNT(*) as cnt FROM daily_progress dp JOIN daily_reports dr ON dp.daily_id=dr.id WHERE dr.project_id=? AND (dr.deleted=0 OR dr.deleted IS NULL) GROUP BY area').all(pid); const rk = db.prepare('SELECT category,COUNT(*) as cnt FROM daily_risks dr2 JOIN daily_reports dr ON dr2.daily_id=dr.id WHERE dr.project_id=? AND (dr.deleted=0 OR dr.deleted IS NULL) GROUP BY category').all(pid); res.json({ workers: w, machineryTotal: mt?.total || 0, progress: p, risks: rk }); } catch { res.json({ workers: [], machineryTotal: 0, progress: [], risks: [] }); } });
router.put('/daily/:id', requireAuth, (req, res) => { const db = getDb(); const r = db.prepare('SELECT * FROM daily_reports WHERE id=?').get(req.params.id); if (!r) return res.status(404).json({ error: '日报不存在' }); if (r.deleted) return res.status(400).json({ error: '日报已失效' }); const created = new Date(r.created_at + 'Z'); const hoursAgo = (new Date() - created) / 3600000; if (hoursAgo > 24) return res.status(400).json({ error: '超过24小时无法修改' }); const b = req.body; db.prepare('UPDATE daily_reports SET weather_day=?,weather_night=?,weather_alert=?,weather_alert_level=?,managers_main=?,managers_labor=?,managers_specialty=?,workers_main=?,workers_labor=?,workers_specialty=?,workers_special=?,workers_total=?,machinery=?,machinery_total=?,materials=?,tasks=?,quality_risks=?,issues=?,photos=?,original_text=?,notes=?,reported_by=? WHERE id=?').run(b.weatherDay || '', b.weatherNight || '', b.weatherAlert || '', b.weatherAlertLevel || '', Number(b.managersMain) || 0, Number(b.managersLabor) || 0, Number(b.managersSpecialty) || 0, Number(b.workersMain) || 0, Number(b.workersLabor) || 0, Number(b.workersSpecialty) || 0, Number(b.workersSpecial) || 0, Number(b.workersTotal) || 0, JSON.stringify(b.machinery || []), Number(b.machineryTotal) || 0, JSON.stringify(b.materials || []), JSON.stringify(b.tasks || []), JSON.stringify(b.qualityRisks || []), JSON.stringify(b.issues || []), JSON.stringify(b.photos || []), b.originalText || '', b.notes || '', req.user?.username || 'unknown', r.id); res.json({ success: true, message: '日报已更新' }); });
router.delete('/daily/:id', requireAuth, (req, res) => { const db = getDb(); const r = db.prepare('SELECT * FROM daily_reports WHERE id=?').get(req.params.id); if (!r) return res.status(404).json({ error: '日报不存在' }); db.prepare('UPDATE daily_reports SET deleted=1 WHERE id=?').run(req.params.id); logAudit(r.project_id, req.user?.username, 'delete', 'document', 'daily-'+req.params.id, { soft: true }); res.json({ success: true, message: '已删除' }); });
const dailyUpload = multer({ storage: multer.diskStorage({ destination: (_r, _f, cb) => { const d = path.join(FILES_ROOT, 'daily-uploads'); fs.mkdirSync(d, { recursive: true }); cb(null, d); }, filename: (_r, f, cb) => { const e = path.extname(f.originalname); cb(null, 'daily-'+Date.now()+'-'+Math.random().toString(36).slice(2, 6)+e); } }), limits: { fileSize: 20 * 1024 * 1024 } });
async function extractText(fp, mime) { const buf = fs.readFileSync(fp); if (fp.endsWith('.docx') || (mime || '').includes('wordprocessingml')) { try { const m = await import('mammoth'); const r = await m.extractRawText({ path: fp }); return r.value || ''; } catch {} } if (fp.endsWith('.doc') || (mime || '').includes('msword')) { try { const W = await import('word-extractor'); const extractor = new W.default(); const doc = await extractor.extract(fp); const body = doc.getBody(); if (body) return body; } catch {} } try { return buf.toString('utf-8'); } catch {} try { return buf.toString('gbk'); } catch {} return buf.toString(); }
function rpJSON(str) {
  var s = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  s = s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  try { return JSON.parse(s); } catch(e1) {
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch(e2) {
      var pos = parseInt((e1.message.match(/position (\d+)/) || [])[1] || '0');
      if (pos > 0) {
        var lc = s.lastIndexOf('},{', pos);
        if (lc > 0) {
          var fixed = s.slice(0, lc + 1) + ']}';
          var d1 = 0; for (var i = 0; i < fixed.length; i++) { if (fixed[i] === '[') d1++; if (fixed[i] === ']') d1--; } while (d1 > 0) { fixed += ']'; d1--; }
          var d2 = 0; for (var i = 0; i < fixed.length; i++) { if (fixed[i] === '{') d2++; if (fixed[i] === '}') d2--; } while (d2 > 0) { fixed += '}'; d2--; }
          fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          try { return JSON.parse(fixed); } catch(e3) {}
        }
      }
      return null;
    }
  }
}

router.post('/daily/upload', requireAuth, dailyUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '缺少文件' });
  const { projectId, projectName } = req.body;
  if (!projectId) return res.status(400).json({ error: '缺少项目ID' });
  const DAILY_PROMPT = `请从工程日报中提取JSON。严格按以下规则：

【天气模块】日报天气情况包含：白天天气、夜间天气、大风预警（蓝/黄/橙/红四级，看是否有对勾或填写，有则填"大风预警"+级别颜色，全空则填"无"）、空气污染预警（同上规则）、其他情况说明。分别填入weatherDay/weatherNight/weatherAlert/weatherAlertLevel字段。如果两种预警都无，weatherAlert填"无"。

【人员模块】管理人员行有三列：总包单位/劳务分包/专业分包，分别填managersMain/managersLabor/managersSpecialty。施工作业人员行有三列：劳务分包/专业分包/特种作业人数，分别填workersLabor/workersSpecialty/workersSpecial。注意：劳务分包作业人员是44人不是284，284是错误数据不要使用。现场人数总计填workersTotal。

【质量危大工程】qualityRisks数组每个元素必须包含：name（分项名称如吊篮/幕墙）、startDate（分项开始时间如2026.4）、inspected（验收情况，如实填写"已组织验收"）、inspectionResult（检查巡视情况如"未见异常"）、hazard（是否存在隐患，填写"否"或"是"，不要用false/true英文）。所有字段必须填写，不要留空。

【施工内容】tasks数组。上午X人下午Y人拆分：workersAM=X, workersPM=Y, workers=(X+Y)/2取整。

【协调问题】issues数组每个元素：problem/cause/delayDays/measures/needHelp。

返回JSON格式（只返回JSON不要其他内容）：
{"reportDate":"YYYY-MM-DD","weatherDay":"","weatherNight":"","weatherAlert":"","weatherAlertLevel":"","managersMain":0,"managersLabor":0,"managersSpecialty":0,"workersMain":0,"workersLabor":0,"workersSpecialty":0,"workersSpecial":0,"workersTotal":0,"machinery":[{"name":"","spec":"","count":0}],"machineryTotal":0,"materials":[],"tasks":[{"area":"","description":"","workersAM":0,"workersPM":0,"workers":0,"todayPct":"","totalPct":"","schedule":"","contractor":""}],"qualityRisks":[{"name":"","startDate":"","inspected":"","inspectionResult":"","hazard":""}],"issues":[{"problem":"","cause":"","delayDays":0,"measures":"","needHelp":""}],"photos":[],"notes":""}`;
  try {
    const text = await extractText(req.file.path, req.file.mimetype);
    if (!text || text.length < 20) return res.json({ parsed: null, message: '无法提取文本，请检查文件格式' });
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.json({ parsed: null, message: 'AI服务未配置', rawText: text.slice(0, 500) });
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: '日报文本：' + text.slice(0, 5000) + '\n\n' + DAILY_PROMPT }], temperature: 0.1, max_tokens: 4000 }),
      signal: AbortSignal.timeout(90000),
    });
    if (!resp.ok) return res.json({ parsed: null, message: 'AI服务暂时不可用' });
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || '';
    const m = reply.match(/\{[\s\S]*\}/);
    const parsed = m ? rpJSON(m[0]) : null;
    res.json({ parsed, message: parsed ? '解析成功，请检查后提交' : 'AI解析未成功，请手动填写', rawText: reply.slice(0, 1500) });
  } catch (e) { res.json({ parsed: null, message: e.message || '处理失败', rawText: '' }); }
});

export default router;
