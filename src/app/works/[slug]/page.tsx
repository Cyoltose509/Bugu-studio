/**
 * 作品详情页 — 流式渲染，首字节 < 50ms
 *
 * 架构：同步 Shell（立即发送 HTML）→ Suspense 包裹异步数据组件
 * navQuery 使用游标相邻查询代替全表扫描
 */

import { cache } from "react";
import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { auth } from "@/lib/auth/auth";
import { ProjectStatus, UserRole } from "@prisma/client";
import EditButton from "@/components/works/EditButton";
import DeleteOwnProjectButton from "@/components/works/DeleteOwnProjectButton";
import ApproveButton from "@/components/works/ApproveButton";
import CommentSection from "@/components/projects/CommentSection";
import ProjectLikeButton from "@/components/projects/ProjectLikeButton";
import { RichContent } from "@/components/ui/RichContent";

const ImageGallery = nextDynamic(() => import("@/components/projects/ImageGallery"), {
  loading: () => (
    <div className="aspect-video rounded-xl animate-pulse bg-brand-surface" />
  ),
});

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

/* ── 极轻量 metadata 查询（仅 select，无 join，不阻塞首字节） ── */

const getProjectMeta = cache(async (slug: string) => {
  return prisma.project.findUnique({
    where: { slug },
    select: { title: true, description: true, coverImage: true, status: true },
  });
});

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectMeta(slug);
  if (!project || project.status !== ProjectStatus.PUBLISHED) return { title: "作品不存在" };
  return {
    title: project.title,
    description: project.description.slice(0, 160),
    openGraph: { images: project.coverImage ? [project.coverImage] : [] },
  };
}

/* ── 页面内容查询（React.cache + cachedQuery，含所有 join） ── */

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
            user: { select: { id: true, name: true, image: true } },
          },
        },
        _count: { select: { likes: true } },
      },
    })
  , 120);
});

/* ── 高效的相邻作品查询（2 个 findFirst 代替全表 findMany） ── */

async function getAdjacentProjects(
  slug: string, title: string, developYear: number, sort: string
) {
  if (sort === "name") {
    const [prev, next] = await Promise.all([
      prisma.project.findFirst({
        where: { status: ProjectStatus.PUBLISHED, title: { lt: title } },
        orderBy: { title: "desc" },
        select: { slug: true, title: true },
      }),
      prisma.project.findFirst({
        where: { status: ProjectStatus.PUBLISHED, title: { gt: title } },
        orderBy: { title: "asc" },
        select: { slug: true, title: true },
      }),
    ]);
    return { prev, next };
  }

  // date sort: ORDER BY developYear DESC, slug ASC
  const [prev, next] = await Promise.all([
    prisma.project.findFirst({
      where: {
        status: ProjectStatus.PUBLISHED,
        OR: [
          { developYear: { gt: developYear } },
          { developYear, slug: { lt: slug } },
        ],
      },
      orderBy: [{ developYear: "asc" }, { slug: "desc" }],
      select: { slug: true, title: true },
    }),
    prisma.project.findFirst({
      where: {
        status: ProjectStatus.PUBLISHED,
        OR: [
          { developYear: { lt: developYear } },
          { developYear, slug: { gt: slug } },
        ],
      },
      orderBy: [{ developYear: "desc" }, { slug: "asc" }],
      select: { slug: true, title: true },
    }),
  ]);
  return { prev, next };
}

/* ── DetailSkeleton ── */

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div className="lg:col-span-2 space-y-6">
        <div className="aspect-video rounded-xl bg-brand-surface animate-pulse" />
        <div className="space-y-3">
          <div className="h-8 w-48 bg-brand-surface rounded animate-pulse" />
          <div className="h-5 w-64 bg-brand-surface rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-brand-surface rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-brand-surface rounded animate-pulse" />
        </div>
      </div>
      <aside className="space-y-4">
        <div className="h-32 bg-brand-surface rounded-xl animate-pulse" />
        <div className="h-40 bg-brand-surface rounded-xl animate-pulse" />
      </aside>
    </div>
  );
}

/* ── Shell（同步，立即渲染） ── */

