import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { invalidateCache } from "@/lib/db/cache";

const PAGE_SIZE = 20;

/**
 * GET /api/notifications — 获取当前用户通知列表
 * Query: ?page=1&unreadOnly=false
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where: any = { userId: session.user.id };
  if (unreadOnly) where.read = false;

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: session.user.id, read: false },
    }),
  ]);

  return apiResponse({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      relatedId: n.relatedId,
      relatedType: n.relatedType,
      read: n.read,
      createdAt: n.createdAt,
    })),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
    unreadCount,
  });
}

/**
 * PATCH /api/notifications — 标记已读
 * Body: { ids?: string[] } → 标记指定；若无ids则标记全部已读
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  let body: { ids?: string[] } = {};
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
    // 标记全部已读
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
  }

  await invalidateCache(`notifications:${session.user.id}`);
  return apiResponse({ success: true });
}
