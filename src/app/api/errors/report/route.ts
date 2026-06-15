/**
 * POST /api/errors/report
 * 前端错误上报接口 — 无需认证，用户遇到错误时自动调用
 * 去重策略：相同 URL + 最近 10 分钟内已有相同错误 → 仅递增计数，不创建新报告、不发通知
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { createNotifications } from "@/lib/services/notification";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.message) {
      return NextResponse.json({ success: false, error: "缺少错误信息" }, { status: 400 });
    }

    const { message, stack, url, userAgent, errorType } = body as {
      message: string;
      stack?: string;
      url?: string;
      userAgent?: string;
      errorType?: string;
    };

    // 尝试获取当前用户（不强制要求登录）
    let userId: string | undefined;
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch {
      // 未登录不影响上报
    }

    const ua = userAgent || request.headers.get("user-agent") || undefined;
    const pageUrl = url || request.headers.get("referer") || undefined;

    // 去重：10 分钟内相同 URL + 相同错误信息 → 仅递增计数
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existing = await prisma.errorReport.findFirst({
      where: {
        message,
        url: pageUrl ?? null,
        lastSeenAt: { gte: tenMinAgo },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    if (existing) {
      // 去重：仅更新计数和时间
      await prisma.errorReport.update({
        where: { id: existing.id },
        data: { count: { increment: 1 }, lastSeenAt: new Date(), userAgent: ua },
      });
      return NextResponse.json({
        success: true,
        data: { reportId: existing.reportId },
      });
    }

    // 新错误：分配递增编号
    const reportId = await prisma.$transaction(async (tx) => {
      const last = await tx.errorReport.findFirst({
        orderBy: { reportId: "desc" },
        select: { reportId: true },
      });
      const nextId = (last?.reportId ?? 0) + 1;

      await tx.errorReport.create({
        data: {
          reportId: nextId,
          message,
          stack: stack?.slice(0, 5000) ?? null,
          url: pageUrl,
          userId,
          userAgent: ua,
        },
      });

      return nextId;
    });

    // 通知所有管理员（去重：同一 URL 10 分钟内不重复通知）
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentNotif = await prisma.notification.findFirst({
        where: {
          type: "ERROR_REPORT",
          content: { contains: pageUrl?.slice(0, 100) ?? message.slice(0, 60) },
          createdAt: { gte: thirtyMinAgo },
        },
      });
      if (!recentNotif) {
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        if (admins.length > 0) {
          const urlPreview = pageUrl ? pageUrl.slice(0, 80) : "未知页面";
          await createNotifications(
            admins.map((a) => ({
              userId: a.id,
              type: "ERROR_REPORT",
              title: `⚠️ 前端错误 #${reportId}`,
              content: `页面 ${urlPreview} 发生错误：${message.slice(0, 120)}`,
              relatedId: String(reportId),
              relatedType: "ErrorReport",
            }))
          );
        }
      }
    } catch {
      // 通知失败不影响上报
    }

    return NextResponse.json({
      success: true,
      data: { reportId },
    });
  } catch (err) {
    console.error("[ErrorReport] 上报失败:", err);
    return NextResponse.json({ success: false, error: "上报失败" }, { status: 500 });
  }
}
