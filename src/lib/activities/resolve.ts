import { prisma } from "@/lib/db/prisma";

/**
 * 活动详情路由 `/activities/[id]` 的参数历史上混用了两种值：
 * - cuid：列表页、管理后台链接（主流）
 * - slug：sitemap / @mention 通知等（曾导致 404）
 *
 * 这里统一解析成真实 Activity.id；找不到返回 null，由页面 notFound()。
 */
export async function resolveActivityId(key: string): Promise<string | null> {
  if (!key) return null;

  const byId = await prisma.activity.findUnique({
    where: { id: key },
    select: { id: true },
  });
  if (byId) return byId.id;

  const bySlug = await prisma.activity.findUnique({
    where: { slug: key },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}
