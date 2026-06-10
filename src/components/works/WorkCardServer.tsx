import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import StaggeredCard from "./StaggeredCard";

const TYPE_LABELS: Record<string, string> = {
  DEMO: "Demo 演示",
  STEAM: "Steam 发布",
  ITCH: "itch.io 发布",
  OTHER: "其他",
};

interface Props {
  id: string;
  idx: number;
  liked: boolean;
}

/** 单个作品卡片 — 独立异步加载，配合 Suspense 实现渐进式渲染 */
export default async function WorkCardServer({ id, idx, liked }: Props) {
  // 每个卡片独立查询，自然形成渐进式加载
  const cacheKey = `works:card:${id}`;

  const project = await cachedQuery(
    cacheKey,
    () =>
      prisma.project.findUnique({
        where: { id },
        include: {
          tags: { include: { tag: true } },
          _count: { select: { likes: true } },
        },
      }),
    120,
  );

  if (!project) return null;

  // 查询制作人员（最多 3 人）
  const members = await cachedQuery(
    `works:card:members:${id}`,
    () =>
      prisma.projectMember.findMany({
        where: { projectId: id },
        include: {
          member: {
            select: { displayName: true, avatar: true, user: { select: { image: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
        take: 3,
      }),
    60,
  );

  return (
    <StaggeredCard
      project={project}
      members={members}
      idx={idx}
      liked={liked}
      typeLabels={TYPE_LABELS}
    />
  );
}
