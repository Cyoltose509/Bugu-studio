/**
 * POST /api/admin/cleanup-test-data
 * Dev-only: 清理测试产生的数据（CSP 报告 + 通知）
 * 仅在 NODE_ENV !== "production" 时可用
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { type } = body;

    const result: Record<string, number> = {};

    // 清理 CSP 报告
    if (!type || type === "csp-reports") {
      const deleted = await prisma.cspReport.deleteMany({
        where: {
          blockedUri: { contains: "test" },
        },
      });
      result.cspReports = deleted.count;
    }

    // 清理 CSP 违规通知
    if (!type || type === "csp-notifications") {
      const deleted = await prisma.notification.deleteMany({
        where: { type: "CSP_VIOLATION" },
      });
      result.cspNotifications = deleted.count;
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "清理失败", detail: String(err) },
      { status: 500 }
    );
  }
}
