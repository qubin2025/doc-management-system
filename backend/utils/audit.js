import { getDb } from '../db.js';

/** 将审计详情转为可读中文描述 */
function formatDetail(action, targetType, detail) {
  if (!detail || Object.keys(detail).length === 0) return '';
  const d = detail;

  // 同步操作
  if (d.results) {
    const r = d.results;
    const parts = [];
    if (r.objectives > 0) parts.push(`同步目标${r.objectives}条`);
    if (r.documents > 0) parts.push(`同步文档${r.documents}条`);
    if (r.baselines > 0) parts.push(`同步基线${r.baselines}条`);
    if (r.artifacts > 0) parts.push(`同步知识产物${r.artifacts}条`);
    return parts.length > 0 ? parts.join('，') : '同步完成（无数据变更）';
  }

  // 目标操作
  if (targetType === 'objective') {
    const title = d.title ? `「${d.title}」` : '';
    const levelMap = { root: '总目标', phase: '阶段目标', deliverable: '交付物', 'work-item': '工作包' };
    const level = d.level ? levelMap[d.level] || d.level : '';
    switch (action) {
      case 'create': return `创建${level}${title}`;
      case 'update': return d.changed ? `修改${title}：${d.changed.join('、')}` : `修改${title}`;
      case 'delete': return `删除${level}${title}及其子目标`;
    }
  }

  // 基线操作
  if (targetType === 'baseline') {
    const typeMap = { scope: '范围基线', schedule: '进度基线', cost: '成本基线' };
    const type = d.baselineType ? typeMap[d.baselineType] || d.baselineType : '';
    const ver = d.version ? ` V${d.version}` : '';
    switch (action) {
      case 'create': return `创建${type}${ver}`;
      case 'delete': return `删除${type}`;
    }
  }

  // 配置同步
  if (targetType === 'configuration') {
    switch (action) {
      case 'update': return '项目配置数据同步至后端';
    }
  }

  // 通用fallback: 展示key-value
  const entries = Object.entries(d).slice(0, 3);
  return entries.map(([k, v]) => {
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `${k}: ${val}`;
  }).join(', ');
}

/**
 * 记录操作审计日志
 */
export function logAudit(projectName, userId, action, targetType, targetId, detail = {}, ipAddress = '') {
  try {
    const db = getDb();
    const readable = formatDetail(action, targetType, detail) || JSON.stringify(detail);
    db.prepare(
      `INSERT INTO audit_log (project_name, user_id, action, target_type, target_id, detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(projectName, userId, action, targetType, targetId, readable, ipAddress);
  } catch (e) {
    console.warn('[Audit] 记录审计日志失败:', e.message);
  }
}

/**
 * 查询审计日志
 */
export function queryAuditLog(filters = {}) {
  const { projectName, userId, action, limit = 100, offset = 0 } = filters;
  const db = getDb();
  const conditions = [];
  const params = [];

  if (projectName) { conditions.push('project_name = ?'); params.push(projectName); }
  if (userId) { conditions.push('user_id = ?'); params.push(userId); }
  if (action) { conditions.push('action = ?'); params.push(action); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
}
