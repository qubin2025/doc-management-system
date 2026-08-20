/**
 * 迭代5 · 5.2 kbWorker.js 骨架
 *
 * 职责：队列轮询 + 任务分发 + 状态更新
 * 5.2 阶段：mock 处理（不做实际解析嵌入）
 * 5.3 阶段：填充 _processTask 的实际逻辑
 *
 * 状态流转：
 *   pending → processing → done / failed
 *   processing → pending（超时回收 5 分钟 / 重试 / Worker 停止）
 *
 * 任务保护（5.4 扩展）：
 *   - 任务锁（locked_by/locked_at 原子 UPDATE）
 *   - 超时回收（locked_at < datetime('now','-5 minutes') → 重置 pending）
 *   - 失败上限（retry_count >= max_retries → failed 终态）
 *   - 优雅退出（SIGTERM/SIGINT 完成当前任务再退出）
 *   - 内存控制（5.3 填充）
 *   - 批量嵌入 + 并发控制 + 超时（5.3 填充）
 */
import { getDb } from '../db.js';

// ========== 日志器 ==========
const LOG_PREFIX = '[kbWorker]';
const logger = {
  debug: (...args) => { if (process.env.KB_WORKER_DEBUG === '1') console.debug(LOG_PREFIX, new Date().toISOString(), ...args); },
  info:  (...args) => console.log(LOG_PREFIX, new Date().toISOString(), ...args),
  warn:  (...args) => console.warn(LOG_PREFIX, new Date().toISOString(), ...args),
  error: (...args) => console.error(LOG_PREFIX, new Date().toISOString(), ...args),
};

// ========== Worker 状态枚举 ==========
const WorkerState = Object.freeze({
  STOPPED: 'stopped',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
});

