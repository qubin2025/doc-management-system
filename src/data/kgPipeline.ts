/**
 * 知识图谱自动构建管道
 * P1-5: 事件驱动自动触发图谱重建，消除手动触发需求
 */

import { buildGraph } from './knowledgeGraph';

class KGPipeline {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBuildAt: string | null = null;
  private totalBuilds = 0;
  private readonly DEBOUNCE_MS = 5000; // 5秒防抖

  start(): void {
    console.log('[KGPipeline] Started — auto rebuild enabled');
  }

  stop(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    console.log('[KGPipeline] Stopped');
  }

  /** 文档上传/删除触发 */
  onDocumentChange(): void {
    this.scheduleRebuild('document-change');
  }

  /** 工作项完成状态变更触发 */
  onWorkItemChange(): void {
    this.scheduleRebuild('workitem-change');
  }

  /** 表单填写触发 */
  onFormChange(): void {
    this.scheduleRebuild('form-change');
  }

  /** 项目创建触发 */
  onProjectChange(): void {
    this.scheduleRebuild('project-change');
  }

  /** 目标变更触发 */
  onObjectiveChange(): void {
    this.scheduleRebuild('objective-change');
  }

  private scheduleRebuild(source: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      console.log(`[KGPipeline] Rebuilding graph (trigger: ${source})`);
      try {
        buildGraph();
        this.lastBuildAt = new Date().toISOString();
        this.totalBuilds++;
      } catch (e: any) {
        console.warn('[KGPipeline] Build failed:', e.message);
      }
    }, this.DEBOUNCE_MS);
  }

  getStats() {
    return { lastBuildAt: this.lastBuildAt, totalBuilds: this.totalBuilds };
  }
}

export const kgPipeline = new KGPipeline();
