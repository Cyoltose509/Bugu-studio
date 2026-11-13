/**
 * 错误报告落库服务（服务端模块，禁止在客户端引用）
 *
 * 从 POST /api/errors/report 中抽出「去重 + 递增编号 + 通知管理员」的公共逻辑，
 * 供前端上报接口与 instrumentation.onRequestError（RSC 渲染 / Server Action 等服务端错误）复用：
 * - 前端上报：kind = "client"，notifyAdmins = true
 * - 服务端错误：kind = "server"，notifyAdmins = true
 *
 * 去重语义（与抽出前完全一致）：
 * - 10 分钟内相同 message + 相同 url（url 为 null 视为 null）→ 仅 count+1、刷新 lastSeenAt，
 *   不创建新报告、不发通知
 * - 新错误 → 事务内取 max(reportId)+1 分配展示编号后创建
 * - 通知去重：30 分钟内同一页面 URL（无 URL 时用 message 前缀）已有 ERROR_REPORT 通知 → 不再通知
 */
import { prisma } from "@/lib/db/prisma";
import { withDbRetry } from "@/lib/db/transient";
import { createNotifications } from "@/lib/services/notification";

/** 错误来源：客户端浏览器上报 / 服务端渲染或 Server Action */
export type ErrorReportKind = "client" | "server";

export interface RecordErrorReportInput {
  /** 错误信息（必填） */
  message: string;
  /** 错误堆栈（落库前截断到 5000 字符） */
  stack?: string | null;
  /** 发生错误的页面 URL（null 表示未知） */
  url?: string | null;
  /** 浏览器 UA（服务端错误时取请求头） */
  userAgent?: string | null;
  /** 登录用户 id（未登录为 null） */
  userId?: string | null;
  /** 错误来源，默认 client */
  kind?: ErrorReportKind;
  /** 是否通知管理员，默认 false */
  notifyAdmins?: boolean;
}

export interface RecordErrorReportResult {
  /** 展示用递增编号 */
  reportId: number;
  /** 是否命中 10 分钟去重（命中时不会新增记录、不会重复通知） */
  duplicate: boolean;
}

/** 去重窗口：10 分钟 */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
/** 管理员通知去重窗口：30 分钟 */
const NOTIFY_DEDUPE_WINDOW_MS = 30 * 60 * 1000;
/** 堆栈最大落库长度 */
const STACK_MAX_LENGTH = 5000;
/** reportId 撞车时的最大重试次数（并发上报才会有，通常 1 次就够） */
const REPORT_ID_MAX_ATTEMPTS = 3;
/** 通知标题里的来源文案 */
const KIND_LABEL: Record<ErrorReportKind, string> = {
  client: "前端错误",
  server: "服务端错误",
};

/**
 * 记录一条错误报告。
 * 数据库/通知失败由调用方处理（数据库错误会向上抛出，通知错误在内部静默）。
 */
export async function recordErrorReport(
  input: RecordErrorReportInput
): Promise<RecordErrorReportResult> {
  const message = input.message;
  if (!message) {
    throw new Error("recordErrorReport: message 不能为空");
  }

  const stack = input.stack ?? null;
  const url = input.url ?? null;
  const userAgent = input.userAgent ?? null;
  const userId = input.userId ?? null;
  const kind: ErrorReportKind = input.kind ?? "client";
  const notifyAdmins = input.notifyAdmins ?? false;

  // 1) 去重：10 分钟内相同 message + 相同 URL → 仅递增计数
  const tenMinAgo = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await withDbRetry(() =>
    prisma.errorReport.findFirst({
      where: {
        message,
        url,
        lastSeenAt: { gte: tenMinAgo },
      },
      orderBy: { lastSeenAt: "desc" },
    }),
  );

  if (existing) {
    await withDbRetry(() =>
      prisma.errorReport.update({
        where: { id: existing.id },
        data: {
          count: { increment: 1 },
          lastSeenAt: new Date(),
          // 无 UA 时保持原值（undefined 表示不更新该字段），与抽出前行为一致
          userAgent: userAgent ?? undefined,
        },
      }),
    );
    return { reportId: existing.reportId, duplicate: true };
  }

  // 2) 新错误：分配递增编号后创建
  const reportId = await createWithNextReportId({ message, stack, url, userId, userAgent });

  // 3) 通知管理员（失败静默，不影响上报结果）
  if (notifyAdmins) {
    await notifyErrorAdmins({ reportId, kind, url, message });
  }

  return { reportId, duplicate: false };
}

/** Prisma 唯一约束冲突（reportId 被并发请求抢占） */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * 取号 + 创建报告，不用交互式事务。
 *
 * 原实现把「读 max(reportId) + create」放在 prisma.$transaction 里，事务本身是
 * 一次额外往返；在 Vercel + Supabase pgbouncer 下偶发 "Transaction API error:
 * Transaction not found"，会让**错误上报本身**失败 —— 最需要记录的时候恰好写不进去。
 * 改为两条独立语句 + P2002 冲突重取号：多实例并发时退化为一次重试，代价远小于丢报告。
 */
async function createWithNextReportId(data: {
  message: string;
  stack: string | null;
  url: string | null;
  userId: string | null;
  userAgent: string | null;
}): Promise<number> {
  let lastError: unknown;

  for (let attempt = 0; attempt < REPORT_ID_MAX_ATTEMPTS; attempt++) {
    const last = await withDbRetry(() =>
      prisma.errorReport.findFirst({
        orderBy: { reportId: "desc" },
        select: { reportId: true },
      }),
    );
    const nextId = (last?.reportId ?? 0) + 1;

    try {
      await withDbRetry(() =>
        prisma.errorReport.create({
          data: {
            reportId: nextId,
            message: data.message,
            stack: data.stack ? data.stack.slice(0, STACK_MAX_LENGTH) : null,
            url: data.url,
            userId: data.userId,
            userAgent: data.userAgent,
          },
        }),
      );
      return nextId;
    } catch (error) {
      lastError = error;
      // 只有「编号撞车」才重取号重试；其他错误（含非瞬时 DB 错误）直接抛给调用方
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw lastError;
}

interface NotifyErrorAdminsParams {
  reportId: number;
  kind: ErrorReportKind;
  url: string | null;
  message: string;
}

/**
 * 通知所有管理员有新错误。
 * 30 分钟内同一页面（或 message 前缀）已有 ERROR_REPORT 通知时跳过，避免刷屏。
 * 任何失败都被吞掉——通知不能影响错误上报。
 */
async function notifyErrorAdmins({ reportId, kind, url, message }: NotifyErrorAdminsParams): Promise<void> {
  try {
    const thirtyMinAgo = new Date(Date.now() - NOTIFY_DEDUPE_WINDOW_MS);
    // 与抽出前一致：有页面 URL 用 URL 前缀，否则退回 message 前缀
    const dedupeKey = url?.slice(0, 100) ?? message.slice(0, 60);

    const recentNotif = await prisma.notification.findFirst({
      where: {
        type: "ERROR_REPORT",
        content: { contains: dedupeKey },
        createdAt: { gte: thirtyMinAgo },
      },
    });
    if (recentNotif) return;

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (admins.length === 0) return;

    const urlPreview = url ? url.slice(0, 80) : "未知页面";

    await createNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        type: "ERROR_REPORT",
        title: `⚠️ ${KIND_LABEL[kind]} #${reportId}`,
        content: `页面 ${urlPreview} 发生错误：${message.slice(0, 120)}`,
        relatedId: String(reportId),
        relatedType: "ErrorReport",
      }))
    );
  } catch {
    // 通知失败不影响错误上报
  }
}
