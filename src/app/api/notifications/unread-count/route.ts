import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";

/**
 * GET /api/notifications/unread-count — 未读通知数量（轻量，供铃铛图标使用）
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const count = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return apiResponse({ count });
}
