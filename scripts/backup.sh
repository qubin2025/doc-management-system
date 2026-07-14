#!/bin/bash
# 数据库自动备份脚本 - 每天备份，保留最近7天
BACKUP_DIR="./backups"
DB_PATH="${DB_PATH:-./backend/data/planning.db}"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/planning_$TIMESTAMP.db"

cp "$DB_PATH" "$BACKUP_FILE"
echo "[$(date)] Backup created: $BACKUP_FILE"

# 清理7天前的备份
find "$BACKUP_DIR" -name "planning_*.db" -mtime +$RETENTION_DAYS -delete 2>/dev/null
echo "[$(date)] Cleaned backups older than $RETENTION_DAYS days"
