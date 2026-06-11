/**
 * GET  /api/admin/audit-logs  — 审计日志查询（支持筛选和分页）
 * DELETE /api/admin/audit-logs — 删除审计日志
 *   body: { mode: "lastN", n: number } | { mode: "all" }
 */

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const action   = searchParams.get("action") || "";
    const model    = searchParams.get("model") || "";
    const page     = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 20;
    const skip     = (page - 1) * pageSize;

    const where: any = {};
    if (action) where.action = action;
    if (model)  where.targetType = model;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body  = await req.json();
    const mode  = body.mode as string;
    let deleted: number;

    if (mode === "lastN") {
      const n = Math.max(1, Math.min(1000, parseInt(String(body.n), 10) || 1));
      const targets = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: n,
        select:  { id: true },
      });
      if (targets.length === 0) {
        return NextResponse.json({ deleted: 0 });
      }
      const result = await prisma.auditLog.deleteMany({
        where: { id: { in: targets.map((t: any) => t.id) } },
      });
      deleted = result.count;
    } else if (mode === "all") {
      const result = await prisma.auditLog.deleteMany({});
      deleted = result.count;
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    revalidatePath("/admin/audit-logs");
    revalidatePath("/admin/monitoring/supabase");

    return NextResponse.json({ deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
