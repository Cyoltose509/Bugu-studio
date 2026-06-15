/**
 * POST /api/admin/csp-report — CSP 违规报告接收端点
 *
 * 浏览器在检测到 Content-Security-Policy 违规时，将报告发送到此端点。
 * 支持两种格式：
 *   - report-uri 旧标准：Content-Type: application/csp-report，body = { "csp-report": {...} }
 *   - report-to  新标准：Content-Type: application/reports+json，body = [{ "type": "csp-violation", "body": {...} }]
 *
 * 参考：
 *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri
 *   https://w3c.github.io/reporting/
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auditContext } from "@/lib/db/audit-context";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { createNotifications } from "@/lib/services/notification";
import { logger } from "@/lib/logger";

/** CSP 报告端点自身的速率限制：每 IP 每分钟 30 次 */
const CSP_RATE_LIMIT = { windowSeconds: 60, maxRequests: 30, prefix: "csp-report" };

/** 单次请求最多发几条通知（防止一个页面多违规刷屏） */
const MAX_NOTIFICATIONS_PER_REQUEST = 3;

/** 解析 report-uri 格式的 CSP 报告（旧标准） */
function parseLegacyReport(body: Record<string, unknown>): Record<string, unknown> | null {
  const report = body["csp-report"];
  if (!report || typeof report !== "object") return null;
  return report as Record<string, unknown>;
}

/** 解析 report-to 格式的 CSP 报告（新标准 Reporting API） */
function parseReportingApi(body: unknown): Record<string, unknown> | null {
  if (!Array.isArray(body)) return null;
  const first = body[0];
  if (!first || typeof first !== "object") return null;
  if (first.type !== "csp-violation" && first.type !== "csp") return null;
  return (first.body as Record<string, unknown>) ?? null;
}

/** 违规指令 → 中文简短标签（用于通知） */
function shortLabel(directive: string): string {
  const map: Record<string, string> = {
    "script-src": "脚本加载",
    "style-src": "样式加载",
    "img-src": "图片加载",
    "connect-src": "网络连接",
    "font-src": "字体加载",
    "media-src": "媒体加载",
    "frame-src": "内嵌框架",
    "frame-ancestors": "嵌入限制",
    "form-action": "表单提交",
    "base-uri": "基址",
    "default-src": "默认源",
    "object-src": "插件",
  };
  return map[directive] ?? directive;
}

