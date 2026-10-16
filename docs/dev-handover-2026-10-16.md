# 开发交接 · 2026-10-16

接着改前台/后台的人看这份。账号、服务器、环境变量仍看 `docs/HANDOVER.md`（那份没动）。

本轮已经推到分支 `codex/baituan-recruitment-2026`。上线前要跑 Prisma 迁移：`MeetingTalk.talkType`。

---

## 这批改了什么

### 顶栏

- Logo 背面固定英文 `HOME`，不跟中/英切换。悬停或键盘聚焦整块链接都会翻转（父级 class `nav-logo`）。
- 语言键只显示即将切到的 `EN` / `CN`，无地球、无边框。
- 白昼顶栏月亮：线性白描边（`fill="none" stroke="#fff"`）；夜间是橙色线性太阳。不要改成实心月。
- 窄屏汉堡走词典：提交作品 / 后台 / 个人中心 / 退出登录 / 日夜间。英文对应 Submit Work / Admin / Profile / Sign out / Light mode。
- 「退出登录」底色是站点砖红 `#C62828` 兑进菜单藏青（`.nav-menu-signout`），不要用 Tailwind `red-600`。
- 通知铃：未读按审核 / 活动 / 报错分桶（`src/lib/notifications/buckets.ts`），面板动画和已读接口一起改过。

### 首页「最新作品」

始终两行，列数只随**宽度**增加，不用横竖屏比例（以前用 5:7–1:1 开三列，拉宽会出现 2→3→2→4）。

| 视口 | 列 | 露出 |
|------|----|------|
| &lt; 520px | 1 | 2 |
| ≥ 520px | 2 | 4 |
| ≥ 768px | 3 | 6 |
| ≥ 1024px | 4 | 8 |

数字写在 `src/lib/layout/homeWorksGrid.ts`。`globals.css` 里 `.home-latest-works-grid` 的 media query **必须跟这个文件一致**。服务端仍最多取 8 条；首屏 CSS 用 `nth-child` 藏多余卡，水合后 `HomeLatestWorksGrid` 按同一断点卸载。`nth-child` 不能读 CSS 变量，所以 TS 和 CSS 要各写一份。

### 活动（前台 + 后台）

- 列表/卡片类型绶带：`ActivityTypeCorner`。字几乎撑满带子高度；长标签（含英文 `Major Event`）用更小字号 + `tracking-tight`。
- 活动页管理员入口：前台 `/activities` 有快捷「+」进创建。
- 创建：类型等宽置顶；去掉开放报名；发布 / 草稿分开；地点可选。封面上传可叠标题、简介、类型角标。创建页底栏改为 sticky，避免被封面预览挡住。
- 编辑：拆到 `EditActivityForm.tsx`。类型在最上，状态是横向时间轴，只留一个总保存。议程 / 展示不能再套一层 `<form>`，改成 `talksJson` / `showcaseJson` 藏进父表单。
- 例会议程：卡片式编辑（`MeetingTalksEditor`、`AgendaRow`、`AgendaManagePanel`）。每条有 `talkType`：`SHARE`（主讲）或 `SHOWCASE`（展示）。
- **库表**：`MeetingTalk.talkType`，默认 `SHARE`，枚举复用 `ProposalType`。迁移目录 `prisma/migrations/20261015193000_meeting_talk_type/`。预发/生产必须先 migrate 再发这版代码。

### 历史 / 作品库 / 管理

- 历史栏目年份筛选改成横向滚轴（`HistoryClient`），点年份滚到对应年报锚点。
- 作品库侧栏：赛事标签独立预设（`event-tags.ts` + `EventTagIcon`），GGJ 用了 `public/images/tags/ggj.png`。筛选分组用 `FilterSection`。
- 作品「按时间」排序改成 `publishedAt DESC NULLS LAST`，不再按 `developYear` 压过新作（`src/lib/works/date-sort.ts`）。
- 管理后台竖屏：快捷操作置顶。侧栏加了「前端错误」`/admin/errors`。错误列表可悬停复制。
- 监控口令校验现在也会回 403；回归测试已把 403 算进拒绝密码的合法状态。

---

## 关键文件

| 路径 | 职责 |
|------|------|
| `src/lib/layout/homeWorksGrid.ts` | 首页作品列/张数断点（改断点先改这里） |
| `src/components/home/HomeLatestWorksGrid.tsx` | 水合后按断点切两行 |
| `src/app/globals.css` | logo 翻转、退出登录底、首页栅格首屏裁切 |
| `src/components/layout/NavActionsMenu.tsx` | 窄屏菜单 |
| `src/components/layout/ThemeToggle.tsx` | 昼夜线性图标 |
| `src/components/layout/NotificationBell.tsx` | 通知铃分桶 |
| `src/lib/notifications/buckets.ts` | 通知类型 → 审核/活动/报错 |
| `src/components/activities/ActivityTypeCorner.tsx` | 类型绶带 |
| `src/app/admin/activities/create/page.tsx` | 创建活动 |
| `src/app/admin/activities/[id]/edit/EditActivityForm.tsx` | 编辑活动（单保存） |
| `src/app/admin/activities/actions.ts` | 活动写库，含 talksJson / talkType |
| `src/components/activities/meeting/MeetingTalksEditor.tsx` | 议程卡片 |
| `prisma/schema.prisma` + 上述 migration | `MeetingTalk.talkType` |
| `src/lib/works/date-sort.ts` | 作品时间排序 |
| `src/lib/tags/event-tags.ts` | 赛事标签预设 |
| `src/app/admin/errors/page.tsx` | 前端错误页入口 |
| `src/lib/i18n/dict.ts` | 顶栏/菜单等新文案 |

---

## 怎么验收

1. **迁移**：本地/预发跑过 `talkType` 迁移后再打开例会编辑页，旧条目应显示为「主讲」。
2. 首页从约 390px 慢慢拉到 1280px：列只能 1→2→3→4，始终两行，不会中途变少。
3. 中文和英文下悬停/Tab 到左上角 logo，背面都是 `HOME`。
4. 英文 + 窄屏打开汉堡：Submit Work / Admin / Profile / Sign out / Light mode（或 Dark mode）。
5. 白昼顶栏月亮为白色线条，不是实心块。
6. 活动列表封面绶带「例会 / 大事件」字几乎撑满带子。
7. 创建活动能存草稿、地点可空；编辑页只有一个保存，改议程不会拆成第二个表单提交。
8. 历史页年份滚轴能滚、能跳年。
9. 作品库按时间：刚发布的应在没填发布时间的旧档前面。

本机开发默认 `http://localhost:1145`。

---

## 故意没动

- 作品库页栅格没有套首页这套 1–4 列规则。
- `docs/HANDOVER.md` 仍是换届运维模板，没填账号。
- Skip link 文案在词典里（`common.skipToContent`），无障碍树里有时仍先露出中文，是语言水合时序，这轮没改 LangProvider。

---

## 接着可以做

1. 改首页断点：先改 `homeWorksGrid.ts`，再改 `globals.css` 里三处 `min-width`（520 / 768 / 1024）和对应 `nth-child` 显隐。只改一处，首屏裁切和水合后张数会对不上。
2. 作品库栅格若要跟首页对齐，不要直接复用 `--home-works-cols`，单独做一版，筛选侧栏宽度不一样。
3. 把 Skip link 和其它 SSR 中文默认改成跟 cookie 语言一致，避免英文页无障碍树里闪中文。
4. 管理后台文案大多还是写死中文，没有走 `dict.ts`。
5. `.tmp-check-col.js` / `.tmp-share-check.js` 是本地探测脚本，不要提交。
