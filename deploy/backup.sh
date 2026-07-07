#!/bin/bash
# 每日自动备份 — 配合 crontab: 0 3 * * * /opt/doc-mgmt/deploy/backup.sh
BACKUP_DIR="/opt/doc-mgmt/backups"
DB_PATH="/opt/doc-mgmt/backend/data/planning.db"
FILES_PATH="/opt/doc-mgmt/backend/files"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)
ARCHIVE="$BACKUP_DIR/backup_$DATE.tar.gz"

tar -czf "$ARCHIVE" "$DB_PATH" "$FILES_PATH" 2>/dev/null
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "[$(date)] Backup: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
