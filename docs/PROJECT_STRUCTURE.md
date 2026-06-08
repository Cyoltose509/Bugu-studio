# 项目目录结构

```
bugu-club/
├── .env.example                  # 环境变量模板（提交到 Git）
├── .env.local                    # 本地开发变量（不提交）
├── .env.production               # 生产变量（不提交）
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── prisma/
│   ├── schema.prisma             # 数据库模型
│   ├── migrations/               # 数据库迁移记录
│   └── seed.ts                   # 种子数据（角色/权限初始化）
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── og-image.png              # Open Graph 默认封面
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # 根布局（含 CSP headers）
│   │   ├── page.tsx              # 首页
│   │   │
│   │   ├── works/
│   │   │   ├── page.tsx          # 作品库列表
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 作品详情
│   │   │
│   │   ├── members/
│   │   │   ├── page.tsx          # 成员列表
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 成员详情
│   │   │
│   │   ├── history/
│   │   │   └── page.tsx          # 历史页
│   │   │
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── verify-email/page.tsx
│   │   │
│   │   ├── dashboard/            # 登录用户工作台
│   │   │   ├── layout.tsx        # 工作台布局
│   │   │   ├── profile/page.tsx
│   │   │   ├── submit/page.tsx   # 投稿（Member）
│   │   │   └── my-works/page.tsx
│   │   │
│   │   └── admin/                # 管理后台
│   │       ├── layout.tsx        # 后台布局（含权限守卫）
│   │       ├── page.tsx          # 仪表盘
│   │       ├── works/page.tsx    # 作品管理
│   │       ├── members/page.tsx  # 成员管理
│   │       ├── users/page.tsx    # 用户管理
│   │       ├── reviews/page.tsx  # 审核队列
│   │       ├── announcements/page.tsx
│   │       ├── logs/page.tsx     # 审计日志
│   │       └── settings/page.tsx
│   │
│   ├── pages/
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth].ts
│   │       └── v1/               # RESTful API
│   │           ├── projects/
│   │           │   ├── index.ts          # GET list / POST create
│   │           │   └── [id]/
│   │           │       ├── index.ts      # GET / PATCH / DELETE
│   │           │       ├── submit.ts     # POST submit for review
│   │           │       └── review.ts     # POST review action
│   │           ├── members/
│   │           │   ├── index.ts
│   │           │   └── [id]/index.ts
│   │           ├── upload/
│   │           │   └── presign.ts
│   │           ├── announcements/
│   │           │   ├── index.ts
│   │           │   └── [id]/index.ts
│   │           └── admin/
│   │               ├── users/
│   │               │   ├── index.ts
│   │               │   └── [id]/
│   │               │       ├── roles.ts
│   │               │       └── status.ts
│   │               ├── member-requests/
│   │               │   └── [id]/review.ts
│   │               └── audit-logs/index.ts
│   │
│   ├── components/               # UI 组件
│   │   ├── ui/                   # 基础原子组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── AdminSidebar.tsx
│   │   ├── works/
│   │   │   ├── WorkCard.tsx
│   │   │   ├── WorkGrid.tsx
│   │   │   ├── WorkFilter.tsx
│   │   │   ├── WorkDetail.tsx
│   │   │   └── ImageGallery.tsx
│   │   ├── members/
│   │   │   ├── MemberCard.tsx
│   │   │   └── MemberDetail.tsx
│   │   ├── home/
│   │   │   ├── HeroBanner.tsx
│   │   │   ├── StatsSection.tsx
│   │   │   └── FeaturedWorks.tsx
│   │   └── admin/
│   │       ├── DataTable.tsx
│   │       └── ReviewQueue.tsx
│   │
│   ├── lib/                      # 核心库
│   │   ├── prisma.ts             # Prisma 单例
│   │   ├── auth.ts               # Auth.js 配置
│   │   ├── r2.ts                 # Cloudflare R2 客户端
│   │   ├── email.ts              # 邮件发送（nodemailer）
│   │   └── security/
│   │       ├── password.ts       # Argon2id 工具
│   │       ├── sanitize.ts       # XSS Sanitization
│   │       ├── upload.ts         # 文件上传校验
│   │       └── rateLimit.ts      # 速率限制
│   │
│   ├── middleware/               # API 中间件
│   │   ├── rbac.ts               # 权限校验
│   │   ├── audit.ts              # 审计日志
│   │   ├── validate.ts           # 请求体校验（zod）
│   │   └── errorHandler.ts       # 统一错误处理
│   │
│   ├── services/                 # 业务服务层
│   │   ├── project.service.ts    # 作品业务逻辑
│   │   ├── member.service.ts
│   │   ├── user.service.ts
│   │   ├── review.service.ts
│   │   ├── notification.service.ts
│   │   └── storage.service.ts
│   │
│   ├── schemas/                  # Zod 验证 Schema
│   │   ├── project.schema.ts
│   │   ├── member.schema.ts
│   │   ├── auth.schema.ts
│   │   └── upload.schema.ts
│   │
│   ├── types/                    # TypeScript 类型定义
│   │   ├── api.ts                # API 请求/响应类型
│   │   ├── auth.ts               # Session 扩展类型
│   │   └── index.ts
│   │
│   └── hooks/                    # React Hooks
│       ├── useAuth.ts
│       ├── useProjects.ts
│       └── useMembers.ts
│
├── docker/
│   ├── Dockerfile                # 应用镜像
│   ├── nginx/
│   │   └── nginx.conf            # Nginx 反向代理配置
│   └── backup/
│       └── backup.sh             # 自动备份脚本
│
├── docker-compose.yml            # 生产环境编排
├── docker-compose.dev.yml        # 开发环境编排
│
└── docs/                         # 运维/交接文档
    ├── deployment.md             # 部署指南
    ├── maintenance.md            # 运维手册
    ├── handover.md               # 交接指南
    └── runbook.md                # 故障处理手册
```
