# 2026-10-21 生产数据库迁移交接

## 已核对的本地连接

- 本地 `DATABASE_URL` / `DIRECT_URL` 均指向 Supabase 项目 `bgdecuoksmriilpulbxc`（东京区连接池）。不要复制完整连接串或密码到工单、聊天和日志。
- 2026-10-21 11:06（北京时间）读取时，库内有 41 张业务表、3,814 条记录；包括 `baituan-2026` 和 2026/10/18 例会等活动。
- 库里没有 `_prisma_migrations`。当前结构已有迁移 `20261017180000_course_people_attachments` 及之前的核心表/列；`CourseClass` 等引擎课程表及 `CourseParticipant.externalName` 尚不存在。
- `Activity.registrationOpen` 后来出现一条为 `true` 的 2026/11/1 例会记录。这是可变业务数据，不应仅凭它判断旧迁移是否执行过。新版后台创建/编辑活动会固定为 `false`。
- 本地加密逻辑快照已保存到忽略 Git 的 `backups/pre-course-migration-2026-10-21T03-06-27-524Z.json.gz.enc`，读取及解密校验通过。它包含当时所有 41 张表及列元数据，但不是 `pg_dump` 的完整 DDL/权限备份；继续迁移前应重新生成新快照。

## 唯一待核对的信息

请从 **Vercel Production** 环境的 `DATABASE_URL` 或 `DIRECT_URL` 读取数据库用户名中 `postgres.<项目 ref>` 的 `<项目 ref>`。只需比较是否为 `bgdecuoksmriilpulbxc`，不要传密码或完整 URL。Preview 环境变量不能代替 Production。若不同，停止：本地连接不属于生产库。

## 同一库时的操作顺序

1. 在生产库上做新鲜、可恢复的备份。本站 `/admin/backups` 在此次修复后才覆盖新增公开课/议程表，因此旧版本的后台备份不能作为完整快照。当前本地加密快照可作数据兜底，但不是完整物理备份；如果可用，优先另取一份 Supabase 平台备份或 `pg_dump`。
2. 再次只读确认 `_prisma_migrations` 不存在、`CourseParticipant`/`CourseAttachment` 存在、`CourseClass` 不存在、`CourseParticipant.externalName` 不存在。
3. 依次把 `20260607100301_init` 至 `20261017180000_course_people_attachments` 共 10 条已有结构迁移标记为已应用。**不要重跑这些建表 SQL**，也不要用 `prisma db push` 覆盖迁移历史。
4. 执行 `prisma migrate deploy`，让剩余 5 条迁移顺序应用，再用 `prisma migrate status` 和数据库结构核验完成状态。
5. 在数据库就绪后点击 Vercel Production 部署。当前 `npm run build` 不会自动应用数据库迁移。

上述操作应由持有本地连接的一侧完成。生产项目 ref 未核实前，勿对该连接执行写入。
