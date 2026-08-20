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
import { Buffer } from 'buffer';
import { getDb } from '../db.js';
import { embedBatch } from './embeddingService.js';
import { chunk } from './chunker.js';

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

// 5.4 失败退避：第 1/2/3 次失败分别等待 30s/60s/120s
const BACKOFF_SECONDS = [30, 60, 120];
// 5.4 内存上限：单任务文本总量 >2MB 跳过（预留分批处理接口）
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
// 5.4 优雅退出：强制超时 15s（嵌入 30s 超时，不能无限等）
const SHUTDOWN_TIMEOUT_MS = 15000;

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
    // 5.4 优雅退出：跟踪当前正在处理的任务 id 集合
    this.inFlightTasks = new Set();
    // 5.4 优雅退出：强制超时定时器（用于 stop() 等待 in-flight 任务完成）
    this._stopChecker = null;
    this._stopResolve = null;  // waitForStop() 的 resolve 函数
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
    if (this.state === WorkerState.STOPPED || this.state === WorkerState.STOPPING) {
      return this._stopPromise || Promise.resolve();
    }
    this.state = WorkerState.STOPPING;
    // 埋点 2: Worker 停止
    const inFlight = this.inFlightTasks.size;
    logger.info(`Worker stopping, id=${this.workerId}, inFlightTasks=${inFlight}`);
    // 停止轮询新任务（当前 in-flight 任务继续处理）
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._statsTimer) { clearInterval(this._statsTimer); this._statsTimer = null; }
    // 优雅退出：等待 inFlightTasks 清空 或 15s 强制超时
    this._stopPromise = new Promise((resolve) => {
      this._stopResolve = resolve;
      const t0 = Date.now();
      this._stopChecker = setInterval(() => {
        const elapsed = Date.now() - t0;
        if (this.inFlightTasks.size === 0) {
          this._finishStop('graceful', elapsed);
          resolve();
        } else if (elapsed >= SHUTDOWN_TIMEOUT_MS) {
          // 强制超时：解锁本 worker 的所有 processing 任务
          this._forceReleaseInFlight();
          this._finishStop('forced', elapsed);
          resolve();
        } else {
          logger.debug(`Worker waiting for ${this.inFlightTasks.size} in-flight task(s), ${Math.round((SHUTDOWN_TIMEOUT_MS - elapsed) / 1000)}s left`);
        }
      }, 200);
    });
    return this._stopPromise;
  }

  _finishStop(reason, elapsedMs) {
    if (this._stopChecker) { clearInterval(this._stopChecker); this._stopChecker = null; }
    this.state = WorkerState.STOPPED;
    // 5.4: forced 退出后清空 inFlightTasks 和 _running（graceful 时已空/false，重置无害；forced 时防止内存泄漏和死锁）
    if (reason === 'forced') {
      this.inFlightTasks.clear();
      this._running = false;  // 释放 _pollOnce 重入锁，允许下次 start() 正常轮询
    }
    logger.info(`Worker stopped (${reason}) after ${Math.round(elapsedMs)}ms, id=${this.workerId}`);
    this._stopResolve = null;
  }

  _forceReleaseInFlight() {
    try {
      const db = getDb();
      const released = db.prepare(
        `UPDATE kb_sync_queue SET status='pending', locked_by=NULL, locked_at=NULL, next_run_at=datetime('now','+30 seconds') WHERE locked_by=? AND status='processing'`
      ).run(this.workerId);
      if (released.changes > 0) {
        logger.warn(`Force-released ${released.changes} in-flight task(s) back to pending (with 30s backoff)`);
      }
    } catch (err) {
      logger.error(`Failed to force-release in-flight tasks: ${err.message}`);
    }
  }

  // 5.4 等待 Worker 完全停止（用于测试和优雅关闭）
  async waitForStop() {
    if (this.state === WorkerState.STOPPED) return;
    return this._stopPromise || this.stop();
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
    // 5.5: 暴露 inFlightTasks 数量 + 退避中的任务数（供前端健康监控）
    let pendingBackoff = 0;
    try {
      pendingBackoff = db.prepare(
        `SELECT COUNT(*) as c FROM kb_sync_queue WHERE status='pending' AND next_run_at IS NOT NULL AND next_run_at > datetime('now')`
      ).get().c;
    } catch {}
    return {
      workerId: this.workerId,
      state: this.state,
      isRunning: this.state === WorkerState.RUNNING,
      uptime: this.stats.startedAt ? (Date.now() - new Date(this.stats.startedAt).getTime()) : 0,
      inFlightTasks: this.inFlightTasks.size,
      pendingBackoff,
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
      // 2. 拉取 pending 任务（5.4: 过滤未到退避时间的任务）
      const db = getDb();
      const tasks = db.prepare(
        `SELECT * FROM kb_sync_queue WHERE status='pending' AND (next_run_at IS NULL OR next_run_at <= datetime('now')) ORDER BY priority DESC, created_at ASC LIMIT ?`
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
    // 1. 领取任务（原子操作：仅 pending 可被锁定；5.4: 同时清空 next_run_at）
    const locked = db.prepare(
      `UPDATE kb_sync_queue SET status='processing', locked_by=?, locked_at=datetime('now'), next_run_at=NULL WHERE id=? AND status='pending'`
    ).run(this.workerId, task.id);
    if (locked.changes === 0) {
      // 埋点 7: 领取失败（被抢）
      logger.debug(`Task ${task.id} already locked by other worker`);
      return;
    }
    // 埋点 6: 领取任务
    logger.info(`Task locked: id=${task.id} source=${task.source} project=${task.project_name}`);
    // 5.4: 跟踪 in-flight 任务（用于优雅退出等待）
    this.inFlightTasks.add(task.id);

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
    } finally {
      // 5.4: 无论成功失败，从 in-flight 集合移除（保证优雅退出能感知）
      this.inFlightTasks.delete(task.id);
    }
  }

  // ★ 5.3 实际逻辑：拉取业务记录→文本化→分块→批量嵌入→入库 vector_embeddings
  async _processTask(task) {
    // 1. 拉取业务记录
    const record = this._fetchRecord(task);
    if (!record) {
      throw new Error(`业务记录不存在: ${task.source}/${task.record_id}`);
    }
    // 2. 文本化（daily 4 段拆块，issue/experience 单条）
    const segments = this._buildTextSegments(task, record);
    if (segments.length === 0) {
      logger.info(`Task ${task.id} 无可嵌入文本（空记录），跳过`);
      return;
    }
    // 5.4 内存上限：文本总量 >2MB 跳过（预留分批处理接口，TODO 后续迭代分批入库）
    const totalBytes = segments.reduce((sum, s) => sum + Buffer.byteLength(s.text, 'utf8'), 0);
    if (totalBytes > MAX_TEXT_BYTES) {
      logger.warn(`Task ${task.id} 文本 ${totalBytes} bytes 超 ${(MAX_TEXT_BYTES / 1024 / 1024).toFixed(1)}MB 上限，跳过（预留分批处理接口）`);
      this.stats.skipped = (this.stats.skipped || 0) + 1;
      return;
    }
    // 3. 分块（每段单独分块，保留段标识）
    const chunks = [];
    for (const seg of segments) {
      const subChunks = chunk(seg.text, { strategy: 'fixed', size: 500, overlap: 50 });
      for (let i = 0; i < subChunks.length; i++) {
        chunks.push({
          ...subChunks[i],
          segment: seg.segment,
          label: seg.label,
        });
      }
    }
    if (chunks.length === 0) {
      logger.info(`Task ${task.id} 分块后无内容，跳过`);
      return;
    }
    logger.info(`Task ${task.id}: ${segments.length} segment(s) → ${chunks.length} chunk(s)`);
    // 4. 批量嵌入
    const texts = chunks.map(c => c.text);
    const embeddings = await embedBatch(texts, 'document');
    // 5. 入库 vector_embeddings
    const stored = this._storeVectors(task, record, chunks, embeddings);
    logger.info(`Task ${task.id}: stored ${stored} vector(s)`);
    // 6. 内存释放（5.4 内存控制）
    chunks.length = 0;
    embeddings.length = 0;
  }

  // 拉取业务记录
  _fetchRecord(task) {
    const db = getDb();
    const rid = task.record_id;
    if (task.source === 'daily') {
      return db.prepare('SELECT * FROM daily_reports WHERE id=?').get(rid);
    }
    if (task.source === 'issue') {
      return db.prepare('SELECT * FROM mobile_issues WHERE id=?').get(rid);
    }
    if (task.source === 'experience') {
      return db.prepare('SELECT * FROM project_experiences WHERE id=?').get(rid);
    }
    if (task.source === 'document') {
      // 文档类暂不处理（5.3 阶段只处理业务记录）
      throw new Error(`source=document 暂未支持（待 5.7 检索 API 后扩展）`);
    }
    throw new Error(`Unknown source: ${task.source}`);
  }

  // 文本化（按业务类型分段）
  _buildTextSegments(task, record) {
    if (task.source === 'daily') {
      // 日报 4 段拆块：进度/质量风险/现场问题/备注+原文
      return [
        { segment: 1, label: '进度', text: record.tasks || '' },
        { segment: 2, label: '质量风险', text: record.quality_risks || '' },
        { segment: 3, label: '现场问题', text: record.issues || '' },
        { segment: 4, label: '备注+原文', text: [record.notes, record.original_text].filter(Boolean).join('\n') },
      ].filter(s => s.text && s.text.trim().length > 0);
    }
    if (task.source === 'issue') {
      const text = [
        record.title,
        `[严重度:${record.severity || '未知'}]`,
        record.description,
      ].filter(Boolean).join('\n');
      return text.trim() ? [{ segment: 1, label: '问题', text }] : [];
    }
    if (task.source === 'experience') {
      const text = [
        record.title,
        record.description,
        record.patterns ? `模式: ${record.patterns}` : '',
        record.metrics ? `指标: ${record.metrics}` : '',
      ].filter(Boolean).join('\n');
      return text.trim() ? [{ segment: 1, label: '经验', text }] : [];
    }
    return [];
  }

  // 入库 vector_embeddings
  _storeVectors(task, record, chunks, embeddings) {
    const db = getDb();
    const projectName = task.project_name;
    const docId = `${task.source}-${task.record_id}`;
    const docName = task.source === 'daily'
      ? `日报 ${record.report_date || task.record_id}`
      : task.source === 'issue'
        ? `问题 ${record.title || task.record_id}`
        : `经验 ${record.title || task.record_id}`;
    const sensitivity = record.sensitivity || 0;
    // 去重：删旧向量（同 project + doc_id）
    db.prepare('DELETE FROM vector_embeddings WHERE project=? AND doc_id=?').run(projectName, docId);
    // 5.9: 同步删除 FTS5 索引（同 doc_id 的 external_id）
    db.prepare('DELETE FROM vector_embeddings_fts WHERE external_id LIKE ?').run(`${docId}%`);
    // 批量 INSERT（事务）
    const insert = db.prepare(
      `INSERT INTO vector_embeddings (id, project, doc_id, doc_name, chunk_index, text, embedding, dimension, sensitivity, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // 5.9: 同步插入 FTS5 全文索引
    const insertFts = db.prepare(
      `INSERT INTO vector_embeddings_fts (text, external_id) VALUES (?, ?)`
    );
    const rows = [];
    const ftsRows = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const emb = embeddings[i];
      if (!emb) continue;
      const id = `${docId}-seg${c.segment}-chunk${c.index}`;
      const buf = Buffer.from(new Float32Array(emb).buffer);
      rows.push([
        id, projectName, docId, docName,
        i, c.text, buf, emb.length, sensitivity,
        JSON.stringify({
          source: task.source,
          recordId: task.record_id,
          segment: c.segment,
          label: c.label,
          chunkIndex: c.index,
          startChar: c.startChar,
          endChar: c.endChar,
        }),
      ]);
      ftsRows.push([c.text, id]);
    }
    const tx = db.transaction(() => {
      for (const r of rows) insert.run(...r);
      for (const f of ftsRows) insertFts.run(...f);
    });
    tx();
    return rows.length;
  }

  _markDone(task) {
    const db = getDb();
    db.prepare(
      `UPDATE kb_sync_queue SET status='done', processed_at=datetime('now'), error_msg=NULL, locked_by=NULL, locked_at=NULL, next_run_at=NULL WHERE id=?`
    ).run(task.id);
    this.stats.processed++;
  }

  _markRetry(task, err, durationMs) {
    const db = getDb();
    const newRetry = (task.retry_count || 0) + 1;
    const maxRetries = task.max_retries || 3;
    const errStr = String(err.message || err).slice(0, 500);
    if (newRetry >= maxRetries) {
      // 埋点 11: 终态失败
      db.prepare(
        `UPDATE kb_sync_queue SET status='failed', retry_count=?, error_msg=?, processed_at=datetime('now'), locked_by=NULL, locked_at=NULL, next_run_at=NULL WHERE id=?`
      ).run(newRetry, errStr, task.id);
      this.stats.failed++;
      logger.error(`Task ${task.id} permanently failed after ${durationMs}ms: ${err.message}`);
    } else {
      // 5.4: 失败退避 — 第 1/2/3 次分别等 30s/60s/120s（嵌入服务过载恢复需要时间）
      const backoffIdx = Math.min(newRetry - 1, BACKOFF_SECONDS.length - 1);
      const backoffSec = BACKOFF_SECONDS[backoffIdx];
      db.prepare(
        `UPDATE kb_sync_queue SET status='pending', retry_count=?, error_msg=?, locked_by=NULL, locked_at=NULL, next_run_at=datetime('now','+' || ? || ' seconds') WHERE id=?`
      ).run(newRetry, errStr, String(backoffSec), task.id);
      this.stats.retried++;
      // 埋点 10: 可重试失败
      logger.warn(`Task ${task.id} failed in ${durationMs}ms (retry ${newRetry}/${maxRetries}, backoff ${backoffSec}s): ${err.message}`);
    }
  }

  _recoverStale() {
    const db = getDb();
    const result = db.prepare(
      `UPDATE kb_sync_queue SET status='pending', locked_by=NULL, locked_at=NULL, next_run_at=NULL WHERE status='processing' AND locked_at < datetime('now', ?)`
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
