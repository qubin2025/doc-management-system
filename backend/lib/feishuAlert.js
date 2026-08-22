/**
 * 飞书 Webhook 告警工具 (通用版)
 *
 * 用于 cleanup-daily-uploads.js / backup-db.js / cleanup-sessions.js
 * 等定时任务发送执行结果通知
 *
 * 环境变量:
 *   FEISHU_WEBHOOK_URL      - 飞书机器人 webhook URL
 *   FEISHU_ALERT_LEVEL      - 告警级别: error(默认)/always/never
 *   ALERT_HOSTNAME          - 显示主机名 (默认 os.hostname)
 *
 * 使用方式:
 *   import { shouldAlert, sendFeishuAlert, ALERT_HOSTNAME } from '../lib/feishuAlert.js';
 *   const summary = { taskName, hostname, status, exitCode, metrics: {...}, errorDetails: [...] };
 *   if (shouldAlert(summary.status, summary.exitCode)) {
 *     await sendFeishuAlert(summary, (msg, lvl) => console.log(msg));
 *   }
 */

import os from 'os';

export const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';
export const FEISHU_ALERT_LEVEL = process.env.FEISHU_ALERT_LEVEL || 'error';
export const ALERT_HOSTNAME = process.env.ALERT_HOSTNAME || os.hostname();

export function shouldAlert(status, exitCode) {
  if (!FEISHU_WEBHOOK_URL) return false;
  if (FEISHU_ALERT_LEVEL === 'never') return false;
  if (FEISHU_ALERT_LEVEL === 'always') return true;
  return exitCode !== 0;
}

function buildMetricLines(metrics) {
  if (!metrics || typeof metrics !== 'object') return '_无统计_';
  return Object.entries(metrics)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join('\n');
}

export async function sendFeishuAlert(payload, logFn = () => {}) {
  if (!FEISHU_WEBHOOK_URL) return false;

  const color = payload.status === 'success' ? 'green' : 'red';
  const emoji = payload.status === 'success' ? '✅' : '🔴';

  const metricLines = buildMetricLines(payload.metrics);

  const errorBlock = (payload.errorDetails && payload.errorDetails.length > 0)
    ? {
        tag: 'div',
        text: { tag: 'lark_md', content:
          `**错误详情**:\n` + payload.errorDetails.slice(0, 10)
            .map(e => `• ${e.name}: ${e.reason}`).join('\n') },
      }
    : { tag: 'div', text: { tag: 'lark_md', content: '_无错误_' } };

  const content = {
    msg_type: 'interactive',
    card: {
      header: {
        template: color,
        title: { tag: 'plain_text', content: `${emoji} ${payload.taskName || '定时任务'} - ${payload.status.toUpperCase()}` },
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content:
            `**主机**: ${payload.hostname}\n` +
            `**时间**: ${payload.finishedAt}\n` +
            `**耗时**: ${payload.elapsed}\n` +
            `**退出码**: ${payload.exitCode}` },
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `**执行统计**:\n${metricLines}` },
        },
        errorBlock,
        { tag: 'hr' },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: payload.note || 'PM2 自动触发' }],
        },
      ],
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      logFn(`feishu webhook HTTP ${resp.status}`, 'error');
      return false;
    }
    const data = await resp.json();
    if (data.code !== 0 && data.code !== undefined) {
      logFn(`feishu api error: ${data.msg || 'unknown'}`, 'error');
      return false;
    }
    logFn(`feishu notification sent (status=${payload.status})`);
    return true;
  } catch (e) {
    logFn(`feishu webhook failed: ${e.message}`, 'error');
    return false;
  }
}
