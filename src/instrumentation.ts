/**
 * Next.js Instrumentation — 进程级异常处理 + 服务端请求错误落库
 *
 * 1) register：在服务器启动时注册 uncaughtException / unhandledRejection 处理器，
 *    确保未捕获异常至少被记录（并优雅退出），而不是静默崩溃。
 * 2) onRequestError：Next 15 的服务端请求错误钩子。生产构建下 RSC 渲染 / Server Action
 *    抛错时浏览器只能拿到被省略的 digest，这里把真实 message + 堆栈落到 ErrorReport，
 *    让「An error occurred in the Server Components render」类错误变得可诊断。
 *
 * 注意：Next 会把本文件分别打包进 Node 与 Edge 两份产物（process.env.NEXT_RUNTIME
 * 在构建期被固化为常量 'nodejs' / 'edge'）。因此：
 * - 顶层禁止静态 import 会初始化 Prisma / 依赖 Node API 的重模块；
 * - Node 专用逻辑必须放在 `if (process.env.NEXT_RUNTIME === "nodejs") { ... }` 之内，
 *   Webpack 才能整支丢弃，Edge 产物不会把 Prisma 打进依赖图（Next 官方 register 写法）。
 *
 * 参考：https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
import type { Instrumentation } from "next";

/** Next 传入的请求信息（path/method/headers） */
type RequestErrorInfo = Parameters<Instrumentation.onRequestError>[1];
/** Next 传入的错误上下文（routerKind/routePath/routeType/revalidateReason） */
type RequestErrorContext = Parameters<Instrumentation.onRequestError>[2];

/** 落库等待上限：超时后放弃等待（写库仍在后台继续），避免拖慢请求收尾 */
const ERROR_REPORT_TIMEOUT_MS = 4000;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createLogger } = await import("@/lib/logger");
    const log = createLogger("process");

    process.on("uncaughtException", (error) => {
      log.error("Uncaught exception — 进程即将退出", {
        name: error.name,
        message: error.message,
        stack: error.stack?.split("\n").slice(0, 8),
      });
      // 给日志缓冲时间写入，然后退出
      setTimeout(() => process.exit(1), 1000);
    });

    process.on("unhandledRejection", (reason) => {
      log.error("Unhandled rejection", {
        reason: reason instanceof Error
          ? { name: reason.name, message: reason.message, stack: reason.stack?.split("\n").slice(0, 5) }
          : String(reason),
      });
    });

    process.on("warning", (warning) => {
      if (warning.name === "ExperimentalWarning") return; // 忽略 Node.js 实验性 API 警告
      log.warn("Node.js warning", { name: warning.name, message: warning.message });
    });
  }
}

/**
 * 服务端请求错误钩子（Next 15.1.11 支持：instrumentation 的 onRequestError 导出）。
 *
 * 处理约定：
 * - Next 内部控制流错误（redirect / notFound / HTTP 错误回退）不是 bug，直接跳过
 * - 错误上报接口自身与 /_next/ 内部资源不落库，避免递归
 * - Edge runtime 没有 Prisma / Node API → 只 console.error，不落库
 * - 任何异常（含 import 失败 / DB 超时）都在本函数内静默消化，绝不再抛回 Next
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    // 0) 构建期（静态生成失败）也会回调本钩子：那是部署失败而非线上错误，
    //    不写生产 ErrorReport / 不打扰管理员（NEXT_PHASE 由 next build 注入）。
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    // 1) 过滤 Next 内部控制流错误（error.digest 由 Next 在抛错时写入）
    const digest = (err as { digest?: unknown } | null | undefined)?.digest;
    if (isNextControlFlowDigest(digest)) return;

    const path = request?.path ?? "";

    // 2) 递归保护：错误上报接口自身失败 / Next 内部资源，不再落库
    if (path.startsWith("/api/errors/report") || path.startsWith("/_next/")) return;

    const message = err instanceof Error ? err.message : String(err);
    const stack = buildRequestErrorStack(err, context, digest);

    if (process.env.NEXT_RUNTIME === "nodejs") {
      // ── Node runtime：动态 import 重模块（避免 instrumentation 初始化阶段就拉起 Prisma） ──
      const [{ recordErrorReport }, { createLogger }] = await Promise.all([
        import("@/lib/errors/report-store"),
        import("@/lib/logger"),
      ]);

      const userAgent = getUserAgent(request);

      // 结构化日志留一行，便于日志平台检索（DB 落库之外的第二条线索）
      createLogger("server-error").error("请求处理出现未捕获异常", {
        path,
        method: request?.method,
        message,
        routerKind: context?.routerKind,
        routePath: context?.routePath,
        routeType: context?.routeType,
        digest: digest ?? null,
      });

      // 落库：4s 超时保护，超时继续走 Next 的错误处理流程
      await withTimeout(
        recordErrorReport({
          message,
          stack,
          url: path || null,
          userAgent,
          userId: null,
          kind: "server",
          notifyAdmins: true,
        }),
        ERROR_REPORT_TIMEOUT_MS
      );
    } else {
      // ── Edge runtime：无 Prisma / Node API，只记录一行日志，不落库 ──
      console.error(`[server-error] ${message}\n${stack}`);
    }
  } catch (handlerErr) {
    // 钩子内任何失败都不能抛回 Next 的错误处理流程
    try {
      console.error("[server-error] onRequestError 落库失败:", handlerErr);
    } catch {
      // 忽略 console 自身异常
    }
  }
};

/** 读取请求头里的 UA（可能是 string 或 string[]，统一成字符串） */
function getUserAgent(request: RequestErrorInfo): string | null {
  const raw = request?.headers?.["user-agent"];
  return Array.isArray(raw) ? raw.join(", ") : raw ?? null;
}

/** Next 内部控制流 digest（重定向 / 404 / HTTP 错误回退），均非真实错误 */
function isNextControlFlowDigest(digest: unknown): boolean {
  if (typeof digest !== "string" || digest.length === 0) return false;
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}

/** 组装落库堆栈：原始堆栈 + 服务端路由上下文 + digest（生产环境定位的关键线索） */
function buildRequestErrorStack(
  err: unknown,
  context: RequestErrorContext,
  digest: unknown
): string {
  const base =
    err instanceof Error && err.stack
      ? err.stack
      : `${err instanceof Error ? err.name : "Error"}: ${err instanceof Error ? err.message : String(err)}`;
  const routerInfo = `[server: ${context?.routerKind ?? "unknown"} ${context?.routePath ?? "unknown"} ${context?.routeType ?? "unknown"}]`;
  const digestInfo = `[digest: ${typeof digest === "string" && digest.length > 0 ? digest : "none"}]`;
  return `${base}\n${routerInfo}\n${digestInfo}`;
}

/** 超时包装：ms 内未完成则直接放弃等待（不会取消已发出的写库操作） */
function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    task,
    new Promise<undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), ms) as unknown as { unref?: () => void };
      // 不让计时器阻止进程退出
      timer.unref?.();
    }),
  ]);
}
