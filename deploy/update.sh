#!/bin/bash
# 全过程工程咨询管理系统 — 一键更新脚本
# 用法: bash deploy/update.sh
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
echo "========================================="
echo "  工程咨询管理系统 — 版本更新"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

cd "$ROOT"

# 1. 拉取最新代码
echo "[1/4] git pull..."
git pull 2>&1 | tail -3
echo "  ✓"

# 2. 安装依赖
echo "[2/4] npm install..."
npm install --silent 2>/dev/null
cd backend && npm install --silent 2>/dev/null && cd ..
echo "  ✓"

# 3. 构建前端
echo "[3/4] npm run build..."
npm run build 2>&1 | tail -1
echo "  ✓"

# 4. 重启后端
echo "[4/4] restart..."
if command -v pm2 &>/dev/null; then
  pm2 restart doc-mgmt-backend 2>/dev/null && echo "  PM2 已重启 ✓"
else
  echo "  PM2 未安装，请手动重启后端"
fi

# 5. 健康检查
sleep 2
echo ""
echo "健康检查:"
curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/health 2>/dev/null || echo "(后端未响应)"
echo ""
echo "========================================="
echo " 更新完成！版本: $(curl -s http://localhost:3000/api/admin/system 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo 'N/A')"
echo "========================================="
