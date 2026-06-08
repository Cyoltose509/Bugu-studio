#!/bin/sh
# 数据库迁移：失败不阻塞启动（已在本地 db push 同步过）
echo "==> Running database migration (best-effort)..."
npx prisma migrate deploy || echo "WARNING: migration failed, skipping..."

echo "==> Starting Next.js server..."
exec node server.js
