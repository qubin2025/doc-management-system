#!/bin/bash
# ============================================================================
# PM2 定时任务部署脚本 (v1.0)
#
# 一键完成: 备份现有配置 → 停止旧应用 → 加载新配置 → 启动 PM2 → 验证
#
# 用法:
#   bash deploy/deploy-cron.sh                 # 标准部署
#   bash deploy/deploy-cron.sh --dry-run       # 预演模式（不实际部署）
#   bash deploy/deploy-cron.sh --force         # 强制覆盖（跳过确认提示）
#
# 前置条件:
#   - Node.js 18+
#   - PM2 已全局安装 (npm install -g pm2)
#   - 项目代码已部署到目标目录
#
# 部署的应用:
#   - doc-mgmt-backend       (常驻服务)
#   - cleanup-daily-uploads  (cron 0 4 * * *)
#   - cleanup-sessions       (cron 0 3 * * *)
#   - backup-db              (cron 0 2 * * *)
# ============================================================================
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BACKEND="$ROOT/backend"
DEPLOY="$ROOT/deploy"
LOG_DIR="$BACKEND/logs"
ECOSYSTEM="$DEPLOY/ecosystem.config.cjs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$ROOT/deploy/backup-$TIMESTAMP"

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] !${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*" >&2; }
step() { echo -e "\n${BLUE}=== $* ===${NC}"; }

DRY_RUN=false
FORCE=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    *) err "未知参数: $arg"; exit 1 ;;
  esac
done

if $DRY_RUN; then
  warn "DRY-RUN 模式：不会实际修改任何配置"
fi

echo "========================================="
echo " PM2 定时任务部署脚本 v1.0"
echo " 项目路径: $ROOT"
echo " 时间戳:   $TIMESTAMP"
echo " 模式:     $([ "$DRY_RUN" = true ] && echo 'DRY-RUN' || echo 'DEPLOY')"
echo "========================================="

# ============================================================================
# 步骤 1: 环境检查
# ============================================================================
step "1/6 环境检查"

# 1.1 Node.js
if ! command -v node &>/dev/null; then
  err "Node.js 未安装，请先安装 Node.js 18+"
  exit 1
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js 版本过低 ($(node -v))，需要 18+"
  exit 1
fi
log "Node.js: $(node -v) ✓"

# 1.2 PM2
if ! command -v pm2 &>/dev/null; then
  err "PM2 未安装，请运行: npm install -g pm2"
  exit 1
fi
log "PM2: $(pm2 --version) ✓"

# 1.3 项目文件
for f in "$ECOSYSTEM" "$BACKEND/scripts/cleanup-daily-uploads.js" \
         "$BACKEND/lib/feishuAlert.js" \
         "$BACKEND/scripts/cleanup-sessions.js" \
         "$BACKEND/scripts/backup-db.js"; do
  if [ ! -f "$f" ]; then
    err "缺少必要文件: $f"
    exit 1
  fi
done
log "项目文件完整性 ✓"

# 1.4 ecosystem 配置语法
if ! node -e "require('$ECOSYSTEM')" 2>/dev/null; then
  err "ecosystem.config.cjs 语法错误"
  exit 1
fi
log "ecosystem 配置语法 ✓"

# 1.5 确认提示（除非 --force）
if ! $FORCE && ! $DRY_RUN; then
  echo ""
  warn "即将执行以下操作:"
  echo "  1. 备份当前 PM2 配置到 $BACKUP_DIR"
  echo "  2. 删除现有 4 个应用 (若存在)"
  echo "  3. 加载新的 ecosystem.config.cjs"
  echo "  4. 启动 PM2 并保存进程列表"
  echo ""
  read -r -p "确认继续? [y/N] " yn
  case "$yn" in
    [Yy]*) ;;
    *) echo "已取消"; exit 0 ;;
  esac
fi

# ============================================================================
# 步骤 2: 备份现有配置
# ============================================================================
step "2/6 备份现有配置"

