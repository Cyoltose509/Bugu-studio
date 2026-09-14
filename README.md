# 布谷工作室官网

Next.js 15 社团官网：作品库、成员、活动 / Game Jam、招新、管理后台。

线上站点：https://bugoostudio.com  
代码仓库：https://github.com/Cyoltose509/Bugu-studio

## 实际技术栈（以现网为准）

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | Supabase PostgreSQL + Prisma |
| 认证 | Auth.js v5（**JWT Session**，不是数据库 Session） |
| 存储 | Cloudflare R2 |
| 邮件 | Resend |
| 部署 | **Vercel**（主路径）；仓库里仍有 Docker / Nginx 文档，供可选自建 |

## 角色权限

| 角色 | 浏览 | 提交作品 | 管理后台 |
|------|------|----------|----------|
| Guest / User | ✅ | ❌ | ❌ |
| Member | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ |

管理员可通过邀请码直接授予 Admin（这是有意设计）。Member 身份通常需审批。

## 本地开发

```bash
# 1. 环境变量
cp .env.example .env.local
# 填入 DATABASE_URL / AUTH_SECRET / R2 / Resend 等

# 2. 安装依赖
npm install

# 3. 生成 Prisma Client 并启动
npm run db:generate
npm run dev
```

访问 http://localhost:3000

> 生产库不要随便跑 `prisma migrate reset`、`db push --accept-data-loss` 或 seed。  
> 本地试验请用独立数据库。

常用脚本：

- `npm run db:migrate` — 生产迁移（`prisma migrate deploy`）
- `npm run db:push` — 本地安全推送（有确认脚本）
- `npm test` / `npm run test:e2e` — 测试

## 备份与恢复（管理后台）

路径：`/admin/backups`

1. **一键备份大版本**：导出完整表数据（含登录密码哈希、活动 / Game Jam 等）→ **AES-256-GCM 加密** → 压缩后存到 Cloudflare R2（`admin-backups/v{n}.json.gz`）。
2. **恢复到此版本**：按版本号下载 → 解密 → **单个数据库事务**整库替换；失败回滚。

安全说明：

- 图床 R2 桶往往对公网可读，因此**禁止明文上传**库快照。加密密钥默认由 `AUTH_SECRET` 派生；也可单独配置 `BACKUP_ENCRYPTION_KEY`（推荐生产单独设置，轮换 AUTH_SECRET 时备份仍可解）。
- 旧版「按日期写本地 `backups/`」明文方案已废弃。
- 接手后请立刻做一次新备份；恢复需在确认框输入「确认恢复」。
- 恢复后可能需要重新登录。

## 监控页密码

`/admin/monitoring/*` 有第二道门锁。密码存在数据库 `siteSetting.monitoring_password`（bcrypt），**不在 `.env` 明文里**。

接手后若不知道旧密码：登录管理后台仪表盘 →「监控页密码」卡片 → 直接设置新密码。

## 目录结构（摘要）

```
src/app/           # 页面与 API（App Router）
src/components/    # UI 组件
src/lib/           # auth / db / backup / 业务逻辑
prisma/            # schema 与 migrations
scripts/           # 运维与测试脚本
docs/              # 设计与运维文档（部分可能滞后，以本 README 为准）
```

## 接手维护建议

1. 从 `main` 拉功能分支，用 Pull Request 合并；不要 force-push `main`。
2. 请仓库主人开启 `main` 分支保护（禁强推、必须 PR）。
3. 密钥放在 `.env.local` / 部署平台环境变量，文件名 `necessary.env` 也需忽略，勿提交。
4. 接手快照标签：`handover-2026-09-12`。
