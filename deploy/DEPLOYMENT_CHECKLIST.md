# 部署上线检查清单

## 部署前必做

- [x] 安全审计 — 全部API端点认证覆盖 ✅
- [x] 限流配置 — 生产100/min ✅
- [x] 安全头增强 — HSTS/Referrer-Policy ✅
- [x] 数据清理脚本 — clean-test-data.js ✅
- [x] CI/CD Pipeline — GitHub Actions ci.yml ✅
- [ ] **HTTPS证书** — 修改 deploy/nginx-ssl.conf 中的域名，部署SSL证书
- [ ] **JWT密钥** — 修改 .env.production 中 JWT_SECRET 为随机字符串
- [ ] **API Key** — 配置真实的 AI 模型 API Key
- [ ] **管理员密码** — 首次部署后立即修改默认密码 admin123
- [ ] **cron备份** — 执行 `crontab deploy/crontab.txt`
- [ ] **日志轮转** — 执行 `sudo cp deploy/logrotate.conf /etc/logrotate.d/doc-mgmt`
- [ ] **数据库备份** — 首次运行 `bash scripts/backup.sh`

## 部署步骤

1. 克隆代码: `git clone <repo> && cd doc-management-system`
2. 安装依赖: `npm ci && cd backend && npm ci && cd ..`
3. 构建前端: `npm run build`
4. 配置环境: 编辑 `.env.production` 填写真实API Key/JWT密钥
5. 配置Nginx: `sudo cp deploy/nginx-ssl.conf /etc/nginx/sites-available/doc-mgmt`
6. SSL证书: 使用 Let's Encrypt: `certbot --nginx -d your-domain.com`
7. 启动服务: `pm2 start deploy/ecosystem.config.cjs`
8. 设置备份: `crontab deploy/crontab.txt`
9. 设置日志: `sudo cp deploy/logrotate.conf /etc/logrotate.d/doc-mgmt`
10. 验证: `curl https://your-domain.com/api` 返回 `{"status":"ok"}`

## 性能基线

- 首页加载 < 3s (首次), < 1s (缓存)
- API响应 < 200ms (本地SQLite)
- 支持并发用户: 5-10 (SQLite), 50+ (PostgreSQL)
- 数据库大小: 预计 10-50MB/年

## 浏览器兼容

| 浏览器 | 版本 | 状态 |
|--------|------|------|
| Chrome | 90+ | ✅ 完全支持 |
| Edge | 90+ | ✅ 完全支持 |
| Firefox | 88+ | ✅ 完全支持 |
| Safari | 15+ | ✅ 基本支持 |
| IE11 | — | ❌ 不支持 |

## 备份策略

- 数据库: 每天凌晨2点自动备份，保留30天
- 文件存储: 每天备份，保留7天
- 手动全量: `node scripts/clean-test-data.js` (清理) / `curl /api/backup/all` (下载)