if [ ! -d "$BACKUP_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
fi

# 2.1 备份 PM2 dump
if [ -f ~/.pm2/dump.pm2 ]; then
  cp ~/.pm2/dump.pm2 "$BACKUP_DIR/dump.pm2.bak"
  log "PM2 dump 备份 ✓"
else
  warn "未找到 ~/.pm2/dump.pm2 (首次部署)"
fi

# 2.2 备份 ecosystem.config.cjs
if [ -f "$ECOSYSTEM" ]; then
  cp "$ECOSYSTEM" "$BACKUP_DIR/ecosystem.config.cjs.bak"
  log "ecosystem 配置备份 ✓"
fi

# 2.3 导出当前 PM2 状态
if ! $DRY_RUN; then
  pm2 jlist > "$BACKUP_DIR/pm2-list.json" 2>/dev/null || true
  log "PM2 当前状态已记录"
fi

# 2.4 备份日志（如果存在）
if [ -d "$LOG_DIR" ]; then
  for f in cleanup-daily-out.log cleanup-daily-error.log \
           cleanup-sessions-out.log cleanup-sessions-error.log \
           backup-db-out.log backup-db-error.log \
           backend-out.log backend-error.log; do
    [ -f "$LOG_DIR/$f" ] && cp "$LOG_DIR/$f" "$BACKUP_DIR/" || true
  done
  log "日志文件备份 ✓"
fi

echo "  备份目录: $BACKUP_DIR"

# ============================================================================
# 步骤 3: 创建必要目录
# ============================================================================
step "3/6 创建必要目录"

mkdir -p "$LOG_DIR"
mkdir -p "$BACKEND/data"
mkdir -p "$BACKEND/files/daily-uploads"
mkdir -p "$BACKEND/backups"
log "目录就绪 ✓"
echo "  日志目录:   $LOG_DIR"
echo "  数据库目录: $BACKEND/data"
echo "  上传目录:   $BACKEND/files/daily-uploads"
echo "  备份目录:   $BACKEND/backups"

if $DRY_RUN; then
  warn "DRY-RUN 模式，跳过后续实际部署步骤"
  echo ""
  log "预演完成。如需实际部署，请去掉 --dry-run 参数重新运行"
  exit 0
fi

# ============================================================================
# 步骤 4: 停止并删除旧应用
# ============================================================================
step "4/6 停止旧应用"

APPS=(doc-mgmt-backend cleanup-daily-uploads cleanup-sessions backup-db)

for app in "${APPS[@]}"; do
  if pm2 describe "$app" &>/dev/null; then
    pm2 delete "$app" >/dev/null
    log "已删除: $app"
  else
    echo "  - $app: 未运行，跳过"
  fi
done

# ============================================================================
# 步骤 5: 加载新配置并启动
# ============================================================================
step "5/6 加载新配置"

cd "$ROOT"
pm2 start "$ECOSYSTEM"
log "PM2 应用已启动 ✓"

# 保存进程列表（开机自启）
pm2 save
log "PM2 进程列表已保存 ✓"

# 开机自启提示（不强制执行，因为需要 sudo）
if ! pm2 startup 2>&1 | grep -q "already"; then
  warn "PM2 开机自启未配置，请手动执行:"
  echo "  pm2 startup"
  echo "  # 按提示执行返回的 sudo 命令"
fi

# ============================================================================
# 步骤 6: 验证
# ============================================================================
step "6/6 验证部署"

echo ""
pm2 list

echo ""
log "应用状态检查:"

# 检查主服务
if pm2 describe doc-mgmt-backend | grep -q "status │ online"; then
  log "doc-mgmt-backend: online ✓"
else
  err "doc-mgmt-backend 未运行!"
  err "排查: pm2 logs doc-mgmt-backend --lines 50"
fi

# 检查 cron 任务（应该处于 stopped 状态，等待 cron 触发）
for app in cleanup-daily-uploads cleanup-sessions backup-db; do
  if pm2 describe "$app" &>/dev/null; then
    log "$app: 已注册 (等待 cron 触发) ✓"
  else
    err "$app 未注册!"
  fi
done

# 检查 cron 配置
echo ""
log "Cron 配置:"
for app in cleanup-daily-uploads cleanup-sessions backup-db; do
  CRON=$(pm2 describe "$app" 2>/dev/null | grep -E "cron.*\|" | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2}' | head -1)
  if [ -n "$CRON" ]; then
    echo "  $app: $CRON"
  fi
done

# ============================================================================
# 完成
# ============================================================================
echo ""
echo "========================================="
echo -e " ${GREEN}部署完成！${NC}"
echo "========================================="
echo ""
echo " 应用列表:"
echo "   - doc-mgmt-backend      : 常驻服务 (端口 3000)"
echo "   - cleanup-daily-uploads : 每天 04:00 触发"
echo "   - cleanup-sessions     : 每天 03:00 触发"
echo "   - backup-db             : 每天 02:00 触发"
echo ""
echo " 常用命令:"
echo "   pm2 status                          # 查看状态"
echo "   pm2 logs doc-mgmt-backend           # 查看主服务日志"
echo "   pm2 logs cleanup-daily-uploads      # 查看清理日志"
echo "   pm2 start cleanup-daily-uploads     # 手动触发清理"
echo ""
echo " 飞书告警配置 (可选):"
echo "   编辑 $ECOSYSTEM"
echo "   填写 FEISHU_WEBHOOK_URL 环境变量"
echo "   执行: pm2 restart cleanup-daily-uploads --update-env"
echo ""
echo " 完整部署文档: deploy/DEPLOYMENT_CHECKLIST_CLEANUP.md"
echo ""
echo " 备份位置: $BACKUP_DIR"
echo "========================================="