export async function POST(request: NextRequest) {
  // ── 速率限制 ──
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip, CSP_RATE_LIMIT);
  if (!rateCheck.allowed) {
    return NextResponse.json({}, { status: 200 }); // 静默
  }

  // ── 解析 ──
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({}, { status: 200 });
  }

  if (!rawBody) {
    return NextResponse.json({}, { status: 200 });
  }

  // 尝试两种格式
  let report = parseLegacyReport(rawBody as Record<string, unknown>);
  if (!report) {
    report = parseReportingApi(rawBody);
  }

  if (!report) {
    return NextResponse.json({}, { status: 200 });
  }

  // ── 提取字段 ──
  const blockedUri = typeof report["blocked-uri"] === "string" ? report["blocked-uri"] : null;
  const violatedDirective =
    typeof report["violated-directive"] === "string"
      ? report["violated-directive"]
      : typeof report["effectiveDirective"] === "string"
        ? report["effectiveDirective"]
        : "unknown";
  const documentUri =
    typeof report["document-uri"] === "string" ? report["document-uri"] : null;
  const referrer = typeof report["referrer"] === "string" ? report["referrer"] : null;
  const sourceFile = typeof report["source-file"] === "string" ? report["source-file"] : null;
  const lineNumber =
    typeof report["line-number"] === "number" ? report["line-number"] : null;
  const columnNumber =
    typeof report["column-number"] === "number" ? report["column-number"] : null;
  const originalPolicy =
    typeof report["original-policy"] === "string"
      ? report["original-policy"].slice(0, 500)
      : null;
  const disposition = typeof report["disposition"] === "string" ? report["disposition"] : null;
  const sample = typeof report["sample"] === "string" ? report["sample"]?.slice(0, 100) : null;
  const scriptSample =
    typeof report["script-sample"] === "string"
      ? report["script-sample"]?.slice(0, 100)
      : null;
  const userAgent = request.headers.get("user-agent") ?? null;

  // ── 日志记录 ──
  logger.security.info("CSP violation", {
    blockedUri,
    violatedDirective,
    documentUri,
    referrer,
    sourceFile,
    lineNumber,
    columnNumber,
  });

  // ── 持久化到数据库（去重：相同 blockedUri + violatedDirective + documentUri 合并）──
  let isNew = false;
  let reportId = "";

  try {
    const result = await auditContext.run({ userId: undefined, ipAddress: ip }, () =>
      prisma.$transaction(async (tx) => {
        // 查找是否已有相同违规（24 小时内）
        const recent = await tx.cspReport.findFirst({
          where: {
            violatedDirective,
            ...(blockedUri ? { blockedUri } : { blockedUri: null }),
            ...(documentUri ? { documentUri } : { documentUri: null }),
            lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { lastSeenAt: "desc" },
        });

        if (recent) {
          // 更新已存在的记录（聚合计数）
          await tx.cspReport.update({
            where: { id: recent.id },
            data: {
              count: { increment: 1 },
              lastSeenAt: new Date(),
              userAgent,
              ipAddress: ip,
            },
          });
          return { isNew: false, id: recent.id };
        } else {
          // 新建记录
          const created = await tx.cspReport.create({
            data: {
              blockedUri,
              violatedDirective,
              documentUri,
              referrer,
              sourceFile,
              lineNumber,
              columnNumber,
              originalPolicy,
              disposition,
              sample,
              scriptSample,
              userAgent,
              ipAddress: ip,
              count: 1,
            },
          });
          return { isNew: true, id: created.id };
        }
      })
    );

    isNew = result.isNew;
    reportId = result.id;
  } catch (err) {
    logger.security.warn("Failed to persist CSP report to DB", err);
  }

  // ── 新违规 → 通知所有管理员 ──
  if (isNew && reportId) {
    notifyAdmins(reportId, violatedDirective, blockedUri, documentUri).catch(() => {
      // 通知失败不影响 CSP 报告接收
    });
  }

  // 200 + 空响应体 — 浏览器不需要知道具体处理结果
  return NextResponse.json({}, { status: 200 });
}

/** 通知所有 ADMIN 用户 */
async function notifyAdmins(
  reportId: string,
  violatedDirective: string,
  blockedUri: string | null,
  documentUri: string | null
) {
  try {
    // 防刷屏：最近 30 分钟内是否已发过同类型违规的通知
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentNotif = await prisma.notification.findFirst({
      where: {
        type: "CSP_VIOLATION",
        relatedId: violatedDirective,
        createdAt: { gte: thirtyMinAgo },
      },
      select: { id: true },
    });

    if (recentNotif) {
      // 同类型违规 30 分钟内已通知过，跳过
      return;
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length === 0) return;

    const pagePath = documentUri
      ? (() => { try { return new URL(documentUri).pathname; } catch { return documentUri; } })()
      : "未知页面";

    const blocked = blockedUri ?? "(内联)";

    await createNotifications(
      admins.slice(0, MAX_NOTIFICATIONS_PER_REQUEST).map((a) => ({
        userId: a.id,
        type: "CSP_VIOLATION",
        title: `🛡️ CSP 违规: ${shortLabel(violatedDirective)}`,
        content: `检测到 CSP 违规：${shortLabel(violatedDirective)} 阻止了 "${blocked}"，发生在 ${pagePath}`,
        relatedId: violatedDirective, // 用指令名关联，30min 去重
        relatedType: "CspReport",
      }))
    );
  } catch {
    // 静默
  }
}
