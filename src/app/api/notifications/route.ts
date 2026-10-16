import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { invalidateCache, cachedQuery } from "@/lib/db/cache";
import { invalidateUnreadCache } from "@/lib/cache/unread-count-cache";
import { prismaTypeFilter, splitUnreadByType } from "@/lib/notifications/buckets";
import { attachReviewOutcomes } from "@/lib/notifications/review-outcome";

const PAGE_SIZE = 20;

/**
 * GET /api/notifications — 获取当前用户通知列表
 * Query: ?page=1&unreadOnly=false&bucket=review|activity|bug
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const bucket = searchParams.get("bucket");

  const where: any = { userId: session.user.id, ...prismaTypeFilter(bucket) };
  if (unreadOnly) where.read = false;

  const cacheKey = `api:notifications:${session.user.id}:${page}:${unreadOnly}:${bucket || "all"}`;

  const [items, total, unreadRows] = await cachedQuery(cacheKey, () =>
    Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.notification.count({ where }),
      prisma.notification.groupBy({
        by: ["type"],
        where: { userId: session.user.id, read: false },
        _count: { _all: true },
      }),
    ]), 15);
  const unread = splitUnreadByType(
    unreadRows.map((r) => ({ type: r.type, _count: r._count._all })),
  );

  // 批量获取 Project 类型通知对应的 slug
  const projectIds = items
    .filter((n) => n.relatedType === "Project" && n.relatedId)
    .map((n) => n.relatedId!);
  const slugMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, slug: true },
    });
    for (const p of projects) slugMap.set(p.id, p.slug);
  }

  const outcomes = await attachReviewOutcomes(items);

  return apiResponse({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      relatedId: n.relatedId,
      relatedType: n.relatedType,
      relatedSlug: n.relatedType === "Project" ? (slugMap.get(n.relatedId!) ?? n.relatedId) : undefined,
      read: n.read,
      createdAt: n.createdAt,
      outcome: outcomes.get(n.id) ?? null,
    })),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
    unreadCount: unread.count,
    unread: unread,
  });
}

/**
 * PATCH /api/notifications — 标记已读
 * Body: { ids?: string[] } → 标记指定；若无ids则标记全部已读
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  let body: { ids?: string[]; bucket?: string } = {};
  try { body = await request.json(); } catch { /* ignore */ }

  if (body.ids && body.ids.length > 0) {
    await prisma.notification.updateMany({
      where: {
        id: { in: body.ids },
        userId: session.user.id, // 安全：只能改自己的
      },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        read: false,
        ...prismaTypeFilter(body.bucket),
      },
      data: { read: true },
    });
  }

  await invalidateCache(`api:notifications:${session.user.id}`);
  await invalidateCache(`notifications:${session.user.id}`);
  invalidateUnreadCache(session.user.id);
  return apiResponse({ success: true });
}

/**
 * DELETE /api/notifications — 删除通知
 * Body: { ids?: string[] } → 删除指定；若无 ids 则删除全部已读通知
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  let body: { ids?: string[]; bucket?: string } = {};
  try { body = await request.json(); } catch { /* ignore */ }

  if (body.ids && body.ids.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: body.ids }, userId: session.user.id },
    });
  } else {
    await prisma.notification.deleteMany({
      where: { userId: session.user.id, ...prismaTypeFilter(body.bucket) },
    });
  }

  await invalidateCache(`api:notifications:${session.user.id}`);
  await invalidateCache(`notifications:${session.user.id}`);
  invalidateUnreadCache(session.user.id);
  return apiResponse({ success: true });
}
