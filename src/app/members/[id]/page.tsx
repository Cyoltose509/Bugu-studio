import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import MemberContactInfo from "@/components/members/MemberContactInfo";
import MemberSensitiveInfo from "@/components/members/MemberSensitiveInfo";
import MemberWorkHistory from "@/components/members/MemberWorkHistory";
import AdminMemberEditor from "@/components/members/AdminMemberEditor";
import { RichContent } from "@/components/ui/RichContent";
import { positionLabel, positionColor } from "@/lib/position";
import ProjectCard from "@/components/projects/ProjectCard";

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
          orderBy: [{ project: { developYear: "desc" } }, { project: { publishedAt: "desc" } }, { sortOrder: "asc" }],
          where: { project: { status: ProjectStatus.PUBLISHED } },
          include: {
            project: {
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
      <nav className="text-sm mb-8 text-brand-text-muted">
        <Link href="/" className="hover:underline text-brand-text-secondary">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/members" className="hover:underline text-brand-text-secondary">成员列表</Link>
        <span className="mx-2">/</span>
        <span className="text-brand-text-body">{member.displayName}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主区域 */}
        <div className="lg:col-span-2">
          {/* 顶部信息卡片 */}
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-10 p-6 rounded-xl border bg-brand-surface-page border-brand-border-subtle">
            {/* 头像 — 移动端缩小 */}
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full shrink-0 overflow-hidden">
              {(member.user?.image || member.avatar) ? (
                <Image src={(member.user?.image || member.avatar)!} alt={member.displayName} width={96} height={96} className="w-full h-full object-cover" referrerPolicy="no-referrer" sizes="(max-width: 640px) 64px, 96px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white bg-[linear-gradient(135deg,#E38043,#F09055)]">
                  {member.displayName[0]}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-brand-navy">{member.displayName}</h1>
                {member.position && member.position !== "MEMBER" && (() => {
                  const color = positionColor(member.position);
                  const bgClass = color.bg === "#25547A" ? "bg-brand-navy" : color.bg === "#999999" ? "bg-[#999999]" : "bg-[#FFE384]";
                  const textClass = color.text === "#fff" ? "text-white" : "text-[#5C4B00]";
                  return (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${bgClass} ${textClass}`}>
                      {positionLabel(member.position)}
                    </span>
                  );
                })()}
                {!member.graduated ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-brand-green/15 text-brand-green">在读</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-brand-green/[0.08] text-brand-text-muted">已毕业</span>
                )}
              </div>
              <div className="text-sm space-y-1 text-brand-text-secondary">
                {member.grade && <p>{member.grade}{member.graduated ? " · 已毕业" : ""}</p>}
                {!member.grade && member.graduated && <p>已毕业</p>}
              </div>

              {/* 职能标签 */}
              {member.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {member.skills.map((skill) => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded bg-brand-surface text-brand-blue">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 个人简介 — 优先用成员 bio，兜底用户 bio */}
          {(() => {
            const bioText = member.bio ?? member.user?.bio;
            if (!bioText) return null;
            return (
              <div className="mb-10">
                <h2 className="text-xl font-semibold mb-3 text-brand-navy">个人简介</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-brand-text-body">
                  <RichContent text={bioText} />
                </p>
              </div>
            );
          })()}

          {/* 参与项目 */}
          {member.projectMembers.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-brand-navy">
                参与项目 <span className="text-sm font-normal text-brand-text-muted">共 {member.projectMembers.length} 个</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {member.projectMembers.map(({ project }) => (
                  <ProjectCard
                    key={project.id}
                    project={project as any}
                  />
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
            <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
              <h3 className="font-semibold mb-3 text-brand-navy">外部链接</h3>
              <div className="space-y-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors hover:bg-[#D0DEE8] text-brand-text-heading bg-brand-surface"
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                    <span className="ml-auto text-brand-text-muted">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 信息摘要 */}
          <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
            <h3 className="font-semibold mb-3 text-brand-navy">个人信息</h3>
            <dl className="space-y-2.5 text-sm">
              {member.graduated && <InfoRow label="毕业状态" value="已毕业" />}
              {!member.graduated && <InfoRow label="在读状态" value="在读" />}
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
      <dt className="text-brand-text-secondary">{label}</dt>
      <dd className="text-brand-text-heading">{value}</dd>
    </div>
  );
}
