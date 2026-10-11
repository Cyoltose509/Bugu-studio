import { prisma } from "@/lib/db/prisma";
import { getMockSnapshot, isMockDataEnabled } from "@/lib/mock/frontend-data";
import { BAITUAN_SLUG, baituanShowcase, parseShowcase, showcaseKey } from "./showcase";

export async function getActivityShowcase(id: string, slug: string) {
  if (isMockDataEnabled()) {
    return slug === BAITUAN_SLUG ? baituanShowcase(getMockSnapshot().projects) : null;
  }
  const setting = await prisma.siteSetting.findUnique({ where: { key: showcaseKey(id) } });
  return parseShowcase(setting?.value);
}

export async function getShowcaseProjects(ids: string[]) {
  if (!ids.length) return [];
  const projects = isMockDataEnabled()
    ? getMockSnapshot().projects.filter(p => ids.includes(p.id) && p.status === "PUBLISHED")
    : await prisma.project.findMany({
        where: { id: { in: ids }, status: "PUBLISHED" },
        select: {
          id: true, slug: true, title: true, subtitle: true, description: true,
          coverImage: true, type: true, developYear: true,
          tags: { include: { tag: true } },
          images: { select: { url: true, altText: true }, orderBy: { sortOrder: "asc" } },
        },
      });
  // Respect the administrator's order, and never expose unpublished works.
  return ids.flatMap(id => {
    const project = projects.find(p => p.id === id);
    return project ? [project] : [];
  });
}
