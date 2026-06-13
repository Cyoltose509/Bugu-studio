/**
 * 个人中心
 * - 普通用户：查看/编辑自己的资料
 * - 管理员：可通过 ?id=xxx 查看任意用户资料
 */
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import Link from "next/link";
import MiniLikeButton from "@/components/projects/MiniLikeButton";
import ProjectCard from "@/components/projects/ProjectCard";
import { RichContent } from "@/components/ui/RichContent";
import ProjectCoverImage from "@/components/projects/ProjectCoverImage";
import { positionLabel, positionColor } from "@/lib/position";

export const dynamic = "force-dynamic";

const LINK_ICONS: Record<string, string> = {
  "GitHub": "💻", "B站": "▶️", "个人网站": "🌐", "知乎": "📝",
  "小红书": "📕", "微博": "📢", "抖音": "🎵", "CSDN": "📋",
  "掘金": "💎", "Steam": "🎮", "itch.io": "🕹️",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: "#777" }}>请先登录</p>
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
        <div className="rounded-xl border p-4 flex items-center justify-between shadow-sm" style={{ borderColor: "#FDE8E8", background: "#FFF5F5" }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">🛡️</span>
            <div>
              <p className="text-sm font-medium" style={{ color: "#C62828" }}>管理员视图 — 正在查看 {user?.name || user?.email || "未知用户"} 的资料</p>
              <p className="text-xs" style={{ color: "#E53935" }}>你无法编辑此用户的资料，仅可查看</p>
            </div>
          </div>
          <Link href="/admin/users" className="text-sm px-3 py-1.5 rounded-lg border hover:bg-white transition-colors" style={{ borderColor: "#FDE8E8", color: "#C62828" }}>← 返回用户管理</Link>
        </div>
      )}

      {/* 头部 */}
      <div className="bg-white rounded-xl border p-8 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* 头像 */}
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || ""}
              className="w-20 h-20 rounded-full object-cover border-2 shrink-0"
              style={{ borderColor: "#25547A" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0"
              style={{
                background: user?.role === "ADMIN"
                  ? "linear-gradient(135deg, #25547A, #3A7099)"
                  : "linear-gradient(135deg, #E38043, #F09055)",
              }}>
              {(user?.name || user?.email || "?")[0].toUpperCase()}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>
              {member?.displayName || user?.name || "未设置昵称"}
            </h1>
            <div className="mt-1 space-y-1">
              <p className="text-sm" style={{ color: "#777" }}>{user?.email}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full" style={roleBadge(user?.role)}>
                  {user?.role === "ADMIN" ? "管理员" :
                   user?.role === "MEMBER" ? "社团成员" : "注册用户"}
                </span>
                {user?.emailVerified && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E8F5E9", color: "#2E7D32" }}>
                    已验证
                  </span>
                )}
                {user?.isActive === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#FDE8E8", color: "#C62828" }}>
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
                <Link href="/auth/signout" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">退出登录</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 账号信息 */}
      <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>账号信息</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs mb-0.5" style={{ color: "#999" }}>邮箱</div>
            <div style={{ color: "#333" }}>{user?.email}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5" style={{ color: "#999" }}>角色</div>
            <div style={{ color: "#333" }}>{user?.role}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5" style={{ color: "#999" }}>注册时间</div>
            <div style={{ color: "#333" }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "—"}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5" style={{ color: "#999" }}>最后登录</div>
            <div style={{ color: "#333" }}>{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("zh-CN") : "—"}</div>
          </div>
        </div>
      </div>

      {/* 个人介绍 — 所有用户可见 */}
      {user?.bio && (
        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-3" style={{ color: "#25547A" }}>个人介绍</h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>
            <RichContent text={user.bio} />
          </p>
        </div>
      )}

      {/* 成员信息 */}
      {member && (() => {
        // 敏感信息可见性：自己看自己 或 查看者角色 >= MEMBER
        const canSeeSensitive = !isAdminView || (session.user.role !== "USER");
        return (
        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>社团成员信息</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>展示名称</div>
              <div className="flex items-center gap-1.5" style={{ color: "#333" }}>
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
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>年级</div>
              <div style={{ color: "#333" }}>{member.grade != null ? `${member.grade}级` : "—"}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>入社年份</div>
              <div style={{ color: "#333" }}>{member.joinYear != null ? `${member.joinYear}年` : "—"}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>毕业状态</div>
              <div style={member.graduated ? { color: "#E38043" } : { color: "#3388BB" }}>
                {member.graduated ? "已毕业" : "在读"}
              </div>
            </div>
          </div>

          {/* 联系方式 — 敏感项，仅成员+可见 */}
          {canSeeSensitive && (member.location || member.phone || member.wechat || member.qq) && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-2" style={{ color: "#999" }}>联系方式（仅成员可见）</div>
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
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-2 flex items-center gap-1" style={{ color: "#999" }}>
                🔒 真实姓名（仅成员可见）
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#333" }}>{member.realName}</span>
                <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: "#FDE8E8", color: "#C62828" }}>敏感</span>
              </div>
            </div>
          )}

          {/* 在校信息/工作信息 — 敏感项，仅成员+可见 */}
          {canSeeSensitive && (
            <>
              {!member.graduated && (member.college || member.major) && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
                  <div className="text-xs mb-2" style={{ color: "#999" }}>在校信息（仅成员可见）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {member.college && <ContactRow label="学院" value={member.college} />}
                    {member.major && <ContactRow label="专业" value={member.major} />}
                  </div>
                </div>
              )}
              {member.graduated && (member.workLocation || member.workPosition) && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
                  <div className="text-xs mb-2" style={{ color: "#999" }}>工作信息（仅成员可见）</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {member.workLocation && <ContactRow label="工作所在地" value={member.workLocation} />}
                    {member.workPosition && <ContactRow label="工作岗位" value={member.workPosition} />}
                  </div>
                </div>
              )}
            </>
          )}

          {member.bio && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-1" style={{ color: "#999" }}>个人简介</div>
              <div className="text-sm" style={{ color: "#555" }}>
                <RichContent text={member.bio} />
              </div>
            </div>
          )}

          {member.skills.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-2" style={{ color: "#999" }}>职能标签</div>
              <div className="flex flex-wrap gap-1.5">
                {member.skills.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: "#E8F5E9", color: "#88C232" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(member.socialLinks?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-2" style={{ color: "#999" }}>个人链接</div>
              <div className="flex flex-wrap gap-3">
                {member.socialLinks!.map((l) => (
                  <Link key={l.id} href={l.url} target="_blank" className="text-sm hover:underline flex items-center gap-1" style={{ color: "#3388BB" }}>
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
      <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>我的作品</h2>
        {userProjects.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "#777" }}>
            暂无作品
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#E38043" }}>❤️ 我喜欢的作品</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "#777" }}>{label}</span>
      <span style={{ color: "#333" }}>{value}</span>
    </div>
  );
}

function roleBadge(role?: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    ADMIN: { bg: "#FDE8E8", color: "#C62828" },
    MEMBER: { bg: "#E8F5E9", color: "#2E7D32" },
    USER: { bg: "#E6F0F8", color: "#25547A" },
  };
  if (!role || !map[role]) return { background: "#EEE", color: "#555" };
  return { background: map[role].bg, color: map[role].color };
}
