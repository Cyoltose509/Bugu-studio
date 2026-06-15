/**
 * POST /api/admin/members/graduate-confirm
 * 批量确认成员已毕业（设置 graduated=true）
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return apiError("未授权", 403);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("请求体格式错误", 400); }

  const { memberIds } = body as { memberIds: string[] };
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return apiError("请提供要确认的成员 ID", 400);
  }

  const result = await prisma.clubMember.updateMany({
    where: { id: { in: memberIds } },
    data: { graduated: true },
  });

  return apiResponse({ updated: result.count });
}
