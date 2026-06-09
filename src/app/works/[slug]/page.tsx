/**
 * 作品详情页 — ISR 静态缓存，无 auth() 阻塞
 *
 * 优化：React.cache 让 generateMetadata 和页面共享同一查询
 */

import { cache } from "react";
import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { auth } from "@/lib/auth/auth";
import { ProjectStatus, UserRole } from "@prisma/client";
import EditButton from "./EditButton";
import CommentSection from "@/components/CommentSection";
import ProjectLikeButton from "@/components/ProjectLikeButton";
import ImageGallery from "@/components/ImageGallery";

export const revalidate = 60;

interface PageProps { params: Promise<{ slug: string }> }

/* ── 共享查询（React.cache 去重） ── */

const getProject = cache(async (slug: string) => {
  return cachedQuery(`project:detail:${slug}`, () =>
    prisma.project.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        links: { orderBy: { sortOrder: "asc" } },
        tags: { include: { tag: true } },
        members: {
          orderBy: { sortOrder: "asc" },
          include: {
            member: {
              select: {
                id: true, displayName: true, avatar: true, grade: true,
                user: { select: { image: true } },
              },
            },
          },
        },
        _count: { select: { likes: true } },
      },
    })
  , 120);
});

/* ── Metadata（复用同一查询，无额外 DB 开销） ── */

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project || project.status !== ProjectStatus.PUBLISHED) return { title: "作品不存在" };
  return {
    title: project.title,
    description: project.description.slice(0, 160),
    openGraph: { images: project.coverImage ? [project.coverImage] : [] },
  };
}

/* ── 页面主体 ── */

