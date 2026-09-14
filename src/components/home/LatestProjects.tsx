/**
 * 首页最新作品 — 独立服务器组件，可被 Suspense 包裹
 *
 * 展示数量必须能整除栅格列数，否则最后一行缺卡，看起来像「没什么作品」。
 * 桌面 4 列 → 取 8 条 = 两整行。
 */
import ProjectCard, { ProjectCardProject } from "@/components/projects/ProjectCard";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";

/** 与下方 grid 的 lg:grid-cols-4 对齐：两整行 */
const LATEST_COUNT = 8;

async function getProjects() {
  return cachedQuery(
    "projects:latest:v3",
    () =>
      prisma.project.findMany({
        where: { status: ProjectStatus.PUBLISHED },
        orderBy: [{ developYear: "desc" }, { publishedAt: "desc" }],
        take: LATEST_COUNT,
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
      }),
    60,
  );
}

export default async function LatestProjects() {
  const projects = await getProjects();

  if (projects.length === 0) {
    return (
      <p className="mt-8 text-center text-sm text-brand-text-muted">
        暂无已发布作品
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 items-stretch">
      {projects.map((p, i) => (
        <ProjectCard
          key={p.id}
          project={p as unknown as ProjectCardProject}
          compact
          idx={i}
        />
      ))}
    </div>
  );
}
