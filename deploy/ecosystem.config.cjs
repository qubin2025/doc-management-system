// PM2 进程管理配置
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
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/backend-error.log',
    out_file: './logs/backend-out.log',
    // 自动重启
    max_memory_restart: '500M',
    autorestart: true,
    watch: false,
  }],
};
