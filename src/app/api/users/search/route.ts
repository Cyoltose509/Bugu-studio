/**
 * 用户搜索 API（Game Jam 评委选择、队伍邀请、例会主讲关联等）
 * GET /api/users/search?q=xxx
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { apiResponse, apiError } from "@/lib/utils";

const userSelect = {
  id: true,
  name: true,
  image: true,
  member: { select: { id: true, displayName: true } },
} as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const includeGraduated = searchParams.get("includeGraduated") === "1";

  // 默认排除已毕业；例会主讲关联等场景可 includeGraduated=1
  const excludeGraduated = includeGraduated
    ? {}
    : {
        NOT: { member: { graduated: true } },
      };

  if (q.length < 1) {
    // 返回最近活跃的用户（最多 20），排除 Guest 和已毕业成员
    const users = await prisma.user.findMany({
      where: {
        role: { not: "GUEST" },
        ...excludeGraduated,
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: userSelect,
    });
    return apiResponse(users);
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { member: { displayName: { contains: q, mode: "insensitive" } } },
      ],
      role: { not: "GUEST" },
      ...excludeGraduated,
    },
    take: 20,
    orderBy: { name: "asc" },
    select: userSelect,
  });

  return apiResponse(users);
}