export default function WorkDetailPage({ params, searchParams }: PageProps) {
  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <Suspense fallback={
        <nav className="text-sm mb-6 text-brand-text-muted">
          <Link href="/" className="hover:underline text-brand-text-secondary">首页</Link>
          <span className="mx-2">/</span>
          <Link href="/works" className="hover:underline text-brand-text-secondary">作品库</Link>
          <span className="mx-2">/</span>
          <span className="inline-block w-32 h-3 bg-brand-surface rounded animate-pulse align-middle" />
        </nav>
      }>
        <WorkDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/* ── 异步数据组件 ── */

const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT:    "bg-gray-100 text-brand-text-secondary",
  PENDING:  "bg-orange-50 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
  ARCHIVED: "bg-purple-100 text-purple-800",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿", PENDING: "待审核", REJECTED: "已拒绝", ARCHIVED: "已归档",
};

async function WorkDetailContent({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const sort = sp.sort || "date";
  const project = await getProject(slug);

  if (!project) notFound();

  // ── 非 PUBLISHED 作品：仅提交者 / ADMIN 可查看
  const session = project.status !== ProjectStatus.PUBLISHED ? await auth() : null;
  if (!session && project.status !== ProjectStatus.PUBLISHED) notFound();
  if (project.status !== ProjectStatus.PUBLISHED) {
    const role = session!.user?.role as string | undefined;
    const userId = session!.user?.id;
    const isSubmitter = userId === project.submitterId;
    const isStaff = role === "ADMIN";
    if (!isSubmitter && !isStaff) notFound();
  }

  // ── 并行：点赞状态 + 相邻导航 ──
  const [likeResult, navResult] = await Promise.all([
    session?.user?.id
      ? prisma.projectLike.findUnique({
          where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    getAdjacentProjects(slug, project.title, project.developYear, sort),
  ]);

  const initialLiked = !!likeResult;
  const { prev, next } = navResult;

  const isPending = project.status !== ProjectStatus.PUBLISHED;
  const statusBadgeClass = STATUS_BADGE_CLASS[project.status];
  const statusLabel = STATUS_LABEL[project.status];

  const LINK_ICONS: Record<string, string> = {
    steam: "🎮", github: "💻", itch: "🕹️", 网盘: "📁", drive: "📁", 官网: "🌐",
  };
  const externalLinks = [
    ...project.links.map((l) => ({ label: l.label, url: l.url, icon: LINK_ICONS[l.label.toLowerCase()] || "🔗" })),
  ];

  return (
    <>
      <nav className="text-sm mb-6 text-brand-text-muted">
        <Link href="/" className="hover:underline text-brand-text-secondary">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/works" className="hover:underline text-brand-text-secondary">作品库</Link>
        <span className="mx-2">/</span>
        <span className="text-brand-text-body">{project.title}</span>
      </nav>

      {/* ── 上一个 / 下一个导航 ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {prev ? (
            <Link href={`/works/${prev.slug}${sort !== "date" ? `?sort=${sort}` : ""}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-brand-border-subtle text-brand-text-body transition-colors hover:bg-brand-surface-page">
              <span className="text-xs">◀</span>
              <span className="max-w-[200px] truncate">{prev.title}</span>
            </Link>
          ) : <span className="text-sm px-3 py-2 text-gray-300">已是第一个</span>}
        </div>
        <div>
          {next ? (
            <Link href={`/works/${next.slug}${sort !== "date" ? `?sort=${sort}` : ""}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-brand-border-subtle text-brand-text-body transition-colors hover:bg-brand-surface-page">
              <span className="max-w-[200px] truncate">{next.title}</span>
              <span className="text-xs">▶</span>
            </Link>
          ) : <span className="text-sm px-3 py-2 text-gray-300">已是最后一个</span>}
        </div>
      </div>

      {/* 待审核横幅 */}
      {isPending && (
        <div className="rounded-xl border p-4 mb-6 flex items-center gap-3 border-amber-200 bg-amber-50">
          <span className="text-xl">⏳</span>
          <div>
            <div className="font-medium text-sm text-orange-700">
              {project.status === "PENDING" ? "待审核" : project.status === "DRAFT" ? "草稿" : project.status === "REJECTED" ? "已拒绝" : project.status}
            </div>
            <div className="text-xs mt-0.5 text-orange-900">
              {project.status === "PENDING" ? "此作品正在等待管理员审核，仅你和审核人员可查看。" :
               project.status === "DRAFT" ? "此作品为草稿状态，尚未提交审核。" :
               "此作品已被拒绝，你可以修改后重新提交。"}
            </div>
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

          <h1 className="text-3xl font-bold mb-2 text-brand-navy">
            {project.title}
            {statusBadgeClass && (
              <span className={`inline-block ml-3 text-xs px-2 py-0.5 rounded-full align-middle ${statusBadgeClass}`}>{statusLabel}</span>
            )}
          </h1>
          {project.subtitle && <p className="text-lg mb-4 text-brand-text-secondary">{project.subtitle}</p>}

          {/* 点赞 + 编辑 + 删除 + 审核 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <ProjectLikeButton projectId={project.id} initialCount={(project as any)._count?.likes ?? 0} initialLiked={initialLiked} />
            <EditButton slug={project.slug} submitterId={project.submitterId} />
            <DeleteOwnProjectButton projectId={project.id} submitterId={project.submitterId} />
            {session?.user?.role === "ADMIN" && (project.status === "PENDING" || project.status === "REJECTED") && (
              <ApproveButton projectId={project.id} />
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {project.tags.map(({ tag }) => (
              <Link key={tag.slug} href={`/works?tag=${tag.slug}`} className="text-sm px-2.5 py-1 rounded-full transition-opacity hover:opacity-80" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>{tag.name}</Link>
            ))}
          </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-brand-navy">作品简介</h2>
        <p className="whitespace-pre-wrap leading-relaxed text-brand-text-body">
          <RichContent text={project.description} />
        </p>
      </div>

          {/* ── 留言板 ── */}
          <Suspense fallback={<div className="text-xs text-brand-text-muted">留言加载中…</div>}>
            <CommentSection projectId={project.id} />
          </Suspense>
        </div>

        {/* 侧边栏 */}
        <aside className="space-y-6">
          {externalLinks.length > 0 && (
            <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
              <h3 className="font-semibold mb-3 text-brand-navy">获取游戏</h3>
              <div className="space-y-2">
                {externalLinks.map((link) => (
                  <a key={link.label} href={link.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors hover:shadow-sm hover:bg-brand-border-subtle text-brand-text-heading bg-brand-surface">
                    <span>{link.icon}</span><span>{link.label}</span><span className="ml-auto text-brand-text-muted">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
            <h3 className="font-semibold mb-3 text-brand-navy">项目信息</h3>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="类型" value={project.type} />
              <InfoRow label="开发年份" value={String(project.developYear)} />
              {project.techStack.length > 0 && (
                <div>
                  <dt className="mb-1 text-brand-text-secondary">技术栈</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {project.techStack.map((tech) => (
                      <span key={tech} className="text-xs px-2 py-0.5 rounded bg-brand-surface text-brand-blue">{tech}</span>
                    ))}
                  </dd>
                </div>
              )}
              {project.awards && project.awards.length > 0 && (
                <div>
                  <dt className="mb-1 text-brand-text-secondary">🏆 所获奖项</dt>
                  <dd className="space-y-1">
                    {project.awards.map((award, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded block bg-[#c4a86a]/[0.12] text-[#8B7355]">{award}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

      {project.members.length > 0 && (
            <div className="rounded-xl p-5 border bg-brand-surface-page border-brand-border-subtle">
              <h3 className="font-semibold mb-3 text-brand-navy">开发团队</h3>
              <div className="space-y-3">
                {project.members.map((pm) => {
                  const isExternal = !pm.member && !pm.user;
                  const displayName = pm.member?.displayName || (pm as any).user?.name || pm.externalName || "未知";
                  const avatarUrl =
                    pm.member ? (pm.member.user?.image || pm.member.avatar) :
                    (pm as any).user?.image || null;

                  const inner = (
                    <>
                      <div className={`
                        w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden
                        ${pm.member ? "bg-gradient-to-br from-brand-orange to-brand-orange-light" : (pm as any).userId ? "bg-brand-blue" : "bg-gray-500"}
                      `}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : displayName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-brand-text-heading">{displayName}</div>
                        <div className="text-xs text-brand-text-muted">{pm.roles?.join("、") || ""}</div>
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
                  const href = pm.member ? `/members/${pm.member.id}` : (pm as any).userId ? `/profile?id=${(pm as any).userId}` : undefined;
                  if (href) {
                    return (
                      <Link key={pm.id} href={href} className="flex items-center gap-3 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-brand-surface">
                        {inner}
                      </Link>
                    );
                  }
                  return (
                    <div key={pm.id} className="flex items-center gap-3 rounded-lg p-1.5 -mx-1.5">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const TYPE_LABELS: Record<string, string> = { 
    IN_DEVELOPMENT: "开发阶段", 
    TRIAL_DEMO: "提供试玩", 
    MINI_GAME: "小游戏",
    OFFICIAL_RELEASE: "正式上架",
  };
  return (
    <div className="flex justify-between">
      <dt className="text-brand-text-secondary">{label}</dt>
      <dd className="text-brand-text-heading">{TYPE_LABELS[value] || value}</dd>
    </div>
  );
}
