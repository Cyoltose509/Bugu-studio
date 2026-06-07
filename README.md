# 布谷工作室官网

## 快速开始

### 本地开发

```bash
# 1. 复制环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的配置

# 2. 安装依赖
npm install

# 3. 启动 PostgreSQL（需要 Docker）
docker run -d \
  --name gameclub_dev_db \
  -e POSTGRES_USER=gameclub \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=gameclub_dev \
  -p 5432:5432 \
  postgres:16-alpine

# 4. 初始化数据库
npm run db:generate
npx prisma migrate dev --name init
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 生产部署

```bash
# 1. 复制并配置环境变量
cp .env.example .env
nano .env  # 填入所有必要配置

# 2. 运行部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── (public)/           # 公开页面路由组
│   ├── api/                # API Routes
│   │   ├── auth/           # Auth.js 处理器
│   │   ├── projects/       # 作品 CRUD
│   │   ├── members/        # 成员 API
│   │   ├── tags/           # 标签 API
│   │   ├── upload/         # 文件上传
│   │   └── health/         # 健康检查
│   ├── works/              # 作品库页面
│   ├── members/            # 成员页面
│   ├── history/            # 历史档案
│   └── admin/              # 管理后台
├── components/             # React 组件
│   ├── layout/             # 布局组件
│   ├── works/              # 作品相关组件
│   └── members/            # 成员相关组件
├── lib/                    # 核心库
│   ├── auth/               # 认证 & RBAC
│   ├── db/                 # Prisma Client
│   ├── validations/        # Zod Schema
│   └── utils/              # 工具函数
└── middleware.ts            # 路由保护中间件
prisma/
├── schema.prisma           # 数据库 Schema
├── seed.ts                 # 种子数据
└── migrations/             # 迁移文件
docker-compose.yml          # 生产 Docker 配置
nginx/                      # Nginx 配置
scripts/                    # 运维脚本
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15 + TypeScript |
| 样式 | TailwindCSS |
| 数据库 | PostgreSQL 16 |
| ORM | Prisma 5 |
| 认证 | Auth.js v5 (数据库 Session) |
| 存储 | Cloudflare R2 |
| 部署 | Docker + Nginx |

## 权限模型

| 角色 | 浏览 | 提交作品 | 审核 | 管理 |
|------|------|----------|------|------|
| Guest | ✅ | ❌ | ❌ | ❌ |
| User | ✅ | ❌ | ❌ | ❌ |
| Member | ✅ | ✅ | ❌ | ❌ |
| Reviewer | ✅ | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |

**Member 身份需管理员手动审批。**

## 备份

备份文件存储在 `./backups/` 目录，每天凌晨2点自动执行。

手动触发备份：
```bash
docker compose exec backup /backup.sh
```

恢复备份：
```bash
gunzip -c backups/gameclub_20250101_020000.sql.gz | \
  docker compose exec -T db psql -U gameclub gameclub_db
```
