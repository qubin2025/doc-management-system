#!/bin/bash
# 全过程工程咨询管理系统 — 一键部署脚本
# 用法: bash deploy/deploy.sh

set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
echo "========================================="
echo " 全过程工程咨询管理系统 — 部署脚本"
echo " 项目路径: $ROOT"
echo "========================================="

# 1. 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "[错误] 请先安装 Node.js 18+"
  exit 1
fi
echo "[1/5] Node.js $(node -v) ✓"

# 2. 安装后端依赖
cd "$ROOT/backend"
if [ ! -d node_modules ]; then
  echo "[2/5] 安装后端依赖..."
  npm install --production
else
  echo "[2/5] 后端依赖已安装 ✓"
fi

# 3. 检查 .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "[!] 未找到 backend/.env，请从 .env.example 复制并填入API Keys"
    cp .env.example .env
    echo "    已创建 .env 模板，请编辑后重新运行"
    exit 1
  fi
fi
echo "[3/5] 环境配置 ✓"

# 4. 构建前端
cd "$ROOT"
echo "[4/5] 构建前端..."
npm install
npm run build
echo "    前端构建完成 → dist/"

# 5. 启动/重启后端
cd "$ROOT"
if command -v pm2 &>/dev/null; then
  pm2 start deploy/ecosystem.config.cjs || pm2 restart doc-mgmt-backend
  pm2 save
  echo "[5/5] PM2 已启动 ✓"
else
  echo "[5/5] PM2 未安装，使用 node 直接启动 (不推荐生产)"
  echo "    安装 PM2: npm install -g pm2"
  cd backend && node server.js &
fi

echo ""
echo "========================================="
echo " 部署完成！"
echo " 后端: http://localhost:3000/api"
echo " 前端: 配置 Nginx 指向 $ROOT/dist/"
echo " Nginx 配置模板: deploy/nginx.conf"
echo "========================================="
