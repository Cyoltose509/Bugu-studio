/**
 * 成员搜索 API — 用于 @mention 自动补全
 * GET /api/members/search?q=xxx → [{ id, displayName }]
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { withAuditContext } from "@/lib/db/audit-context";

export const GET = withAuditContext(async function (req: NextRequest) {
  // 速率限制：每 IP 每秒 5 次（防爬虫/滥用自动补全）
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { windowSeconds: 1, maxRequests: 5, prefix: "memsearch" });
  if (!rl.allowed) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
  }

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
});
