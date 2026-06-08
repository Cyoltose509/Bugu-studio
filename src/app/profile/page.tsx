/**
 * 个人中心
 * 展示用户信息、项目列表、成员信息
 */

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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

  const [user, member, userProjects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, email: true, name: true, role: true, image: true,
        emailVerified: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
    }),
    prisma.clubMember.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true, displayName: true, bio: true, grade: true,
        joinYear: true, graduateYear: true, skills: true,
        githubUrl: true, itchUrl: true, website: true,
        isActive: true,
      },
    }),
    prisma.project.findMany({
      where: { submitterId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, title: true, status: true,
        type: true, developYear: true, createdAt: true,
      },
      take: 10,
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-fade-in space-y-8">
      {/* 头部 */}
      <div className="bg-white rounded-xl border p-8 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* 头像 */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0"
            style={{
              background: user?.role === "ADMIN"
                ? "linear-gradient(135deg, #25547A, #3A7099)"
                : "linear-gradient(135deg, #E38043, #F09055)",
            }}>
            {(user?.name || user?.email || "?")[0].toUpperCase()}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>
              {member?.displayName || user?.name || "未设置昵称"}
            </h1>
            <div className="mt-1 space-y-1">
              <p className="text-sm" style={{ color: "#777" }}>{user?.email}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full" style={roleBadge(user?.role)}>
                  {user?.role === "ADMIN" ? "管理员" :
                   user?.role === "REVIEWER" ? "审核员" :
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
            {user?.role === "ADMIN" && (
              <Link href="/admin" className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">管理后台</Link>
            )}
            <Link href="/profile/edit" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">编辑资料</Link>
            <Link href="/api/auth/signout" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">退出登录</Link>
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

      {/* 成员信息 */}
      {member && (
        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>社团成员信息</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>展示名称</div>
              <div style={{ color: "#333" }}>{member.displayName}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>年级</div>
              <div style={{ color: "#333" }}>{member.grade || "—"}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>入社年份</div>
              <div style={{ color: "#333" }}>{member.joinYear}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#999" }}>状态</div>
              <div style={member.isActive ? { color: "#88C232" } : { color: "#777" }}>
                {member.isActive ? "活跃成员" : member.graduateYear ? `已毕业 (${member.graduateYear}届)` : "已离社"}
              </div>
            </div>
          </div>

          {member.bio && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-1" style={{ color: "#999" }}>个人简介</div>
              <div className="text-sm" style={{ color: "#555" }}>{member.bio}</div>
            </div>
          )}

          {member.skills.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-2" style={{ color: "#999" }}>技能</div>
              <div className="flex flex-wrap gap-1.5">
                {member.skills.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: "#E8F5E9", color: "#88C232" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(member.githubUrl || member.itchUrl || member.website) && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE" }}>
              <div className="text-xs mb-2" style={{ color: "#999" }}>外部链接</div>
              <div className="flex flex-wrap gap-3">
                {member.githubUrl && <Link href={member.githubUrl} target="_blank" className="text-sm hover:underline" style={{ color: "#3388BB" }}>GitHub</Link>}
                {member.itchUrl && <Link href={member.itchUrl} target="_blank" className="text-sm hover:underline" style={{ color: "#3388BB" }}>itch.io</Link>}
                {member.website && <Link href={member.website} target="_blank" className="text-sm hover:underline" style={{ color: "#3388BB" }}>个人网站</Link>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 作品列表 */}
      <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>我的作品</h2>
        {userProjects.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "#777" }}>
            暂无作品
          </div>
        ) : (
          <div className="space-y-3">
            {userProjects.map(p => (
              <Link key={p.id} href={`/projects/${p.slug}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:border-[#3388BB] hover:shadow-sm transition-all"
                style={{ borderColor: "#EEE" }}>
                <div>
                  <div className="font-medium text-sm" style={{ color: "#333" }}>{p.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: "#999" }}>{p.developYear}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#E6F0F8", color: "#25547A" }}>
                      {p.type.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  background: p.status === "PUBLISHED" ? "#E8F5E9" : p.status === "PENDING" ? "#FFF3E0" : "#F5F5F5",
                  color: p.status === "PUBLISHED" ? "#2E7D32" : p.status === "PENDING" ? "#E65100" : "#777",
                }}>
                  {p.status === "PUBLISHED" ? "已发布" : p.status === "PENDING" ? "待审核" : p.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function roleBadge(role?: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    ADMIN: { bg: "#FDE8E8", color: "#C62828" },
    REVIEWER: { bg: "#FFF3E0", color: "#E65100" },
    MEMBER: { bg: "#E8F5E9", color: "#2E7D32" },
    USER: { bg: "#E6F0F8", color: "#25547A" },
  };
  if (!role || !map[role]) return { background: "#EEE", color: "#555" };
  return { background: map[role].bg, color: map[role].color };
}
