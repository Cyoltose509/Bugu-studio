/**
 * 成员列表 API
 * GET /api/members - 获取成员列表（公开）
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { paginationSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { apiResponse, apiError, getPagination } from "@/lib/utils";
import { cachedQuery } from "@/lib/db/cache";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.API_GENERAL);
  if (!rl.allowed) return apiError("请求过于频繁", 429);

  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return apiError("参数错误", 400);

  const { page, pageSize } = parsed.data;
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!)
    : undefined;
  const active = searchParams.get("active");

  const where: any = {
    ...(year && { joinYear: year }),
    ...(active !== null && active !== undefined && {
      isActive: active === "true",
    }),
  };

  const { skip, take } = getPagination(page, pageSize);

  const cacheKey = `api:members:${JSON.stringify({ page, pageSize, year, active })}`;

  const result = await cachedQuery(cacheKey, () =>
    Promise.all([
      prisma.clubMember.findMany({
        where,
        skip,
        take,
        orderBy: [{ joinYear: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          displayName: true,
          avatar: true,
          grade: true,
          joinYear: true,
          graduateYear: true,
          bio: true,
          skills: true,
          socialLinks: {
            select: { id: true, label: true, url: true },
            orderBy: { sortOrder: "asc" },
          },
          isActive: true,
          _count: { select: { projectMembers: true } },
        },
      }),
      prisma.clubMember.count({ where }),
    ]), 60);

  const [members, total] = result;

  return apiResponse({
    items: members,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
