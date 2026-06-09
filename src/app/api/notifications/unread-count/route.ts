import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getCachedUnread, setCachedUnread } from "@/lib/cache/unread-count-cache";

/**
 * GET /api/notifications/unread-count — 未读通知数量（轻量，供铃铛图标使用）
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const uid = session.user.id;
  const cached = getCachedUnread(uid);
  if (cached !== null) return apiResponse({ count: cached });

  const count = await prisma.notification.count({
    where: { userId: uid, read: false },
  });

  setCachedUnread(uid, count);
  return apiResponse({ count });
}
