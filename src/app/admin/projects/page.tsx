/**
 * 管理后台 - 作品管理
 * 支持按状态筛选、审核、删除、设精选
 */
import { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import ProjectsTableClient from "./ProjectsTableClient";

export const metadata: Metadata = { title: "作品管理 - 管理后台" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (status) where.status = status as ProjectStatus;

  const cacheKey = `admin:projects:${status}:${page}`;

  const [projects, total, statusCounts, allCount] = await cachedQuery(
    cacheKey,
    () =>
      Promise.all([
        prisma.project.findMany({
          where,
          orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
          skip,
          take: pageSize,
          select: {
            id: true,
            slug: true,
            title: true,
            type: true,
            developYear: true,
            status: true,
            isFeatured: true,
          },
        }),
        prisma.project.count({ where }),
        prisma.project.groupBy({ by: ["status"], _count: { status: true } }),
        prisma.project.count(),
      ]),
    15,
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <ProjectsTableClient
      projects={projects}
      currentStatus={status}
      currentPage={page}
      totalPages={totalPages}
      statusCounts={statusCounts as { status: ProjectStatus; _count: { status: number } }[]}
      allCount={allCount}
    />
  );
}
