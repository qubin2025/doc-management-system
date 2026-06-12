# 全过程工程咨询管理系统 — 部署指南

## 前置要求

- Node.js 18+
- 端口 3000（后端API）、8080（前端静态）未被占用

## 本机部署（Windows）

### 1. 配置 API Keys

编辑 `backend\.env`，填入实际的 API Keys：
```
DEEPSEEK_API_KEY=sk-your-key
ZHIPU_API_KEY=your-key
QWEN_API_KEY=your-key
```

### 2. 一键启动

双击 `deploy\start.bat`

或手动执行：
```cmd
cd backend && node server.js          # 后端 (3000)
npx serve dist -l 8080               # 前端 (8080)
```

### 3. 访问

- 本机: http://localhost:8080
- 局域网: http://你的IP:8080
- 默认账号: `admin` / 首次启动后请查看部署说明

### 4. 停止服务

关闭两个命令行窗口即可。

---

## 服务器部署（Linux）

### 1. 安装 Node.js + Nginx + PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

### 2. 部署
```bash
cd /opt/doc-mgmt
bash deploy/deploy.sh
```

### 3. Nginx 配置
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/doc-mgmt
# 编辑替换 {DOMAIN} 和 {ROOT}
sudo ln -s /etc/nginx/sites-available/doc-mgmt /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. HTTPS (可选)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 生产构建

```bash
npm run build        # 输出到 dist/
```

关闭演示登录：`.env.production` 中设置 `VITE_DISABLE_DEMO=true`

## 默认账号

| 用户名 | 密码 | 角色 |
|---|---|---|
| admin | 首次部署请自行设置 | 管理员 (全部权限) |
| user1 | 首次部署请自行设置 | 施工负责人 |
| user2 | 首次部署请自行设置 | 监理工程师 |
| user3~user8 | 首次部署请自行设置 | 建设单位/资料员等 |

## 修改密码

```bash
cd backend
node -e "
const bcrypt = require('bcrypt');
const db = require('./db.js').getDb();
db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(
  bcrypt.hashSync('newpassword', 10), 'admin'
);
"
```
