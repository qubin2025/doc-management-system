/**
 * localStorage 项目键精确匹配工具
 *
 * 背景：项目删除/清理时，旧代码用 k.includes(projectName) 做子串匹配，
 * 导致删除"桥"项目时误删"天桥改造"项目的键（"天桥改造"包含"桥"）。
 * 本模块提供精确前缀匹配，杜绝跨项目误伤。
 */

/** 项目级 localStorage 键前缀清单（与 App.tsx 重命名迁移保持一致） */
export const PROJECT_KEY_PREFIXES = [
  'guide-',              // 指南进度/模块/链接
  'guide-forms-',        // 指南表单内容/样本/成果/提示词
  'guide-item-links-',   // 指南工作项关联线
  'stakeholder-',        // 干系人
  'risk-',               // 风险
  'resources-',          // 资源
  'raci-',               // RACI 矩阵
  'tailoring-config-',   // 裁剪配置
  'project-objectives-', // 目标管理
  'schedule-',           // 进度计划
  'knowledge-artifacts-',// 知识加工产物
  'plan-files-',         // 进度计划文件
  'doc-mgmt-upload-',    // 上传数据（标准号维度）
] as const;

/**
 * 判断 localStorage 键是否属于指定项目/目标（精确边界匹配，非子串匹配）
 *
 * 匹配规则：键 === prefix+target（无后缀）或键以 prefix+target- 开头（后跟分隔符）
 * 这确保"测试"不会误匹配"测试1"的键（因为 guide-测试1- 不以 guide-测试- 开头）
 *
 * @example
 * isKeyForTarget('guide-天宝北街-chapter-ch1', '天宝北街') → true
 * isKeyForTarget('guide-天桥改造-chapter-ch1', '桥')       → false（不会误伤）
 * isKeyForTarget('guide-测试1-chapter-ch1', '测试')         → false（前缀不混淆）
 * isKeyForTarget('plan-files-天宝北街', '天宝北街')          → true
 */
export function isKeyForTarget(key: string, target: string): boolean {
  if (!target) return false;
  return PROJECT_KEY_PREFIXES.some(prefix => {
    const fullPrefix = prefix + target;
    // 精确匹配：键 === prefix+target（无后缀，如 plan-files-天宝北街）
    // 或键以 prefix+target- 开头（有后缀，如 guide-天宝北街-chapter-ch1-done）
    return key === fullPrefix || key.startsWith(fullPrefix + '-');
  });
}

/**
 * 获取指定项目/目标的所有 localStorage 键（精确匹配）
 * 用于项目删除/清理时的安全批量收集
 */
export function collectKeysForTarget(target: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isKeyForTarget(k, target)) result.push(k);
  }
  return result;
}

/**
 * 项目重命名时，将旧项目名的键迁移到新项目名（精确边界匹配）
 *
 * @returns 新键名（如果键属于旧项目），或 null（如果键不属于旧项目）
 *
 * @example
 * migrateKeyOnRename('guide-测试-chapter-ch1-done', '测试', '新名') → 'guide-新名-chapter-ch1-done'
 * migrateKeyOnRename('guide-测试1-chapter-ch1-done', '测试', '新名') → null（不误迁移测试1的键）
 */
export function migrateKeyOnRename(key: string, oldName: string, newName: string): string | null {
  if (!oldName || !newName) return null;
  for (const prefix of PROJECT_KEY_PREFIXES) {
    const oldFull = prefix + oldName;
    // 精确边界匹配：键 === prefix+oldName 或键以 prefix+oldName- 开头
    if (key === oldFull) return prefix + newName;
    if (key.startsWith(oldFull + '-')) {
      return prefix + newName + key.substring(oldFull.length);
    }
  }
  return null;
}
