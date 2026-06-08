/**
 * 作品详情页
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { canEditProject } from "@/lib/auth/rbac";
import { ProjectStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // metadata 查询放宽：不限制状态，这样 SEO 不友好但至少不会崩溃
  // 真正的权限控制在页面组件中
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { title: true, description: true, coverImage: true, status: true },
  });

  if (!project) return { title: "作品不存在" };

  return {
    title: project.title,
    description: project.description.slice(0, 160),
    openGraph: {
      images: project.coverImage ? [project.coverImage] : [],
    },
  };
}

export default async function WorkDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role as string | undefined;

  // 先查项目基本信息，判断访问权限
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      links: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      members: {
        orderBy: { sortOrder: "asc" },
        include: {
          member: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              grade: true,
              user: { select: { image: true } },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  // 非公开作品仅提交者和管理员可见
  const canView = project.status === ProjectStatus.PUBLISHED
    || (userId && (userId === project.submitterId || userRole === "ADMIN" || userRole === "REVIEWER"));
  if (!canView) notFound();

  const canEdit = userId ? canEditProject(userRole as any, userId, project.submitterId) : false;

  // 状态徽章
  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT: { bg: "#F5F5F5", color: "#777", label: "草稿" },
    PENDING: { bg: "#FFF3E0", color: "#E65100", label: "待审核" },
    PUBLISHED: { bg: "#E8F5E9", color: "#2E7D32", label: "已发布" },
    REJECTED: { bg: "#FDE8E8", color: "#C62828", label: "已拒绝" },
    ARCHIVED: { bg: "#EDE7F6", color: "#5E35B1", label: "已归档" },
  };
  const statusBadge = STATUS_BADGE[project.status];

  // 动态外部链接（新） + 兼容旧版 flat URL
  const LINK_ICONS: Record<string, string> = {
    steam: "🎮", github: "💻", itch: "🕹️", 网盘: "📦", drive: "📁", 官网: "🌐", b站: "▶️",
  };
  const externalLinks = [
    ...project.links.map((l) => ({
      label: l.label,
      url: l.url,
      icon: LINK_ICONS[l.label.toLowerCase()] || "🔗",
    })),
    // 兼容旧数据（flat URL 字段）
    ...([
      { label: "Steam", url: project.steamUrl },
      { label: "GitHub", url: project.githubUrl },
      { label: "itch.io", url: project.itchUrl },
      { label: "百度网盘", url: project.panUrl },
      { label: "Google Drive", url: project.driveUrl },
      { label: "OneDrive", url: project.onedriveUrl },
      { label: "官网", url: project.websiteUrl },
    ].filter((l) => l.url && !project.links.some((pl) => pl.url === l.url)) as { label: string; url: string; icon?: string }[])
      .map((l) => ({ ...l, icon: LINK_ICONS[l.label.toLowerCase()] || "🔗" })),
  ];

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      {/* 面包屑 */}
      <nav className="text-sm mb-6" style={{ color: "#999" }}>
        <Link href="/" className="hover:underline" style={{ color: "#777" }}>首页</Link>
        <span className="mx-2">/</span>
        <Link href="/works" className="hover:underline" style={{ color: "#777" }}>作品库</Link>
        <span className="mx-2">/</span>
        <span style={{ color: "#555" }}>{project.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主内容 */}
        <div className="lg:col-span-2">
          {/* 封面 */}
          {project.coverImage && (
            <div className="relative aspect-video w-full max-w-2xl rounded-xl overflow-hidden mb-6 border" style={{ borderColor: "#D0DEE8" }}>
              <Image
                src={project.coverImage}
                alt={project.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 672px, 672px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <h1 className="text-3xl font-bold mb-2" style={{ color: "#25547A" }}>
            {project.title}
            {project.status !== ProjectStatus.PUBLISHED && statusBadge && (
              <span className="inline-block ml-3 text-xs px-2 py-0.5 rounded-full align-middle" style={{ background: statusBadge.bg, color: statusBadge.color }}>
                {statusBadge.label}
              </span>
            )}
          </h1>
          {project.subtitle && (
            <p className="text-lg mb-4" style={{ color: "#777" }}>{project.subtitle}</p>
          )}

          {/* 操作按钮 */}
          {canEdit && (
            <div className="flex gap-2 mb-6">
              <Link
                href={`/works/${project.slug}/edit`}
                className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ background: "#25547A", color: "#fff" }}
              >
                ✏️ 编辑作品
              </Link>
            </div>
          )}

          {/* 标签 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {project.tags.map(({ tag }) => (
              <Link
                key={tag.slug}
                href={`/works?tag=${tag.slug}`}
                className="text-sm px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </Link>
            ))}
          </div>

          {/* 简介 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3" style={{ color: "#25547A" }}>作品简介</h2>
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>
              {project.description}
            </p>
          </div>

          {/* 截图画廊 */}
          {project.images.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: "#25547A" }}>游戏截图</h2>
              <div className="grid grid-cols-2 gap-3">
                {project.images.map((img) => (
                  <div key={img.id} className="relative aspect-video rounded-lg overflow-hidden border hover:border-[#3388BB] transition-colors" style={{ borderColor: "#D0DEE8" }}>
                    <Image
                      src={img.url}
                      alt={img.altText || project.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 开发日志 */}
          {project.devlog && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: "#25547A" }}>开发日志</h2>
              <div className="rounded-xl p-6 whitespace-pre-wrap leading-relaxed border" style={{ background: "#F0F5F9", color: "#555", borderColor: "#D0DEE8" }}>
                {project.devlog}
              </div>
            </div>
          )}
        </div>

        {/* 右侧信息栏 */}
        <aside className="space-y-6">
          {/* 外部链接 */}
          {externalLinks.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
              <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>获取游戏</h3>
              <div className="space-y-2">
                {externalLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors hover:shadow-sm hover:bg-[#D0DEE8]"
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

          {/* 项目信息 */}
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
                      <span
                        key={tech}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "#E6F0F8", color: "#3388BB" }}
                      >
                        {tech}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* 开发团队 */}
          {project.members.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
              <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>开发团队</h3>
              <div className="space-y-3">
                {project.members.map(({ member, role }) => (
                  <Link
                    key={member.id}
                    href={`/members/${member.id}`}
                    className="flex items-center gap-3 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-[#E6F0F8]"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #E38043, #F09055)" }}>
                      {(member.user?.image || member.avatar) ? (
                        <img
                          src={(member.user?.image || member.avatar)!}
                          alt={member.displayName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        member.displayName[0]
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "#333" }}>{member.displayName}</div>
                      <div className="text-xs" style={{ color: "#999" }}>{role}</div>
                    </div>
                  </Link>
                ))}
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
