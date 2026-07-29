/**
 * AI 限流 + 用量追踪 (ai.js / ai_admin.js 共享)
 * 提取自 ai.js，减少文件行数
 */

// 分钟限流
const rateMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60000;

// 日用量统计
export const dailyUsage = new Map();
export const DAILY_LIMIT = 200;
export const DAILY_COST_LIMIT = 10;

export function checkDaily(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const record = dailyUsage.get(userId);
  if (!record || record.date !== today) {
    dailyUsage.set(userId, { date: today, count: 0, cost: 0, frozen: false });
    return true;
  }
  if (record.frozen) return false;
  if (record.count >= DAILY_LIMIT || record.cost >= DAILY_COST_LIMIT) {
    record.frozen = true;
    console.warn(`[AI安全] 用户${userId}超过日用量上限(调用${record.count}次/费用¥${record.cost.toFixed(2)}),已冻结`);
    return false;
  }
  return true;
}

function checkPerMinute(userId) {
  const now = Date.now();
  const record = rateMap.get(userId);
  if (!record || now - record.windowStart > RATE_WINDOW) {
    rateMap.set(userId, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

export function checkRate(userId) {
  if (!checkDaily(userId)) return false;
  return checkPerMinute(userId);
}

export function trackUsage(userId, promptLen, model) {
  const today = new Date().toISOString().slice(0, 10);
  const record = dailyUsage.get(userId);
  if (!record || record.date !== today) {
    dailyUsage.set(userId, { date: today, count: 1, cost: +(promptLen / 3000 * 0.003).toFixed(4), frozen: false });
    return;
  }
  record.count++;
  record.cost += +(promptLen / 3000 * 0.002).toFixed(4);
}
