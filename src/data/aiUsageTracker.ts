/**
 * AI 调用统计追踪器 — 记录各 AI 服务的调用次数、耗时、成功率
 *
 * 数据持久化到 localStorage（上限 500 条），支持按项目/服务类型聚合统计。
 * 在 skillRegistry / multiAgentOrchestrator / ragService 等模块执行前后调用 record()。
 */

export type AiServiceType = 'skill' | 'agent' | 'rag' | 'review' | 'chat';

export interface AiUsageRecord {
  id: string;
  projectName: string;
  serviceType: AiServiceType;
  serviceName: string;         // 如 'construction-review'、'general-engineer'
  duration: number;            // 耗时 ms
  success: boolean;
  timestamp: string;           // ISO
  metadata?: Record<string, unknown>;
}

export interface AiUsageStats {
  totalCalls: number;
  successCount: number;
  failCount: number;
  successRate: number;         // 0-100
  avgDuration: number;         // ms
  byService: Record<string, { count: number; successRate: number; avgDuration: number }>;
}

export interface AiUsageTrendPoint {
  date: string;                // YYYY-MM-DD
  totalCalls: number;
  successCount: number;
}

const STORAGE_KEY = 'ai-usage-records';
const MAX_RECORDS = 500;

class AiUsageTracker {
  private records: AiUsageRecord[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      this.records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      this.records = [];
    }
  }

  private save(): void {
    try {
      // 超出上限时保留最新的 MAX_RECORDS 条
      if (this.records.length > MAX_RECORDS) {
        this.records = this.records.slice(-MAX_RECORDS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {}
  }

  /** 记录一次 AI 调用 */
  record(rec: Omit<AiUsageRecord, 'id' | 'timestamp'> & { timestamp?: string }): void {
    this.records.push({
      ...rec,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: rec.timestamp || new Date().toISOString(),
    });
    this.save();
  }

  /** 获取统计（可按项目筛选） */
  getStats(projectName?: string): AiUsageStats {
    const filtered = projectName
      ? this.records.filter(r => r.projectName === projectName)
      : this.records;

    const totalCalls = filtered.length;
    const successCount = filtered.filter(r => r.success).length;
    const failCount = totalCalls - successCount;
    const successRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0;
    const avgDuration = totalCalls > 0
      ? Math.round(filtered.reduce((s, r) => s + r.duration, 0) / totalCalls)
      : 0;

    // 按服务名聚合
    const byService: Record<string, { count: number; successRate: number; avgDuration: number }> = {};
    const serviceMap: Record<string, { count: number; success: number; duration: number }> = {};
    filtered.forEach(r => {
      const key = `${r.serviceType}:${r.serviceName}`;
      if (!serviceMap[key]) serviceMap[key] = { count: 0, success: 0, duration: 0 };
      serviceMap[key].count++;
      if (r.success) serviceMap[key].success++;
      serviceMap[key].duration += r.duration;
    });
    Object.entries(serviceMap).forEach(([key, v]) => {
      byService[key] = {
        count: v.count,
        successRate: Math.round((v.success / v.count) * 100),
        avgDuration: Math.round(v.duration / v.count),
      };
    });

    return { totalCalls, successCount, failCount, successRate, avgDuration, byService };
  }

  /** 获取调用趋势（近 N 天） */
  getTrend(days: number, projectName?: string): AiUsageTrendPoint[] {
    const filtered = projectName
      ? this.records.filter(r => r.projectName === projectName)
      : this.records;

    const trend: AiUsageTrendPoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRecords = filtered.filter(r => r.timestamp.slice(0, 10) === dateStr);
      trend.push({
        date: dateStr,
        totalCalls: dayRecords.length,
        successCount: dayRecords.filter(r => r.success).length,
      });
    }
    return trend;
  }

  /** 获取按服务类型分组的调用次数 */
  getByServiceType(projectName?: string): Record<AiServiceType, number> {
    const filtered = projectName
      ? this.records.filter(r => r.projectName === projectName)
      : this.records;

    const result: Record<AiServiceType, number> = {
      skill: 0, agent: 0, rag: 0, review: 0, chat: 0,
    };
    filtered.forEach(r => { result[r.serviceType]++; });
    return result;
  }

  /** 获取所有记录（供图表使用） */
  getAllRecords(): AiUsageRecord[] {
    return [...this.records];
  }

  /** 清空记录 */
  clear(): void {
    this.records = [];
    this.save();
  }
}

/** 全局单例 */
export const aiUsageTracker = new AiUsageTracker();
