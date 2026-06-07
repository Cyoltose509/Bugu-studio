# Docker 部署方案

---

## docker-compose.yml（生产环境）

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
      args:
        - NODE_VERSION=22
    image: game-dev-club:latest
    container_name: game-dev-club-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - R2_PUBLIC_URL=${R2_PUBLIC_URL}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - internal
    volumes:
      - app_logs:/app/logs
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'

  postgres:
    image: postgres:15-alpine
    container_name: game-dev-club-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M

  nginx:
    image: nginx:1.25-alpine
    container_name: game-dev-club-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro    # Certbot SSL 证书
      - nginx_logs:/var/log/nginx
    depends_on:
      - app
    networks:
      - internal
      - external

  backup:
    image: postgres:15-alpine
    container_name: game-dev-club-backup
    restart: unless-stopped
    environment:
      - PGPASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_DB=${POSTGRES_DB}
      - BACKUP_RETENTION_DAYS=30
    volumes:
      - ./docker/backup/backup.sh:/backup.sh:ro
      - backup_data:/backups
    networks:
      - internal
    # 每天凌晨 3 点执行备份
    entrypoint: ["/bin/sh", "-c", "crond -f -d 8 & echo '0 3 * * * /backup.sh' | crontab - && wait"]

volumes:
  postgres_data:
    driver: local
  backup_data:
    driver: local
  app_logs:
    driver: local
  nginx_logs:
    driver: local

networks:
  internal:
    driver: bridge
    internal: true   # postgres 不暴露到外部
  external:
    driver: bridge
```

---

## Dockerfile

```dockerfile
# docker/Dockerfile

# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖（利用 layer cache）
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# 复制源码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 只安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

# 复制构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 创建非 root 用户（最小权限原则）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 修改文件所有者
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# 启动时执行迁移然后启动服务
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

---

## Nginx 配置

```nginx
# docker/nginx/conf.d/game-dev-club.conf

upstream app {
    server app:3000;
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # 文件上传限制（封面+截图，前端也限制）
    client_max_body_size 10M;

    # 安全 Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # 代理到 Next.js
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Next.js 静态资源缓存
    location /_next/static/ {
        proxy_pass http://app;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /public/ {
        proxy_pass http://app;
        add_header Cache-Control "public, max-age=86400";
    }

    # API 日志（与静态资源分离）
    location /api/ {
        proxy_pass http://app;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        access_log /var/log/nginx/api_access.log;
    }
}
```

---

## 健康检查 API

```typescript
// src/pages/api/health.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    });
  } catch (e) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
}
```

---

## 部署操作手册

### 首次部署

```bash
# 1. 克隆代码
git clone https://github.com/your-org/game-dev-club.git
cd game-dev-club

# 2. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production，填写所有必要值
nano .env.production

# 3. 构建镜像
docker compose build

# 4. 启动服务（首次会自动执行数据库迁移）
docker compose up -d

# 5. 验证服务
docker compose ps
curl http://localhost/api/health

# 6. 执行种子数据（首次）
docker compose exec app npx prisma db seed

# 7. 创建初始 Admin 账号（通过 seed 或手动）
docker compose exec app node scripts/create-admin.js
```

### 日常更新部署

```bash
# 拉取最新代码
git pull origin main

# 构建新镜像
docker compose build app

# 滚动更新（零停机）
docker compose up -d --no-deps --build app

# 确认新版本正常
docker compose logs app --tail=50
curl http://localhost/api/health
```

### 回滚

```bash
# 查看历史镜像
docker images game-dev-club

# 回滚到上一个版本（通过 tag 指定）
docker compose down app
docker tag game-dev-club:previous game-dev-club:latest
docker compose up -d app
```
