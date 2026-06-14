/**
 * 首页最新作品 — 独立服务器组件，可被 Suspense 包裹
 * 使用统一 ProjectCard 组件
 */
import ProjectCard, { ProjectCardProject } from "@/components/projects/ProjectCard";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";

async function getProjects() {
  return cachedQuery(
    "projects:latest",
    () =>
      prisma.project.findMany({
        where: { status: ProjectStatus.PUBLISHED },
        orderBy: [{ developYear: "desc" }, { publishedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          description: true,
          coverImage: true,
          type: true,
          developYear: true,
          awards: true,
          aiUsages: true,
          tags: { include: { tag: true } },
          members: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              externalName: true,
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
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
