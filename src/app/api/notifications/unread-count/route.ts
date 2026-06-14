import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getCachedUnread, setCachedUnread } from "@/lib/cache/unread-count-cache";

/**
 * GET /api/notifications/unread-count — 未读通知数量（轻量，供铃铛图标使用）
 *
 * 性能优化：使用 getToken()（纯 JWT 解码，0 DB 查询）替代 auth()（session callback 查 DB）
 * 仅需 userId，不需要 isActive/name/image/role 等信息
 */
export async function GET(request: NextRequest) {
  // getToken() 只做 JWT 验证，不触发 session callback，不查 DB
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token?.id) return apiError("请先登录", 401);

  const uid = token.id as string;
  const cached = getCachedUnread(uid);
  if (cached !== null) return apiResponse({ count: cached });

  const count = await prisma.notification.count({
    where: { userId: uid, read: false },
  });

  setCachedUnread(uid, count);
  return apiResponse({ count });
}
