/**
 * GET  /api/admin/csp-reports-data — CSP 违规报告数据（供管理看板 AJAX 轮询）
 * DELETE /api/admin/csp-reports-data?id=xxx          — 删除单条
 * DELETE /api/admin/csp-reports-data?ids=xxx,yyy      — 批量删除
 * DELETE /api/admin/csp-reports-data?all=true          — 一键清空
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "30", 10)));

    const [reports, totalCount, stats] = await Promise.all([
      // 分页报告
      prisma.cspReport.findMany({
        select: {
          id: true,
          blockedUri: true,
          violatedDirective: true,
          documentUri: true,
          referrer: true,
          sourceFile: true,
          lineNumber: true,
          columnNumber: true,
          disposition: true,
          sample: true,
          userAgent: true,
          ipAddress: true,
          count: true,
          lastSeenAt: true,
          firstSeenAt: true,
        },
        orderBy: { lastSeenAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cspReport.count(),
      // 聚合统计
      prisma.$transaction([
        // 按违规指令分布
        prisma.cspReport.groupBy({
          by: ["violatedDirective"],
          _count: { id: true },
          _sum: { count: true },
          orderBy: { _count: { id: "desc" } },
        }),
        // 按页面 URI 分布 (top 20)
        prisma.cspReport.groupBy({
          by: ["documentUri"],
          _count: { id: true },
          _sum: { count: true },
          orderBy: { _count: { id: "desc" } },
          take: 20,
        }),
        // 按被阻止 URI 分布 (top 20)
        prisma.cspReport.groupBy({
          by: ["blockedUri"],
          _count: { id: true },
          _sum: { count: true },
          orderBy: { _count: { id: "desc" } },
          take: 20,
        }),
        // 24 小时新增数
        prisma.cspReport.count({
          where: { firstSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        // 总违规事件数（聚合 count）
        prisma.cspReport.aggregate({ _sum: { count: true } }),
      ]),
    ]);

    const [byDirective, byDocumentUri, byBlockedUri, last24h, totalEvents] = stats as [
      { violatedDirective: string; _count: { id: number }; _sum: { count: number | null } }[],
      { documentUri: string | null; _count: { id: number }; _sum: { count: number | null } }[],
      { blockedUri: string | null; _count: { id: number }; _sum: { count: number | null } }[],
      number,
      { _sum: { count: number | null } },
    ];

    return NextResponse.json({
      reports,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      stats: {
        totalUnique: totalCount,
        totalEvents: totalEvents._sum.count ?? 0,
        last24h,
        byDirective: byDirective.map((d) => ({
          directive: d.violatedDirective,
          uniqueReports: d._count.id,
          totalEvents: d._sum.count ?? 0,
        })),
        byDocumentUri: byDocumentUri.map((d) => ({
          uri: d.documentUri ?? "(unknown)",
          uniqueReports: d._count.id,
          totalEvents: d._sum.count ?? 0,
        })),
        byBlockedUri: byBlockedUri.map((d) => ({
          uri: d.blockedUri ?? "(unknown)",
          uniqueReports: d._count.id,
          totalEvents: d._sum.count ?? 0,
        })),
      },
    });
  } catch (err) {
    console.error("[csp-reports-data]", err);
    return NextResponse.json({ error: "Failed to fetch CSP reports" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all");
    const id = searchParams.get("id");
    const ids = searchParams.get("ids");

    if (all === "true") {
      // 一键清空
      const result = await prisma.cspReport.deleteMany();
      return NextResponse.json({ deleted: result.count });
    }

    if (id) {
      // 删除单条
      await prisma.cspReport.delete({ where: { id } });
      return NextResponse.json({ deleted: 1 });
    }

    if (ids) {
      // 批量删除
      const idList = ids.split(",").filter(Boolean);
      const result = await prisma.cspReport.deleteMany({
        where: { id: { in: idList } },
      });
      return NextResponse.json({ deleted: result.count });
    }

    return NextResponse.json({ error: "Missing id/ids/all parameter" }, { status: 400 });
  } catch (err) {
    console.error("[csp-reports-data DELETE]", err);
    return NextResponse.json({ error: "Failed to delete CSP reports" }, { status: 500 });
  }
}
