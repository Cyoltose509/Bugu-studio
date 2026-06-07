#!/bin/bash
# ============================================================
# 部署脚本
# 使用方式: ./scripts/deploy.sh
# ============================================================

set -euo pipefail

echo "🚀 开始部署游戏开发社团官网..."

# 检查 .env 文件
if [ ! -f ".env" ]; then
  echo "❌ 错误：未找到 .env 文件，请复制 .env.example 并填入配置"
  exit 1
fi

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 构建 Docker 镜像
echo "🔨 构建 Docker 镜像..."
docker compose build --no-cache app

# 停止旧容器（保留数据库）
echo "⏹️  停止应用容器..."
docker compose stop app

# 启动数据库（如果未运行）
echo "🗄️  确保数据库运行中..."
docker compose up -d db

# 等待数据库就绪
echo "⏳ 等待数据库就绪..."
sleep 5

# 执行数据库迁移
echo "📊 执行数据库迁移..."
docker compose run --rm app npx prisma migrate deploy

# 启动应用
echo "▶️  启动应用..."
docker compose up -d app nginx

# 等待应用就绪
echo "⏳ 等待应用就绪..."
sleep 10

# 健康检查
echo "🏥 执行健康检查..."
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "✅ 部署成功！应用运行正常。"
else
  echo "⚠️  健康检查失败，请检查日志："
  echo "   docker compose logs app"
  exit 1
fi

echo "🎉 部署完成！"
