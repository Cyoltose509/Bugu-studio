/**
 * 标签 API
 * GET /api/tags - 获取所有标签
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { apiResponse, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.API_GENERAL);
  if (!rl.allowed) return apiError("请求过于频繁", 429);

  const tags = await prisma.tag.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          projects: {
            where: { project: { status: "PUBLISHED" } },
          },
        },
      },
    },
  });

  return apiResponse(tags);
}
