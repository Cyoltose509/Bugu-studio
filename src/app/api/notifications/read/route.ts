import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";

/**
 * GET /api/notifications/read — 未读通知数量（轻量，供铃铛图标使用）
 * 注意：客户端 NotificationBell 实际调用的是 /api/notifications/unread-count
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const count = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return apiResponse({ count });
}

/**
 * PATCH /api/notifications/read — 标记已读
 * Body: { id?: string } → 标记单个；无 id 则标记全部
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  let body: { id?: string } = {};
  try { body = await request.json(); } catch { /* ignore */ }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: session.user.id },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
  }

  return apiResponse({ success: true });
}
