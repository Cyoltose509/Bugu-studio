/**
 * POST /api/errors/report
 * 前端错误上报接口 — 无需认证，用户遇到错误时自动调用
 * 去重与通知逻辑已抽到 @/lib/errors/report-store，本路由只做参数校验与身份回退。
 * 去重策略：相同 URL + 最近 10 分钟内已有相同错误 → 仅递增计数，不创建新报告、不发通知
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { recordErrorReport } from "@/lib/errors/report-store";
import { shouldSkipClientReport } from "@/lib/errors/report-filter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.message) {
      return NextResponse.json({ success: false, error: "缺少错误信息" }, { status: 400 });
    }

    const { message, stack, url, userAgent } = body as {
      message: string;
      stack?: string;
      url?: string;
      userAgent?: string;
      errorType?: string;
    };

    const ua = userAgent || request.headers.get("user-agent") || undefined;
    const pageUrl = url || request.headers.get("referer") || undefined;

    // 服务端再过滤一次（前端已过滤，但旧版本页面 / 直连调用仍可能打进来）：
    // 瞬态错误（chunk 丢失、RSC 流中断、网络抖动）与本地开发来源不落库。
    // 返回 200 而不是 4xx，避免客户端错误边界因上报失败再抛一个错误。
    const filter = shouldSkipClientReport(message, pageUrl);
    if (filter.skip) {
      return NextResponse.json({ success: true, data: { reportId: null, skipped: filter.reason } });
    }

    // 尝试获取当前用户（不强制要求登录）
    let userId: string | undefined;
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch {
      // 未登录不影响上报
    }

    const { reportId } = await recordErrorReport({
      message,
      stack,
      url: pageUrl,
      userAgent: ua,
      userId,
      kind: "client",
      notifyAdmins: true,
    });

    return NextResponse.json({
      success: true,
      data: { reportId },
    });
  } catch (err) {
    console.error("[ErrorReport] 上报失败:", err);
    return NextResponse.json({ success: false, error: "上报失败" }, { status: 500 });
  }
}
