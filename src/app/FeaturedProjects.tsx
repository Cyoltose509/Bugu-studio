/**
 * 首页精选作品 — 独立服务器组件，可被 Suspense 包裹
 */
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";

/**
 * 作品 + 关联数据的类型（从 Prisma 查询推断）
 */
type ProjectWithRelations = Awaited<ReturnType<typeof getProjects>>[number];

async function getProjects() {
  return prisma.project.findMany({
    where: { status: ProjectStatus.PUBLISHED, isFeatured: true },
    orderBy: { publishedAt: "desc" },
    take: 6,
    include: {
      tags: { include: { tag: true } },
      members: {
        take: 3,
        include: {
          member: {
            select: {
              displayName: true,
              avatar: true,
              user: { select: { image: true } },
            },
          },
        },
      },
    },
  });
}

export default async function FeaturedProjects() {
  const projects = await getProjects();

  if (projects.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      {projects.map((p, i) => (
        <ProjectCard key={p.id} project={p} priority={i === 0} />
      ))}
    </div>
  );
}

function ProjectCard({ project, priority }: { project: ProjectWithRelations; priority?: boolean }) {
  const typeLabel: Record<string, string> = { DEMO: "Demo 演示", STEAM: "Steam 发布", ITCH: "itch.io 发布", OTHER: "其他" };

  return (
    <Link
      href={`/works/${project.slug}`}
      className="game-card group block bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md"
      style={{ borderColor: "#D0DEE8" }}
    >
      <div className="relative w-full aspect-video bg-gray-100">
        {project.coverImage ? (
          <Image
            src={project.coverImage}
            alt={project.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, 33vw"
            {...(priority ? { priority: true, fetchPriority: "high" as const } : {})}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">
            {typeLabel[project.type] || project.type}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3
          className="font-semibold group-hover:text-[#3388BB] transition-colors text-base"
          style={{ color: "#333" }}
        >
          {project.title}
        </h3>
        <p className="text-sm mt-1 line-clamp-2" style={{ color: "#777" }}>
          {project.description}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {project.tags.slice(0, 3).map(({ tag }) => (
            <span
              key={tag.slug}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "#88C23222", color: "#88C232" }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="text-xs mt-2" style={{ color: "#999" }}>
          {project.developYear}
        </div>
      </div>
    </Link>
  );
}
