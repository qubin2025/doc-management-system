/**
 * 日志工具模块 v1.0
 *
 * 功能：
 *   - 按天切割日志文件（access-YYYY-MM-DD.log / error-YYYY-MM-DD.log）
 *   - access 日志：HTTP 请求日志（morgan stream）
 *   - error 日志：4xx/5xx 错误 + 应用异常
 *   - 同时输出到控制台（开发环境彩色，生产环境简洁）
 *   - 自动创建 logs 目录
 *
 * 用法：
 *   import { accessLogStream, errorLog, appLog } from './services/logger.js';
 *   app.use(morgan('combined', { stream: accessLogStream }));
 *   errorLog('message', { detail: '...' });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const isProduction = process.env.NODE_ENV === 'production';

// 确保 logs 目录存在
if (!fs.existsSync(LOG_DIR)) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

// 当前日期缓存（用于检测日期变更）
let currentDate = '';
let accessStream = null;
let errorStream = null;

/**
 * 获取当前日期字符串 YYYY-MM-DD
 */
function getDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 获取或创建指定类型的日志文件流（按天切割）
 * @param {'access'|'error'} type
 * @returns {fs.WriteStream}
 */
function getStream(type) {
  const dateStr = getDateStr();

  // 日期变更时关闭旧流
  if (dateStr !== currentDate) {
    if (accessStream) { try { accessStream.end(); } catch {} accessStream = null; }
    if (errorStream) { try { errorStream.end(); } catch {} errorStream = null; }
    currentDate = dateStr;
  }

  const stream = type === 'access' ? accessStream : errorStream;
  if (stream) return stream;

  const filePath = path.join(LOG_DIR, `${type}-${dateStr}.log`);
  const newStream = fs.createWriteStream(filePath, { flags: 'a' });
  newStream.on('error', (err) => {
    console.error(`[LOGGER] ${type} stream error:`, err.message);
  });

  if (type === 'access') accessStream = newStream;
  else errorStream = newStream;

  return newStream;
}

/**
 * morgan access 日志 stream
 * 用法: app.use(morgan('combined', { stream: accessLogStream }));
 */
export const accessLogStream = {
  write: (message) => {
    try {
      getStream('access').write(message);
    } catch (e) {
      // 降级到控制台
      if (!isProduction) console.error('[LOGGER] access write failed:', e.message);
    }
    // 生产环境同时输出到控制台（PM2捕获）
    if (!isProduction) process.stdout.write(message);
  },
};

/**
 * 写入错误日志
 * @param {string} message - 错误消息
 * @param {object} [meta] - 附加信息（method, path, statusCode, duration, stack等）
 */
export function errorLog(message, meta = {}) {
  const ts = new Date().toISOString();
  const parts = [`[${ts}]`];
  if (meta.method) parts.push(meta.method);
  if (meta.path) parts.push(meta.path);
  if (meta.statusCode) parts.push(`→ ${meta.statusCode}`);
  if (meta.duration != null) parts.push(`(${meta.duration}ms)`);
  parts.push(message);
  if (meta.detail) parts.push(`| ${meta.detail}`);
  if (meta.stack) parts.push(`\n${meta.stack}`);

  const line = parts.join(' ') + '\n';

  try {
    getStream('error').write(line);
  } catch (e) {
    if (!isProduction) console.error('[LOGGER] error write failed:', e.message);
  }

  // 同时输出到控制台
  if (meta.statusCode && meta.statusCode >= 500) {
    console.error(line.trimEnd());
  } else {
    console.warn(line.trimEnd());
  }
}

/**
 * 应用日志（info/warn/error/fatal）
 * 同时写入 error 日志文件和控制台
 */
export const appLog = {
  info: (message, detail = '') => {
    const ts = new Date().toISOString();
    const line = `[${ts}] INFO  ${message}${detail ? ' | ' + detail : ''}\n`;
    if (!isProduction) process.stdout.write(line);
  },
  warn: (message, detail = '') => {
    const ts = new Date().toISOString();
    const line = `[${ts}] WARN  ${message}${detail ? ' | ' + detail : ''}\n`;
    try { getStream('error').write(line); } catch {}
    console.warn(line.trimEnd());
  },
  error: (message, detail = '') => {
    const ts = new Date().toISOString();
    const line = `[${ts}] ERROR ${message}${detail ? ' | ' + detail : ''}\n`;
    try { getStream('error').write(line); } catch {}
    console.error(line.trimEnd());
  },
  fatal: (message, detail = '') => {
    const ts = new Date().toISOString();
    const line = `[${ts}] FATAL ${message}${detail ? ' | ' + detail : ''}\n`;
    try { getStream('error').write(line); } catch {}
    console.error(line.trimEnd());
  },
};

/**
 * 获取日志目录路径
 */
export function getLogDir() {
  return LOG_DIR;
}

/**
 * 优雅关闭（关闭所有文件流）
 */
export function closeLogger() {
  if (accessStream) { try { accessStream.end(); } catch {} accessStream = null; }
  if (errorStream) { try { errorStream.end(); } catch {} errorStream = null; }
}
