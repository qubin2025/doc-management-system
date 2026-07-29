/**
 * PM2 进程管理配置 v5.1
 * 安装: npm install -g pm2
 * 启动: pm2 start deploy/ecosystem.config.cjs
 * 开机自启: pm2 save && pm2 startup
 * 状态: pm2 status
 * 日志: pm2 logs doc-mgmt-backend
 */
module.exports = {
  apps: [{
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
  }],
};
