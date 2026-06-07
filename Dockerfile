# ============================================================
# Dockerfile - 多阶段构建（生产优化）
# ============================================================

# 阶段1: 依赖安装
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# 阶段2: 构建
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js（跳过 ESLint 以加速 CI）
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 阶段3: 运行（最小化镜像）
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma 需要 OpenSSL
RUN apk add --no-cache openssl

# 全局安装 Prisma CLI（运行容器里执行迁移用，锁定 5.x 兼容 schema.prisma 的 url 属性）
RUN npm install -g prisma@5.22.0

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# 启动脚本：先执行 Prisma 数据库迁移，再启动 Next.js
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
