/**
 * Next.js Instrumentation — 进程级异常处理
 *
 * 在服务器启动时注册 uncaughtException / unhandledRejection 处理器，
 * 确保未捕获异常至少被记录（并优雅退出），而不是静默崩溃。
 *
 * 参考：https://nextjs.org/docs/app/api-reference/instrumentation
 */
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