export default async function WorkDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) notFound();

  // 非 PUBLISHED 作品：仅提交者 / ADMIN / REVIEWER 可查看
  const session = project.status !== ProjectStatus.PUBLISHED ? await auth() : null;
  if (!session && project.status !== ProjectStatus.PUBLISHED) notFound();
  if (project.status !== ProjectStatus.PUBLISHED) {
    const role = session!.user?.role as string | undefined;
    const userId = session!.user?.id;
    const isSubmitter = userId === project.submitterId;
    const isStaff = role === "ADMIN" || role === "REVIEWER";
    if (!isSubmitter && !isStaff) notFound();
  }

  // 查询当前用户是否已点赞（仅非 PUBLISHED 时 session 可用）
  let initialLiked: boolean | undefined;
  if (session?.user?.id) {
    const existing = await prisma.projectLike.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
      select: { id: true },
    });
    initialLiked = !!existing;
  }

  const isPending = project.status !== ProjectStatus.PUBLISHED;

  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT:    { bg: "#F5F5F5", color: "#777",   label: "草稿" },
    PENDING:  { bg: "#FFF3E0", color: "#E65100", label: "待审核" },
    REJECTED: { bg: "#FDE8E8", color: "#C62828", label: "已拒绝" },
    ARCHIVED: { bg: "#EDE7F6", color: "#5E35B1", label: "已归档" },
  };
  const statusBadge = STATUS_BADGE[project.status];

  const LINK_ICONS: Record<string, string> = {
    steam: "🎮", github: "💻", itch: "🕹️", 网盘: "📁", drive: "📁", 官网: "🌐",
  };
  const externalLinks = [
    ...project.links.map((l) => ({ label: l.label, url: l.url, icon: LINK_ICONS[l.label.toLowerCase()] || "🔗" })),
    ...[{ label: "Steam", url: project.steamUrl }, { label: "GitHub", url: project.githubUrl }, { label: "itch.io", url: project.itchUrl },
       { label: "百度网盘", url: project.panUrl }, { label: "Google Drive", url: project.driveUrl }, { label: "OneDrive", url: project.onedriveUrl },
       { label: "官网", url: project.websiteUrl }]
      .filter((l) => l.url && !project.links.some((pl) => pl.url === l.url))
      .map((l) => ({ ...l, icon: LINK_ICONS[l.label.toLowerCase()] || "🔗" })),
  ];

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <nav className="text-sm mb-6" style={{ color: "#999" }}>
        <Link href="/" className="hover:underline" style={{ color: "#777" }}>首页</Link>
        <span className="mx-2">/</span>
        <Link href="/works" className="hover:underline" style={{ color: "#777" }}>作品库</Link>
        <span className="mx-2">/</span>
        <span style={{ color: "#555" }}>{project.title}</span>
      </nav>

      {/* 待审核横幅 */}
      {isPending && (
        <div className="rounded-xl border p-4 mb-6 flex items-center gap-3" style={{ borderColor: "#FFCC80", background: "#FFF8E1" }}>
          <span className="text-xl">⏳</span>
          <div>
            <div className="font-medium text-sm" style={{ color: "#E65100" }}>
              {project.status === "PENDING" ? "待审核" : project.status === "DRAFT" ? "草稿" : project.status === "REJECTED" ? "已拒绝" : project.status}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "#BF360C" }}>
              {project.status === "PENDING" ? "此作品正在等待管理员审核，仅你和审核人员可查看。" :
               project.status === "DRAFT" ? "此作品为草稿状态，尚未提交审核。" :
               "此作品已被拒绝，你可以修改后重新提交。"}
            </div>
          </div>
          <div className="ml-auto">
            <Link href={`/works/${project.slug}/edit`}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: "#3388BB" }}>
              ✏️ 编辑
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 主内容区 */}
        <div className="lg:col-span-2">
          <ImageGallery
            coverImage={project.coverImage}
            coverAlt={project.title}
            screenshots={project.images}
          />

          <h1 className="text-3xl font-bold mb-2" style={{ color: "#25547A" }}>
            {project.title}
            {statusBadge && (
              <span className="inline-block ml-3 text-xs px-2 py-0.5 rounded-full align-middle" style={{ background: statusBadge.bg, color: statusBadge.color }}>{statusBadge.label}</span>
            )}
          </h1>
          {project.subtitle && <p className="text-lg mb-4" style={{ color: "#777" }}>{project.subtitle}</p>}

          {/* 点赞 + 编辑 */}
          <div className="flex items-center gap-3 mb-4">
            <ProjectLikeButton projectId={project.id} initialCount={(project as any)._count?.likes ?? 0} initialLiked={initialLiked} />
            <EditButton slug={project.slug} submitterId={project.submitterId} />
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {project.tags.map(({ tag }) => (
              <Link key={tag.slug} href={`/works?tag=${tag.slug}`} className="text-sm px-2.5 py-1 rounded-full transition-opacity hover:opacity-80" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>{tag.name}</Link>
            ))}
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3" style={{ color: "#25547A" }}>作品简介</h2>
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>{project.description}</p>
          </div>

          {project.devlog && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: "#25547A" }}>开发日志</h2>
              <div className="rounded-xl p-6 whitespace-pre-wrap leading-relaxed border" style={{ background: "#F0F5F9", color: "#555", borderColor: "#D0DEE8" }}>{project.devlog}</div>
            </div>
          )}

          {/* ── 留言板 ── */}
          <Suspense fallback={<div className="text-xs" style={{ color: "#999" }}>留言加载中…</div>}>
            <CommentSection projectId={project.id} />
          </Suspense>
        </div>

        {/* 侧边栏 */}
        <aside className="space-y-6">
          {externalLinks.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
              <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>获取游戏</h3>
              <div className="space-y-2">
                {externalLinks.map((link) => (
                  <a key={link.label} href={link.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors hover:shadow-sm hover:bg-[#D0DEE8]" style={{ color: "#333", background: "#E6F0F8" }}>
                    <span>{link.icon}</span><span>{link.label}</span><span className="ml-auto" style={{ color: "#999" }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>项目信息</h3>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="类型" value={project.type} />
              <InfoRow label="开发年份" value={String(project.developYear)} />
              {project.techStack.length > 0 && (
                <div>
                  <dt className="mb-1" style={{ color: "#777" }}>技术栈</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {project.techStack.map((tech) => (
                      <span key={tech} className="text-xs px-2 py-0.5 rounded" style={{ background: "#E6F0F8", color: "#3388BB" }}>{tech}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {project.members.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
              <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>开发团队</h3>
              <div className="space-y-3">
                {project.members.map((pm) => {
                  const isExternal = !pm.member;
                  const displayName = pm.member?.displayName || pm.externalName || "未知";
                  const avatarUrl = pm.member ? (pm.member.user?.image || pm.member.avatar) : null;

                  const inner = (
                    <>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden`}
                        style={{ background: isExternal ? "#6B7280" : "linear-gradient(135deg, #E38043, #F09055)" }}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : displayName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: "#333" }}>{displayName}</div>
                        <div className="text-xs" style={{ color: "#999" }}>{pm.roles?.join("、") || ""}</div>
                      </div>
                    </>
                  );

                  if (isExternal) {
                    return (
                      <div key={pm.id} className="flex items-center gap-3 rounded-lg p-1.5 -mx-1.5">
                        {inner}
                      </div>
                    );
                  }
                  return (
                    <Link key={pm.id} href={`/members/${pm.member!.id}`} className="flex items-center gap-3 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-[#E6F0F8]">
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const TYPE_LABELS: Record<string, string> = { DEMO: "Demo 演示", STEAM: "Steam 发布", ITCH: "itch.io 发布", OTHER: "其他" };
  return (
    <div className="flex justify-between">
      <dt style={{ color: "#777" }}>{label}</dt>
      <dd style={{ color: "#333" }}>{TYPE_LABELS[value] || value}</dd>
    </div>
  );
}
