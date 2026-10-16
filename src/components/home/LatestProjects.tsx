/**
 * 首页最新作品 — 独立服务器组件，可被 Suspense 包裹
 *
 * 最多取 HOME_WORKS_MAX 条。露出张数由栅格断点决定，始终两行。
 */
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import { isMockDataEnabled, mockLatestProjects } from "@/lib/mock/frontend-data";
import {t} from "@/lib/i18n/dict";
import type {Lang} from "@/lib/i18n/config";
import { PROJECT_DATE_ORDER_BY } from "@/lib/works/date-sort";
import { HOME_WORKS_MAX } from "@/lib/layout/homeWorksGrid";
import HomeLatestWorksGrid from "./HomeLatestWorksGrid";
import type { ProjectCardProject } from "@/components/projects/ProjectCard";

const LATEST_COUNT = HOME_WORKS_MAX;

async function getProjects() {
  if (isMockDataEnabled()) {
    return mockLatestProjects(LATEST_COUNT);
  }
  try {
    return await cachedQuery(
      "projects:latest:v4",
      () =>
        prisma.project.findMany({
          where: { status: ProjectStatus.PUBLISHED },
          orderBy: PROJECT_DATE_ORDER_BY,
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
  } catch {
    return [];
  }
}

export default async function LatestProjects({lang = "cn"}: { lang?: Lang }) {
  const projects = await getProjects();

  if (projects.length === 0) {
    return (
      <p className="mt-8 text-center text-sm text-brand-text-muted">
        {t(lang, "home.noPublished")}
      </p>
    );
  }

  return (
    <HomeLatestWorksGrid projects={projects as unknown as ProjectCardProject[]} />
  );
}
