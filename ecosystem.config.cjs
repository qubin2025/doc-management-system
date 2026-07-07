module.exports = {
  apps: [{
    name: 'doc-mgmt-api',
    script: 'backend/server.js',
    env: { NODE_ENV: 'production', PORT: 3000 },
    instances: 1,
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/api-error.log',
    out_file: 'logs/api-out.log',
    merge_logs: true,
  }],
};
