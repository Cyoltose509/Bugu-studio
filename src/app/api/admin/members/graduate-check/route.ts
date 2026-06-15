/**
 * GET /api/admin/members/graduate-check
 * 检测疑似已毕业的成员：grade < 当前年-4 且 graduated=false
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return apiError("未授权", 403);
  }

  const currentYear = new Date().getFullYear();
  const threshold = currentYear - 4;

  const suspects = await prisma.clubMember.findMany({
    where: {
      graduated: false,
      grade: { lte: threshold },
    },
    select: {
      id: true,
      displayName: true,
      grade: true,
      joinYear: true,
      user: { select: { email: true } },
    },
    orderBy: { grade: "asc" },
  });

  return apiResponse({ suspects, threshold, currentYear });
}
