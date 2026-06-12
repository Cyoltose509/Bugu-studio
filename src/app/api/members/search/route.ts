/**
 * 成员搜索 API — 用于 @mention 自动补全
 * GET /api/members/search?q=xxx → [{ id, displayName }]
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q || q.length < 1) return NextResponse.json([]);

  const members = await prisma.clubMember.findMany({
    where: {
      displayName: { contains: q, mode: "insensitive" },
    },
    select: { id: true, displayName: true },
    take: 8,
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json(members);
}
