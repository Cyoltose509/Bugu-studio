/**
 * 成员详情页
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import MemberContactInfo from "./MemberContactInfo";
import MemberSensitiveInfo from "./MemberSensitiveInfo";
import MemberWorkHistory from "./MemberWorkHistory";
import AdminMemberEditor from "./AdminMemberEditor";

// ISR: 成员信息变化少，5 分钟缓存
export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await cachedQuery(`member:meta:${id}`, () =>
    prisma.clubMember.findUnique({
      where: { id },
      select: { displayName: true, bio: true },
    })
  , 300);
  if (!member) return { title: "成员不存在" };
  return {
    title: member.displayName,
    description: member.bio?.slice(0, 160) || `${member.displayName} 的成员页面`,
  };
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  const member = await cachedQuery(`member:detail:${id}`, async () => {
    const m = await prisma.clubMember.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, role: true, image: true, bio: true } },
        socialLinks: { orderBy: { sortOrder: "asc" } },
        workExperiences: { orderBy: { sortOrder: "asc" } },
        projectMembers: {
          orderBy: { sortOrder: "asc" },
          where: { project: { status: ProjectStatus.PUBLISHED } },
          include: {
            project: {
              select: {
                id: true,
                slug: true,
                title: true,
                type: true,
                coverImage: true,
                developYear: true,
              },
            },
          },
        },
      },
    });

    if (!m) return null;

    // ── 防御性查询：也加载成员作为提交者的项目（修复历史孤儿数据）──
    const existingProjectIds = new Set(m.projectMembers.map((pm) => pm.project.id));
    const submittedProjects = m.userId
      ? await prisma.project.findMany({
          where: {
            submitterId: m.userId,
            id: { notIn: [...existingProjectIds] },
            status: ProjectStatus.PUBLISHED,
          },
          select: {
            id: true, slug: true, title: true,
            type: true, coverImage: true, developYear: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // 合并：将提交者项目包装成类似 ProjectMember 的结构
    const extraMembers = submittedProjects.map((p) => ({
      id: `orphan-${p.id}`,
      projectId: p.id,
      memberId: m.id,
      externalName: null,
      roles: ["制作"],
      sortOrder: 999,
      project: p,
    }));

    return {
      ...m,
      projectMembers: [...m.projectMembers, ...extraMembers],
    };
  }, 300);

  if (!member) notFound();

  const LINK_ICONS: Record<string, string> = {
    "GitHub": "💻", "B站": "▶️", "个人网站": "🌐", "知乎": "📝",
    "小红书": "📕", "微博": "📢", "抖音": "🎵", "CSDN": "📋",
    "掘金": "💎", "Steam": "🎮", "itch.io": "🕹️",
  };

  const links = (member.socialLinks ?? []).map((l) => ({
    label: l.label,
    url: l.url,
    icon: LINK_ICONS[l.label] || "🔗",
  }));

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      {/* 面包屑 */}
      <nav className="text-sm mb-8" style={{ color: "#999" }}>
        <Link href="/" className="hover:underline" style={{ color: "#777" }}>首页</Link>
        <span className="mx-2">/</span>
        <Link href="/members" className="hover:underline" style={{ color: "#777" }}>成员列表</Link>
        <span className="mx-2">/</span>
        <span style={{ color: "#555" }}>{member.displayName}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主区域 */}
        <div className="lg:col-span-2">
          {/* 顶部信息卡片 */}
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-10 p-6 rounded-xl border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            {/* 头像 — 移动端缩小 */}
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full shrink-0 overflow-hidden">
              {(member.user?.image || member.avatar) ? (
                <Image src={(member.user?.image || member.avatar)!} alt={member.displayName} width={96} height={96} className="w-full h-full object-cover" referrerPolicy="no-referrer" sizes="(max-width: 640px) 64px, 96px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white" style={{ background: "linear-gradient(135deg, #E38043, #F09055)" }}>
                  {member.displayName[0]}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>{member.displayName}</h1>
                {member.position && member.position !== "MEMBER" && (
                  <span className="text-xs px-2 py-1 rounded font-medium" style={member.position === "FOUNDER" ? { background: "#FFE384", color: "#5C4B00" } : { background: "#25547A", color: "#fff" }}>
                    {member.position === "PRESIDENT" ? "社长" : member.position === "VICE_PRESIDENT" ? "副社长" : member.position === "FOUNDER" ? "创始人" : member.position}
                  </span>
                )}
                {member.isActive ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(136,194,50,0.15)", color: "#88C232" }}>在读</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(136,194,50,0.08)", color: "#999" }}>已毕业</span>
                )}
              </div>
              <div className="text-sm space-y-1" style={{ color: "#777" }}>
                {member.grade && <p>{member.grade}{member.graduated ? " · 已毕业" : ""}</p>}
                {!member.grade && member.graduated && <p>已毕业</p>}
              </div>

              {/* 职能标签 */}
              {member.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {member.skills.map((skill) => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded" style={{ background: "#E6F0F8", color: "#3388BB" }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 个人简介 — 优先用成员 bio，兜底用户 bio */}
          {(member.bio || member.user?.bio) && (
            <div className="mb-10">
              <h2 className="text-xl font-semibold mb-3" style={{ color: "#25547A" }}>个人简介</h2>
              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>
                {member.bio || member.user!.bio}
              </p>
            </div>
          )}

          {/* 参与项目 */}
          {member.projectMembers.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "#25547A" }}>
                参与项目 <span className="text-sm font-normal" style={{ color: "#999" }}>共 {member.projectMembers.length} 个</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {member.projectMembers.map(({ project, roles }, idx) => (
                  <div key={project.id}>
                    <Link
                      href={`/works/${project.slug}`}
                      className="game-card group bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md block"
                      style={{ borderColor: "#D0DEE8" }}
                    >
                      <div className="relative aspect-video" style={{ background: "#E6F0F8" }}>
                        {project.coverImage ? (
                          <Image src={project.coverImage} alt={project.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold group-hover:text-[#3388BB] transition-colors line-clamp-1" style={{ color: "#333" }}>{project.title}</h3>
                        <p className="text-xs mt-1" style={{ color: "#777" }}>{roles?.join("、") || "参与"} · {project.developYear}</p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧边栏 */}
        <aside className="space-y-6">
          {/* 管理员编辑面板 */}
          <AdminMemberEditor
            memberId={member.id}
            currentGrade={member.grade}
            currentJoinYear={member.joinYear ?? null}
            currentPosition={member.position || "MEMBER"}
            isActive={member.isActive}
          />

          {/* 联系方式 — 敏感项，客户端判断可见性 */}
          <MemberContactInfo data={{
            location: member.location,
            phone: member.phone,
            wechat: member.wechat,
            qq: member.qq,
          }} />

          {/* 敏感信息 — 仅社团成员可见 */}
          <MemberSensitiveInfo data={{
            realName: member.realName,
            college: member.college,
            major: member.major,
            workLocation: member.workLocation,
            workPosition: member.workPosition,
            isGraduated: member.graduated,
          }} />

          {/* 工作经历 — 仅社团成员可见 */}
          <MemberWorkHistory experiences={member.workExperiences} />

          {/* 外部链接 */}
          {links.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
              <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>外部链接</h3>
              <div className="space-y-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors hover:bg-[#D0DEE8]"
                    style={{ color: "#333", background: "#E6F0F8" }}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                    <span className="ml-auto" style={{ color: "#999" }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 信息摘要 */}
          <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>个人信息</h3>
            <dl className="space-y-2.5 text-sm">
              {member.graduated && <InfoRow label="毕业状态" value="已毕业" />}
              {!member.graduated && member.isActive && <InfoRow label="在读状态" value="在读" />}
              {member.joinYear && <InfoRow label="入社年份" value={String(member.joinYear)} />}
              {member.grade && <InfoRow label="年级" value={`${member.grade}级`} />}
              <InfoRow label="参与项目数" value={String(member.projectMembers.length)} />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: "#777" }}>{label}</dt>
      <dd style={{ color: "#333" }}>{value}</dd>
    </div>
  );
}
