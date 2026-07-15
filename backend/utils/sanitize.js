// 数据脱敏：移除身份证号、手机号、邮箱、金额、地址、公司名称
export function sanitizeText(text) {
  if (!text) return text;
  return text
    // 个人信息
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证号已脱敏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已脱敏]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, '[邮箱已脱敏]')
    .replace(/\b(?:\d{3}-\d{8}|\d{4}-\d{7,8}|\d{4}-\d{3}-\d{3})\b/g, '[固定电话已脱敏]')
    // 金额数据
    .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:万|亿|元|USD|CNY)\b/g, '[金额已脱敏]')
    // 详细地址（含门牌号）
    .replace(/(?:北京市?|上海市?|广东省?|深圳市?|广州市?|成都市?|杭州市?)\S{0,20}(?:路|街|道|巷|号|楼|室|层|座|单元|栋|幢)\S{0,10}/g, '[地址已脱敏]')
    // 公司组织机构代码
    .replace(/\b[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}\b/g, '[统一信用代码已脱敏]');
}

/** AI请求成本摘要（用于审计日志，不含敏感内容） */
export function summarizePrompt(prompt) {
  if (!prompt) return { length: 0, type: 'empty' };
  const sanitized = sanitizeText(prompt);
  return {
    length: prompt.length,
    sanitizedLength: sanitized.length,
    hasAttachment: prompt.includes('base64') || prompt.includes('[图片'),
    type: prompt.length > 2000 ? '长篇文档' : prompt.length > 200 ? '标准请求' : '短查询',
    preview: sanitized.slice(0, 80).replace(/\n/g, ' '),
  };
}

/** 计算token估算费用 */
export function estimateCost(promptLength, model = 'deepseek-chat') {
  const prices = {
    'deepseek-chat':    { input: 0.001,  output: 0.002  },  // 元/1K tokens
    'deepseek-reasoner':{ input: 0.004,  output: 0.016  },
    'qwen-plus':        { input: 0.0008, output: 0.002  },
    'glm-4-flash':      { input: 0.0001, output: 0.0001 },
  };
  const p = prices[model] || { input: 0.001, output: 0.002 };
  const inputTokens = Math.ceil(promptLength / 3); // 中文≈3字符/token
  const outputTokens = Math.ceil(inputTokens * 0.5);
  return {
    inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCost: +(inputTokens / 1000 * p.input + outputTokens / 1000 * p.output).toFixed(4),
    model,
  };
}
