# 布谷工作室官网

武汉大学游戏开发社团「布谷工作室」官方网站：作品展示、成员介绍、活动与招新。

- 线上：https://www.bugoostudio.com
- 仓库：https://github.com/Cyoltose509/Bugu-studio

## 技术栈

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Prisma · Supabase PostgreSQL · Auth.js · Cloudflare R2 · Resend · Vercel

## 本地运行

```bash
cp .env.example .env.local   # 按模板填写环境变量
npm install
npm run db:generate
npm run dev
```

浏览器打开 http://localhost:3000

环境变量说明见 `.env.example`。更细的设计与运维文档在 `docs/`。

## 功能概览

| 模块 | 说明 |
|------|------|
| 作品库 | 浏览、筛选、点赞与详情 |
| 成员 | 成员主页与作品关联 |
| 活动 | 例会 / 公开课 / Game Jam 等 |
| 招新 | 招新信息与联系方式 |
| 管理后台 | 作品、成员、活动与系统管理（需管理员） |

## 开源协议

私有仓库，版权归布谷工作室所有。
