/**
 * 成员搜索 API（提交作品时选择成员用）
 * GET /api/members/search?q=xxx
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { isMemberOrAbove } from "@/lib/auth/rbac";
import { apiResponse, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  if (!isMemberOrAbove(session.user.role as any))
    return apiError("仅社团成员可搜索", 403);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (q.length < 1) {
    // 返回最近活跃的成员（最多 20）
    const members = await prisma.clubMember.findMany({
      where: { isActive: true },
      take: 20,
      orderBy: { joinYear: "desc" },
      select: {
        id: true,
        displayName: true,
        avatar: true,
        grade: true,
        joinYear: true,
        skills: true,
      },
    });
    return apiResponse(members);
  }

  const members = await prisma.clubMember.findMany({
    where: {
      displayName: { contains: q, mode: "insensitive" },
    },
    take: 20,
    orderBy: { joinYear: "desc" },
    select: {
      id: true,
      displayName: true,
      avatar: true,
      grade: true,
      joinYear: true,
      skills: true,
    },
  });

  return apiResponse(members);
}
