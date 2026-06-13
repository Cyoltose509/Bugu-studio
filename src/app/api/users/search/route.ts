/**
 * 用户搜索 API（Game Jam 评委选择、队伍邀请等场景用）
 * GET /api/users/search?q=xxx
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { apiResponse, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  // 已毕业用户排除条件：没有关联的 ClubMember，或者 ClubMember.graduated 不为 true
  const excludeGraduated = {
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
      select: {
        id: true,
        name: true,
        image: true,
      },
    });
    return apiResponse(users);
  }

  const users = await prisma.user.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      role: { not: "GUEST" },
      ...excludeGraduated,
    },
    take: 20,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      image: true,
    },
  });

  return apiResponse(users);
}
