// 数据脱敏：移除身份证号、手机号、邮箱
export function sanitizeText(text) {
  if (!text) return text;
  return text
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证号已脱敏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已脱敏]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, '[邮箱已脱敏]')
    .replace(/\b(?:\d{3}-\d{8}|\d{4}-\d{7,8}|\d{4}-\d{3}-\d{3})\b/g, '[固定电话已脱敏]');
}
