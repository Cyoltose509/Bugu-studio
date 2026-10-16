import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getCachedUnread, setCachedUnread } from "@/lib/cache/unread-count-cache";
import { splitUnreadByType } from "@/lib/notifications/buckets";

/**
 * GET /api/notifications/unread-count — 未读通知数量（轻量，供铃铛图标使用）
 */
export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token?.id) return apiError("请先登录", 401);

  const uid = token.id as string;
  const cached = getCachedUnread(uid);
  if (cached !== null) return apiResponse(cached);

  const rows = await prisma.notification.groupBy({
    by: ["type"],
    where: { userId: uid, read: false },
    _count: { _all: true },
  });
  const payload = splitUnreadByType(
    rows.map((r) => ({ type: r.type, _count: r._count._all })),
  );
  setCachedUnread(uid, payload);
  return apiResponse(payload);
}
