// 数据脱敏：移除身份证号、手机号、邮箱、详细地址
// v5.6: 修复金额脱敏过度的问题 —— 仅脱敏个人敏感信息，保留项目技术数据
export function sanitizeText(text) {
  if (!text) return text;
  return text
    // 个人信息
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证号已脱敏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已脱敏]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, '[邮箱已脱敏]')
    .replace(/\b(?:\d{3}-\d{8}|\d{4}-\d{7,8}|\d{4}-\d{3}-\d{3})\b/g, '[固定电话已脱敏]')
    // 详细地址脱敏(仅限个人住宅地址,保留项目地址)
    // 仅脱敏 省/市 + 小区/花园/公寓/住宅 + 门牌号 格式
    .replace(/(?:北京市?|上海市?|广东省?|深圳市?|广州市?|成都市?|杭州市?|江苏省?|浙江省?|山东省?|河北省?|河南省?|湖北省?|湖南省?|安徽省?|福建省?|四川省?|陕西省?|辽宁省?|吉林省?|黑龙江省?|江西省?|云南省?|贵州省?|山西省?|甘肃省?|海南省?|青海省?|台湾省?|内蒙古自治区?|广西壮族自治区?|西藏自治区?|宁夏回族自治区?|新疆维吾尔自治区?)\S{0,15}(?:小区|花园|公寓|住宅|家园|苑|庭|阁|轩)\S{0,10}(?:\d{1,3}号楼?|\d{1,3}栋?|\d{1,3}幢?|\d{1,3}单元?)?\S{0,10}(?:\d{1,3}室|\d{1,3}层)?/g, '[地址已脱敏]')
    // 公司组织机构代码
    .replace(/\b[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}\b/g, '[统一信用代码已脱敏]');
  // 注意: 金额/投资/面积等技术数据不脱敏,AI提取需要这些数据
  // 注意: 项目地址(如"建华区文化路")不脱敏,避免AI无法定位项目
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
