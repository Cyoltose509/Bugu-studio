/**
 * GET    /api/admin/error-reports-data          — 错误报告列表
 * PATCH  /api/admin/error-reports-data          — 批量标记状态
 * DELETE /api/admin/error-reports-data?id=xxx   — 删除单条
 * DELETE /api/admin/error-reports-data?ids=xx,yy — 批量删除
 * DELETE /api/admin/error-reports-data?resolved=true — 删除所有已解决
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status && ["UNREAD", "READ", "RESOLVED"].includes(status)) {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      prisma.errorReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reportId: true,
          message: true,
          stack: true,
          url: true,
          userId: true,
          userAgent: true,
          status: true,
          count: true,
          firstSeenAt: true,
          lastSeenAt: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.errorReport.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("[ErrorReportsData]", err);
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/error-reports-data
 * 管理员标记错误报告状态
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, status } = body as { ids: string[]; status: string };

    if (!ids?.length || !["READ", "RESOLVED"].includes(status)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    await prisma.errorReport.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ErrorReportsData PATCH]", err);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/error-reports-data
 * 管理员删除错误报告 — 支持单条、批量、清空已解决
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const ids = searchParams.get("ids");
    const resolved = searchParams.get("resolved");

    // 删除所有已解决
    if (resolved === "true") {
      const result = await prisma.errorReport.deleteMany({
        where: { status: "RESOLVED" },
      });
      return NextResponse.json({ deleted: result.count });
    }

    // 删除单条
    if (id) {
      await prisma.errorReport.delete({ where: { id } });
      return NextResponse.json({ deleted: 1 });
    }

    // 批量删除
    if (ids) {
      const idList = ids.split(",").filter(Boolean);
      const result = await prisma.errorReport.deleteMany({
        where: { id: { in: idList } },
      });
      return NextResponse.json({ deleted: result.count });
    }

    return NextResponse.json({ error: "Missing id/ids/resolved parameter" }, { status: 400 });
  } catch (err) {
    console.error("[ErrorReportsData DELETE]", err);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
