import { getDb } from '../db.js';

/**
 * 记录操作审计日志
 * @param {string} projectName - 项目名称
 * @param {string} userId - 操作用户ID
 * @param {'create'|'update'|'delete'|'view'|'export'|'import'} action - 操作动作
 * @param {'project'|'objective'|'baseline'|'document'|'work-item'|'form'|'configuration'} targetType - 操作目标类型
 * @param {string} targetId - 操作目标ID
 * @param {object} detail - 变更详情
 * @param {string} ipAddress - 客户端IP
 */
export function logAudit(projectName, userId, action, targetType, targetId, detail = {}, ipAddress = '') {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_log (project_name, user_id, action, target_type, target_id, detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(projectName, userId, action, targetType, targetId, JSON.stringify(detail), ipAddress);
  } catch (e) {
    console.warn('[Audit] 记录审计日志失败:', e.message);
  }
}

/**
 * 查询审计日志
 * @param {object} filters - 筛选条件
 * @param {string} [filters.projectName] - 按项目筛选
 * @param {string} [filters.userId] - 按用户筛选
 * @param {string} [filters.action] - 按操作类型筛选
 * @param {number} [filters.limit=100] - 返回条数上限
 * @param {number} [filters.offset=0] - 偏移量
 * @returns {Array} 审计日志列表
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
