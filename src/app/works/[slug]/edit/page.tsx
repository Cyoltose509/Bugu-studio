/**
 * 作品编辑页（流式渲染）
 * 提交者和管理员可编辑自己的作品
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { canEditProject } from "@/lib/auth/rbac";
import { ensureDefaultTags } from "@/lib/db/tags";
import LogoLoading from "@/components/ui/LogoLoading";

// 懒加载编辑表单，避免 react-easy-crop (~54KB gzip) 打包进主客户端 bundle
const ProjectEditForm = nextDynamic(() => import("@/components/forms/ProjectEditForm"), {
  loading: () => (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-full bg-gray-100 rounded-lg" />
      <div className="h-32 w-full bg-gray-100 rounded-lg" />
      <div className="h-10 w-full bg-gray-100 rounded-lg" />
      <div className="h-10 w-full bg-gray-100 rounded-lg" />
    </div>
  ),
});

export const metadata: Metadata = { title: "编辑作品" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/* ── 同步 Shell ── */

export default function ProjectEditPage({ params }: PageProps) {
  return (
    <Suspense fallback={<LogoLoading text="正在加载编辑页面..." />}>
      <EditContent params={params} />
    </Suspense>
  );
}

/* ── 异步数据组件 ── */

async function EditContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/works/" + slug + "/edit");

  const userId = session.user.id;
  const userRole = session.user.role as string;

  await ensureDefaultTags();
  const [project, tags] = await Promise.all([
    prisma.project.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      include: {
        tags: { include: { tag: true } },
        links: { orderBy: { sortOrder: "asc" } },
        members: {
          orderBy: { sortOrder: "asc" },
          include: {
            member: { select: { id: true, displayName: true, avatar: true, grade: true } },
          },
        },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.tag.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!project) notFound();

  if (!canEditProject(userRole as any, userId, project.submitterId)) {
    redirect("/works/" + slug);
  }

  // 将数据库数据序列化为表单可用的格式
  const initialData = {
    title: project.title,
    slug: project.slug,
    subtitle: project.subtitle || "",
    description: project.description,
    type: project.type,
    developYear: project.developYear,
    coverImage: project.coverImage || "",
    tagIds: project.tags.map((t) => t.tagId),
    links: project.links.map((l) => ({ label: l.label, url: l.url })),
    memberRoles: project.members.map((m) => ({
      memberId: m.memberId || undefined,
      userId: (m as any).userId || undefined,
      externalName: m.externalName || undefined,
      displayName: m.member?.displayName || (m as any).user?.name || m.externalName || "未知",
      roles: m.roles,
    })),
    images: project.images.map((img) => ({ url: img.url, altText: img.altText || undefined })),
    awards: project.awards,
    aiUsages: project.aiUsages,
    platforms: project.platforms,
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-navy">
          编辑作品
        </h1>
        <p className="mt-2 text-brand-text-secondary">
          编辑「{project.title}」的信息
        </p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 border-brand-border-subtle">
        <ProjectEditForm
          projectId={project.id}
          projectStatus={project.status}
          tags={tags}
          initialData={initialData}
        />
      </div>
    </div>
  );
}
