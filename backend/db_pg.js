/**
 * PostgreSQL 适配器 — 环境变量 DB_TYPE=postgres 启用
 * 与 db.js 并列，提供统一的 getDbAsync() 异步接口
 * 用法: import { getDbAsync } from './db_pg.js'
 */

import pg from 'pg';

const { Pool } = pg;

let pool = null;

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'doc_mgmt',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  max: parseInt(process.env.PG_POOL_MAX || '10'),
  idleTimeoutMillis: 30000,
};

/** 获取PG连接池 */
export function getPgPool() {
  if (!pool) {
    pool = new Pool(PG_CONFIG);
    console.log(`[DB] PostgreSQL connected: ${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}`);
  }
  return pool;
}

/** 异步查询 — 兼容 better-sqlite3 的 prepare().all()/.get()/.run() 模式 */
export async function queryAll(sql, params = []) {
  const result = await getPgPool().query(sql, params);
  return result.rows;
}

export async function queryOne(sql, params = []) {
  const result = await getPgPool().query(sql, params);
  return result.rows[0] || null;
}

export async function queryRun(sql, params = []) {
  const result = await getPgPool().query(sql, params);
  return { changes: result.rowCount, lastInsertRowid: result.rows?.[0]?.id };
}

/** 事务执行 */
export async function transaction(fn) {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      all: (sql, params) => client.query(sql, params).then(r => r.rows),
      get: (sql, params) => client.query(sql, params).then(r => r.rows[0] || null),
      run: (sql, params) => client.query(sql, params).then(r => ({ changes: r.rowCount })),
    });
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 关闭连接池 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] PostgreSQL pool closed');
  }
}

/** 检查PG是否可用 */
export async function isPgAvailable() {
  try {
    await getPgPool().query('SELECT 1');
    return true;
  } catch { return false; }
}

export default { getPgPool, queryAll, queryOne, queryRun, transaction, closePool, isPgAvailable };
