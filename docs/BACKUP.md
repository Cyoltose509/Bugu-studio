# 数据备份方案

---

## 备份策略总览

| 类型 | 频率 | 保留时长 | 存储位置 |
|------|------|----------|----------|
| 数据库全量备份 | 每日凌晨 3:00 | 30 天 | 本地 + 云端 |
| 数据库增量备份 | 每 6 小时 | 7 天 | 本地 |
| 媒体文件 | Cloudflare R2 自动冗余 | 永久 | R2 |
| 代码 | Git + GitHub | 永久 | GitHub |

---

## 自动备份脚本

```bash
#!/bin/sh
# docker/backup/backup.sh

set -e

# 配置
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER}"
DB_NAME="${POSTGRES_DB}"
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${DB_NAME}_${DATE}.sql.gz"

echo "[$(date)] 开始备份数据库: ${DB_NAME}"

# 创建备份目录
mkdir -p "${BACKUP_DIR}/daily"

# 执行 pg_dump 并压缩
PGPASSWORD="${PGPASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip -9 > "${BACKUP_DIR}/daily/${FILENAME}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/daily/${FILENAME}" | cut -f1)
echo "[$(date)] 备份完成: ${FILENAME} (${BACKUP_SIZE})"

# 删除超过保留期的备份
find "${BACKUP_DIR}/daily" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] 已清理 ${RETENTION_DAYS} 天前的旧备份"

# 可选：上传到云端（需配置 rclone）
# rclone copy "${BACKUP_DIR}/daily/${FILENAME}" remote:bugu-club-backups/

echo "[$(date)] 当前备份列表:"
ls -lh "${BACKUP_DIR}/daily/"
```

---

## 手动恢复流程

```bash
# 1. 列出可用备份
docker compose exec backup ls -lh /backups/daily/

# 2. 停止应用（可选，避免数据不一致）
docker compose stop app

# 3. 恢复备份
docker compose exec backup sh -c "
  gunzip -c /backups/daily/backup_game_dev_club_20250101_030000.sql.gz \
  | PGPASSWORD=\${PGPASSWORD} psql \
    -h postgres \
    -U \${POSTGRES_USER} \
    -d \${POSTGRES_DB}
"

# 4. 验证数据
docker compose exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
  -c "SELECT COUNT(*) FROM projects;"

# 5. 重启应用
docker compose start app

# 6. 运行迁移（如果恢复的是旧版本数据）
docker compose exec app npx prisma migrate deploy
```

---

## 备份监控

在 backup 容器中加入简单告警（邮件/Webhook）：

```bash
# 备份成功后发送 Webhook 通知
if [ $? -eq 0 ]; then
  curl -s -X POST "${BACKUP_WEBHOOK_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"[OK] 数据库备份成功: ${FILENAME} (${BACKUP_SIZE})\"}"
else
  curl -s -X POST "${BACKUP_WEBHOOK_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"[ALERT] 数据库备份失败! 请立即检查\"}"
fi
```

---

## 数据迁移（换服务器）

```bash
# 在旧服务器：导出完整状态
docker compose exec postgres pg_dumpall \
  -U postgres | gzip > full_dump_$(date +%Y%m%d).sql.gz

# 迁移 R2 文件：R2 本身是云端冗余，无需手动迁移
# 迁移 Docker Volumes：
docker run --rm -v bugu-club_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_volume.tar.gz /data

# 在新服务器：恢复
docker run --rm -v bugu-club_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_volume.tar.gz -C /

# 或者直接恢复 sql dump
gunzip -c full_dump_YYYYMMDD.sql.gz | docker compose exec -T postgres psql -U postgres
```
