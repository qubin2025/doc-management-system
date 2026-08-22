/**
 * PM2 进程管理配置 v5.5
 * 安装: npm install -g pm2
 * 启动: pm2 start deploy/ecosystem.config.cjs
 * 开机自启: pm2 save && pm2 startup
 * 状态: pm2 status
 * 日志: pm2 logs doc-mgmt-backend
 *       pm2 logs cleanup-daily-uploads
 *
 * 应用列表:
 *   - doc-mgmt-backend    : 主服务 (常驻)
 *   - cleanup-daily       : 日报临时文件清理 (每天 04:00 触发)
 *   - cleanup-sessions    : 过期会话清理 (每天 03:00 触发)
 *   - backup-db           : 数据库+文件备份 (每天 02:00 触发)
 */
module.exports = {
  apps: [
    {
      name: 'doc-mgmt-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_PATH: './data/planning.db',
        FILES_PATH: './files',
      },
      // 日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      // 自动重启
      max_memory_restart: '500M',
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
      kill_timeout: 10000,
      watch: false,
    },
    {
      name: 'cleanup-daily-uploads',
      cwd: './backend',
      script: 'scripts/cleanup-daily-uploads.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,        // 一次性脚本，禁用自动重启
      cron: '0 4 * * *',          // 每天 04:00 执行
      env: {
        NODE_ENV: 'production',
        FILES_PATH: './files',
        KEEP_DAYS: 7,
        // DRY_RUN: '1',                    // 预演模式开关（默认关闭）
        // 飞书告警 (可选 - 在群机器人添加自定义机器人获取 webhook URL)
        FEISHU_WEBHOOK_URL: '',             // 例如: https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx
        FEISHU_ALERT_LEVEL: 'error',        // error(仅失败告警) | always(每次都告警) | never
        ALERT_HOSTNAME: '',                 // 留空则使用 os.hostname()
      },
      // 日志（独立文件，便于排查）
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/cleanup-daily-error.log',
      out_file: './logs/cleanup-daily-out.log',
      merge_logs: true,
      max_restarts: 0,
      kill_timeout: 30000,
      watch: false,
    },
    {
      name: 'cleanup-sessions',
      cwd: './backend',
      script: 'scripts/cleanup-sessions.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,
      cron: '0 3 * * *',          // 每天 03:00 执行
      env: {
        NODE_ENV: 'production',
        DB_PATH: './data/planning.db',
        // 飞书告警 (可选 - 与 cleanup-daily-uploads 共用同一个 webhook)
        FEISHU_WEBHOOK_URL: '',             // 留空则跳过告警
        FEISHU_ALERT_LEVEL: 'error',
        ALERT_HOSTNAME: '',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/cleanup-sessions-error.log',
      out_file: './logs/cleanup-sessions-out.log',
      merge_logs: true,
      max_restarts: 0,
      kill_timeout: 10000,
      watch: false,
    },
    {
      name: 'backup-db',
      cwd: './backend',
      script: 'scripts/backup-db.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,
      cron: '0 2 * * *',          // 每天 02:00 执行
      env: {
        NODE_ENV: 'production',
        DB_PATH: './data/planning.db',
        FILES_PATH: './files',
        BACKUP_DIR: './backups',
        BACKUP_KEEP_DAYS: '30',
        // 飞书告警 (可选 - 与 cleanup-daily-uploads 共用同一个 webhook)
        FEISHU_WEBHOOK_URL: '',             // 留空则跳过告警
        FEISHU_ALERT_LEVEL: 'error',
        ALERT_HOSTNAME: '',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/backup-db-error.log',
      out_file: './logs/backup-db-out.log',
      merge_logs: true,
      max_restarts: 0,
      kill_timeout: 120000,        // 备份可能较慢
      watch: false,
    },
  ],
};
