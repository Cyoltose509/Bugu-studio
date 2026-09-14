/**
 * 个人中心（流式渲染）
 * - 普通用户：查看/编辑自己的资料
 * - 管理员：可通过 ?id=xxx 查看任意用户资料
 */
import { Suspense } from "react";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import Link from "next/link";
import MiniLikeButton from "@/components/projects/MiniLikeButton";
import ProjectCard from "@/components/projects/ProjectCard";
import { RichContent } from "@/components/ui/RichContent";
import ProjectCoverImage from "@/components/projects/ProjectCoverImage";
import { positionLabel, positionColor } from "@/lib/position";
import LogoLoading from "@/components/ui/LogoLoading";

export const dynamic = "force-dynamic";

/* ── 同步 Shell ── */

export default function ProfilePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return (
    <Suspense fallback={<LogoLoading text="正在加载个人中心..." compact />}>
      <ProfileContent searchParams={searchParams} />
    </Suspense>
  );
}

/* ── 异步数据组件 ── */

async function ProfileContent({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4 text-brand-text-secondary">请先登录</p>
          <Link href="/auth/login" className="btn-primary px-6 py-2 rounded-lg text-sm font-medium">前往登录</Link>
        </div>
      </div>
    );
  }

  const { id: targetId } = await searchParams;
  const isAdminView = session.user.role === "ADMIN" && !!targetId && targetId !== session.user.id;
  const userId = isAdminView ? targetId! : session.user.id;

  const [user, member, userProjects, likedProjects] = await Promise.all([
    cachedQuery(`profile:user:${userId}`, () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, bio: true, role: true, image: true,
          emailVerified: true, isActive: true,
          lastLoginAt: true, createdAt: true,
        },
      })
    , 30),
    cachedQuery(`profile:member:${userId}`, () =>
      prisma.clubMember.findUnique({
        where: { userId },
        select: {
          id: true, displayName: true, bio: true, grade: true,
          graduated: true, realName: true, joinYear: true,
          college: true, major: true, workLocation: true, workPosition: true,
          skills: true, position: true,
          location: true, phone: true, wechat: true, qq: true,
          socialLinks: { orderBy: { sortOrder: "asc" } },
        },
      })
    , 30),
    cachedQuery(`profile:projects:${userId}`, () =>
      prisma.project.findMany({
        where: { submitterId: userId },
        orderBy: [{ developYear: "desc" }, { createdAt: "desc" }],
        include: {
          tags: { include: { tag: true } },
          images: {
            orderBy: { sortOrder: "asc" },
            take: 4,
            select: { url: true, altText: true },
          },
          members: {
            orderBy: { sortOrder: "asc" },
            include: {
              member: {
                select: {
                  displayName: true,
                  avatar: true,
                  user: { select: { image: true } },
                },
              },
              user: { select: { name: true, image: true } },
            },
          },
          _count: { select: { likes: true } },
        },
        take: 12,
      })
    , 30),
    cachedQuery(`profile:liked:${userId}`, () =>
      prisma.project.findMany({
        where: {
          likes: { some: { userId } },
          status: "PUBLISHED",
        },
        orderBy: [{ developYear: "desc" }, { publishedAt: "desc" }],
        include: {
          tags: { include: { tag: true } },
          images: {
            orderBy: { sortOrder: "asc" },
            take: 4,
            select: { url: true, altText: true },
          },
          members: {
            orderBy: { sortOrder: "asc" },
            include: {
              member: {
                select: {
                  displayName: true,
                  avatar: true,
                  user: { select: { image: true } },
                },
              },
              user: { select: { name: true, image: true } },
            },
          },
          _count: { select: { likes: true } },
        },
        take: 8,
      })
    , 30),
  ]);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-fade-in space-y-8">
      {/* 管理员视图横幅 */}
      {isAdminView && (
        <div className="rounded-xl border p-4 flex items-center justify-between shadow-sm border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <span className="text-lg">🛡️</span>
            <div>
              <p className="text-sm font-medium text-red-700">管理员视图 — 正在查看 {user?.name || user?.email || "未知用户"} 的资料</p>
              <p className="text-xs text-red-600">你无法编辑此用户的资料，仅可查看</p>
            </div>
          </div>
          <Link href="/admin/users" className="text-sm px-3 py-1.5 rounded-lg border border-red-100 text-red-700 hover:bg-card transition-colors">← 返回用户管理</Link>
        </div>
      )}

      {/* 头部 */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* 头像 */}
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || ""}
              className="w-20 h-20 rounded-full object-cover border-2 border-brand-navy shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={
                user?.role === "ADMIN"
                  ? "w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0 bg-gradient-to-br from-brand-navy to-[#3A7099]"
                  : "w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0 bg-gradient-to-br from-brand-orange to-brand-orange-light"
              }
            >
              {(user?.name || user?.email || "?")[0].toUpperCase()}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-brand-navy">
              {member?.displayName || user?.name || "未设置昵称"}
            </h1>
            <div className="mt-1 space-y-1">
              <p className="text-sm text-brand-text-secondary">{user?.email}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(user?.role)}`}>
                  {user?.role === "ADMIN" ? "管理员" :
                   user?.role === "MEMBER" ? "社团成员" : "注册用户"}
                </span>
                {user?.emailVerified && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-800">
                    已验证
                  </span>
                )}
                {user?.isActive === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    已禁用
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {isAdminView ? (
              <Link href="/admin/users" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">← 返回用户管理</Link>
            ) : (
              <>
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">管理后台</Link>
                )}
                <Link href="/profile/edit" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">编辑资料</Link>
                <Link href="/profile/settings" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">通知设置</Link>
                <Link href="/profile/privacy" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">隐私设置</Link>
                <Link href="/auth/signout" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">退出登录</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 账号信息 */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm">
        <h2 className="font-semibold mb-4 text-brand-navy">账号信息</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs mb-0.5 text-brand-text-muted">邮箱</div>
            <div className="text-brand-text-heading">{user?.email}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5 text-brand-text-muted">角色</div>
            <div className="text-brand-text-heading">{user?.role}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5 text-brand-text-muted">注册时间</div>
            <div className="text-brand-text-heading">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "—"}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5 text-brand-text-muted">最后登录</div>
            <div className="text-brand-text-heading">{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("zh-CN") : "—"}</div>
          </div>
        </div>
      </div>

      {/* 个人介绍 — 所有用户可见 */}
      {user?.bio && (
        <div className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm">
          <h2 className="font-semibold mb-3 text-brand-navy">个人介绍</h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-brand-text-body">
            <RichContent text={user.bio} />
          </p>
        </div>
      )}

      {/* 成员信息 */}
      {member && (() => {
        // 敏感信息可见性：自己看自己 或 查看者角色 >= MEMBER
        const canSeeSensitive = !isAdminView || (session.user.role !== "USER");
        return (
        <div className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm">
          <h2 className="font-semibold mb-4 text-brand-navy">社团成员信息</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs mb-0.5 text-brand-text-muted">展示名称</div>
              <div className="flex items-center gap-1.5 text-brand-text-heading">
                {member.displayName}
                {member.position && member.position !== "MEMBER" && (() => {
                  const color = positionColor(member.position);
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: color.bg, color: color.text }}>
                      {positionLabel(member.position)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div>
              <div className="text-xs mb-0.5 text-brand-text-muted">年级</div>
              <div className="text-brand-text-heading">{member.grade != null ? `${member.grade}级` : "—"}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5 text-brand-text-muted">入社年份</div>
              <div className="text-brand-text-heading">{member.joinYear != null ? `${member.joinYear}年` : "—"}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5 text-brand-text-muted">毕业状态</div>
              <div className={member.graduated ? "text-brand-orange" : "text-brand-blue"}>
                {member.graduated ? "已毕业" : "在读"}
              </div>
            </div>
          </div>

          {/* 联系方式 — 敏感项，仅成员+可见 */}
          {canSeeSensitive && (member.location || member.phone || member.wechat || member.qq) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs mb-2 text-brand-text-muted">联系方式（仅成员可见）</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {member.location && <ContactRow label="所在地" value={member.location} />}
                {member.phone && <ContactRow label="电话" value={member.phone} />}
                {member.wechat && <ContactRow label="微信" value={member.wechat} />}
                {member.qq && <ContactRow label="QQ" value={member.qq} />}
              </div>
            </div>
          )}

          {/* 真实姓名 — 敏感项，仅成员+可见 */}
          {canSeeSensitive && member.realName && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs mb-2 flex items-center gap-1 text-brand-text-muted">
                🔒 真实姓名（仅成员可见）
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-brand-text-heading">{member.realName}</span>
                <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700">敏感</span>
              </div>
            </div>
          )}

          {/* 在校信息/工作信息 — 敏感项，仅成员+可见 */}
          {canSeeSensitive && (
            <>
              {!member.graduated && (member.college || member.major) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs mb-2 text-brand-text-muted">在校信息（仅成员可见）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {member.college && <ContactRow label="学院" value={member.college} />}
                    {member.major && <ContactRow label="专业" value={member.major} />}
                  </div>
                </div>
              )}
              {member.graduated && (member.workLocation || member.workPosition) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs mb-2 text-brand-text-muted">工作信息（仅成员可见）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {member.workLocation && <ContactRow label="工作所在地" value={member.workLocation} />}
                    {member.workPosition && <ContactRow label="工作岗位" value={member.workPosition} />}
                  </div>
                </div>
              )}
            </>
          )}

          {member.bio && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs mb-1 text-brand-text-muted">个人简介</div>
              <div className="text-sm text-brand-text-body">
                <RichContent text={member.bio} />
              </div>
            </div>
          )}

          {member.skills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs mb-2 text-brand-text-muted">职能标签</div>
              <div className="flex flex-wrap gap-1.5">
                {member.skills.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded bg-green-50 text-brand-green">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(member.socialLinks?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs mb-2 text-brand-text-muted">个人链接</div>
              <div className="flex flex-wrap gap-3">
                {member.socialLinks!.map((l) => (
                  <Link key={l.id} href={l.url} target="_blank" className="text-sm hover:underline flex items-center gap-1 text-brand-blue">
                    {LINK_ICONS[l.label] || "🔗"} {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* 作品列表 — 橱窗形式 */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm">
        <h2 className="font-semibold mb-4 text-brand-navy">我的作品</h2>
        {userProjects.length === 0 ? (
          <div className="text-center py-10 text-sm text-brand-text-secondary">
            暂无作品
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
            {userProjects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p as any}
                showStatusBadge
                idx={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* 我喜欢的作品 */}
      {likedProjects.length > 0 && (
        <div className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm">
          <h2 className="font-semibold mb-4 text-brand-orange">❤️ 我喜欢的作品</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
            {likedProjects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p as any}
                idx={i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const LINK_ICONS: Record<string, string> = {
  "GitHub": "💻", "B站": "▶️", "个人网站": "🌐", "知乎": "📝",
  "小红书": "📕", "微博": "📢", "抖音": "🎵", "CSDN": "📋",
  "掘金": "💎", "Steam": "🎮", "itch.io": "🕹️",
};

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-brand-text-secondary">{label}</span>
      <span className="text-brand-text-heading">{value}</span>
    </div>
  );
}

function roleBadge(role?: string): string {
  const map: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700",
    MEMBER: "bg-green-50 text-green-800",
    USER: "bg-brand-surface text-brand-navy",
  };
  if (!role || !map[role]) return "bg-gray-200 text-brand-text-body";
  return map[role];
}
