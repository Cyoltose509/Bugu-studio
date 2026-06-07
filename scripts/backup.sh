#!/bin/sh
# ============================================================
# 数据库自动备份脚本
# 每天凌晨2点由 Docker cron 调用
# ============================================================

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/gameclub_${DATE}.sql.gz"

# 最多保留 30 天备份
RETENTION_DAYS=30

echo "[$(date)] 开始备份..."

# 执行备份
pg_dump \
  -h db \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-password \
  --format=plain \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_FILE}"

# 检查备份是否成功
if [ $? -eq 0 ]; then
  SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
  echo "[$(date)] 备份成功: ${BACKUP_FILE} (${SIZE})"
else
  echo "[$(date)] 备份失败！" >&2
  exit 1
fi

# 清理旧备份
echo "[$(date)] 清理 ${RETENTION_DAYS} 天前的备份..."
find "${BACKUP_DIR}" -name "gameclub_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] 清理完成"

# 列出当前备份文件
echo "[$(date)] 当前备份文件:"
ls -lh "${BACKUP_DIR}"/gameclub_*.sql.gz 2>/dev/null || echo "无备份文件"

echo "[$(date)] 备份任务完成"
