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
RUN apk add --no-cache openssl
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

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制 Prisma 相关依赖（builder 已 generate）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# .bin 目录包含 npx 需要的可执行文件入口（如 prisma CLI）
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/package.json ./package.json

# 创建缓存目录并设置权限
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache
# 确保 Prisma 和 node_modules 对 nextjs 可读
RUN chown -R nextjs:nodejs /app/node_modules /app/prisma

# 创建上传目录并设置权限（volume 挂载点在构建时就有正确 owner）
RUN mkdir -p /app/public/uploads/covers /app/public/uploads/avatars \
    && chown -R nextjs:nodejs /app/public/uploads

# 启动脚本：先执行 Prisma 数据库迁移，再启动 Next.js
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