// ========== KbWorker 类 ==========
class KbWorker {
  constructor(config = {}) {
    this.workerId = `kbw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.state = WorkerState.STOPPED;
    this.pollInterval = config.pollInterval || 2000;        // 轮询间隔 2s
    this.batchSize = Math.min(config.batchSize || 5, 20);   // 每轮拉取任务数
    this.staleMinutes = config.staleMinutes || 5;           // 超时阈值 5min
    this.maxConcurrent = config.maxConcurrent || 3;         // 并发上限（5.4 扩展）
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      recovered: 0,
      cycles: 0,
      lastError: null,
      startedAt: null,
      lastCycleAt: null,
    };
    this._timer = null;
    this._statsTimer = null;
    this._running = false;  // 防止 _pollOnce 重入
  }

  // ========== 公开 API ==========
  start() {
    if (this.state === WorkerState.RUNNING) return;
    this.state = WorkerState.RUNNING;
    this.stats.startedAt = new Date().toISOString();
    // 埋点 1: Worker 启动
    logger.info(`Worker started, id=${this.workerId}, pollInterval=${this.pollInterval}ms, batchSize=${this.batchSize}`);
    // 注册 SIGTERM/SIGINT 优雅退出
    process.once('SIGTERM', () => this.stop());
    process.once('SIGINT', () => this.stop());
    // 启动主循环
    this._schedulePoll(0);
    // 周期统计（埋点 14: 每 60s）
    this._statsTimer = setInterval(() => this._logStats(), 60000);
  }

  stop() {
    if (this.state === WorkerState.STOPPED || this.state === WorkerState.STOPPING) return;
    this.state = WorkerState.STOPPING;
    // 埋点 2: Worker 停止
    logger.info(`Worker stopping, id=${this.workerId}, releasing current tasks`);
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._statsTimer) { clearInterval(this._statsTimer); this._statsTimer = null; }
    // 退回当前 processing 任务（属本 Worker 锁定的）
    try {
      const db = getDb();
      const released = db.prepare(
        `UPDATE kb_sync_queue SET status='pending', locked_by=NULL, locked_at=NULL WHERE locked_by=? AND status='processing'`
      ).run(this.workerId);
      if (released.changes > 0) {
        logger.info(`Released ${released.changes} in-flight task(s) back to pending`);
      }
    } catch (err) {
      logger.error(`Failed to release in-flight tasks: ${err.message}`);
    }
    this.state = WorkerState.STOPPED;
    // 埋点 3: Worker 已停止
    logger.info(`Worker stopped, id=${this.workerId}`);
  }

  pause() {
    if (this.state !== WorkerState.RUNNING) return;
    this.state = WorkerState.PAUSED;
    logger.info(`Worker paused, id=${this.workerId}`);
  }

  resume() {
    if (this.state !== WorkerState.PAUSED) return;
    this.state = WorkerState.RUNNING;
    logger.info(`Worker resumed, id=${this.workerId}`);
    this._schedulePoll(0);
  }

  getStats() {
    const db = getDb();
    let queue = {};
    try {
      queue = db.prepare(`SELECT status, COUNT(*) as cnt FROM kb_sync_queue GROUP BY status`).all()
        .reduce((acc, r) => { acc[r.status] = r.cnt; return acc; }, {});
    } catch {}
    return {
      workerId: this.workerId,
      state: this.state,
      uptime: this.stats.startedAt ? (Date.now() - new Date(this.stats.startedAt).getTime()) : 0,
      stats: this.stats,
      queue,
    };
  }

  // ========== 内部方法 ==========
  _schedulePoll(delay) {
    if (this.state !== WorkerState.RUNNING) return;
    this._timer = setTimeout(async () => {
      await this._pollOnce();
      this._schedulePoll(this.pollInterval);
    }, delay);
  }

  async _pollOnce() {
    // 防重入
    if (this._running) return;
    if (this.state !== WorkerState.RUNNING) return;
    this._running = true;
    this.stats.cycles++;
    this.stats.lastCycleAt = new Date().toISOString();
    try {
      // 1. 超时回收（埋点 12）
      this._recoverStale();
      // 2. 拉取 pending 任务
      const db = getDb();
      const tasks = db.prepare(
        `SELECT * FROM kb_sync_queue WHERE status='pending' ORDER BY priority DESC, created_at ASC LIMIT ?`
      ).all(this.batchSize);
      if (tasks.length === 0) {
        // 埋点 5: 无任务
        logger.debug(`No pending tasks, sleeping ${this.pollInterval}ms`);
        return;
      }
      // 埋点 4: 轮询开始
      logger.debug(`Picked ${tasks.length} pending task(s)`);
      // 3. 逐个处理
      for (const task of tasks) {
        if (this.state !== WorkerState.RUNNING) break;
        await this._processOne(task);
      }
    } catch (err) {
      // 埋点 13: 异常捕获
      logger.error(`Unexpected error in poll cycle: ${err.message}`);
      this.stats.lastError = err.message;
    } finally {
      this._running = false;
    }
  }

  async _processOne(task) {
    const db = getDb();
    // 1. 领取任务（原子操作：仅 pending 可被锁定）
    const locked = db.prepare(
      `UPDATE kb_sync_queue SET status='processing', locked_by=?, locked_at=datetime('now') WHERE id=? AND status='pending'`
    ).run(this.workerId, task.id);
    if (locked.changes === 0) {
      // 埋点 7: 领取失败（被抢）
      logger.debug(`Task ${task.id} already locked by other worker`);
      return;
    }
    // 埋点 6: 领取任务
    logger.info(`Task locked: id=${task.id} source=${task.source} project=${task.project_name}`);

    // 2. 处理任务
    const t0 = Date.now();
    try {
      // 埋点 8: 处理开始
      logger.info(`Processing task ${task.id}: ${task.source}/${task.record_id}`);
      await this._processTask(task);
      const durationMs = Date.now() - t0;
      // 埋点 9: 处理成功
      logger.info(`Task ${task.id} done in ${durationMs}ms`);
      this._markDone(task);
    } catch (err) {
      const durationMs = Date.now() - t0;
      this._markRetry(task, err, durationMs);
    }
  }

  // ★★★ 5.3 填充点 ★★★
  // 5.2 阶段：mock 处理（仅打日志+模拟耗时）
  // 5.3 阶段：调用 docParser + chunker + embeddingService + vectorStore
  async _processTask(task) {
    // --- 5.2 mock ---
    logger.info(`[MOCK] Processing task ${task.id}: source=${task.source} record=${task.record_id} action=${task.action}`);
    // 模拟处理耗时
    await new Promise(r => setTimeout(r, 100));
    // --- 5.3 实际逻辑（占位，待填充） ---
    // const record = this._fetchRecord(task);
    // const chunks = chunker.chunk(record.text, { strategy: 'fixed', size: 500 });
    // const embeddings = await embeddingService.embedBatch(chunks);
    // this._storeVectors(task, chunks, embeddings);
  }

  _markDone(task) {
    const db = getDb();
    db.prepare(
      `UPDATE kb_sync_queue SET status='done', processed_at=datetime('now'), error_msg=NULL, locked_by=NULL, locked_at=NULL WHERE id=?`
    ).run(task.id);
    this.stats.processed++;
  }

  _markRetry(task, err, durationMs) {
    const db = getDb();
    const newRetry = (task.retry_count || 0) + 1;
    const maxRetries = task.max_retries || 3;
    if (newRetry >= maxRetries) {
      // 埋点 11: 终态失败
      db.prepare(
        `UPDATE kb_sync_queue SET status='failed', retry_count=?, error_msg=?, processed_at=datetime('now'), locked_by=NULL, locked_at=NULL WHERE id=?`
      ).run(newRetry, String(err.message || err).slice(0, 500), task.id);
      this.stats.failed++;
      logger.error(`Task ${task.id} permanently failed after ${durationMs}ms: ${err.message}`);
    } else {
      // 埋点 10: 可重试失败
      db.prepare(
        `UPDATE kb_sync_queue SET status='pending', retry_count=?, error_msg=?, locked_by=NULL, locked_at=NULL WHERE id=?`
      ).run(newRetry, String(err.message || err).slice(0, 500), task.id);
      this.stats.retried++;
      logger.warn(`Task ${task.id} failed in ${durationMs}ms (retry ${newRetry}/${maxRetries}): ${err.message}`);
    }
  }

  _recoverStale() {
    const db = getDb();
    const result = db.prepare(
      `UPDATE kb_sync_queue SET status='pending', locked_by=NULL, locked_at=NULL WHERE status='processing' AND locked_at < datetime('now', ?)`
    ).run(`-${this.staleMinutes} minutes`);
    if (result.changes > 0) {
      this.stats.recovered += result.changes;
      logger.warn(`Recovered ${result.changes} stale task(s) (locked > ${this.staleMinutes}min)`);
    }
    return result.changes;
  }

  _logStats() {
    // 埋点 14: 周期统计
    logger.info(`Stats: cycles=${this.stats.cycles} processed=${this.stats.processed} retried=${this.stats.retried} failed=${this.stats.failed} recovered=${this.stats.recovered}`);
  }
}

// ========== 单例导出 ==========
export const kbWorker = new KbWorker();
export default kbWorker;
