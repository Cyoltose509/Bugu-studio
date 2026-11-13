/**
 * 服务端错误补录 —— 给「在页面里被 catch 掉、不会再抛给 Next」的错误留一条记录。
 *
 * 背景：生产构建下 RSC 抛错时浏览器只能拿到被省略的 digest，
 * `instrumentation.onRequestError` 负责把真实 message 落库；但如果页面自己 catch 了
 * 数据库异常并降级渲染，那个钩子就不会触发，错误会彻底消失。
 * 这里供这类"吞掉错误前先留痕"的场景调用。
 *
 * 约定：
 * - 只记录 message / stack / url，不抛异常（报表失败不能影响页面渲染）
 * - message 保持原始错误文本，不做前缀拼接 —— 这样即使 onRequestError 也记录了同一条，
 *   report-store 的「10 分钟内相同 message + url」去重会把两条合并成 count+1
 */
import { recordErrorReport } from "@/lib/errors/report-store";
import { createLogger } from "@/lib/logger";

/** 落库等待上限：数据库此刻可能本身就是坏的，不能让上报拖住渲染 */
const REPORT_TIMEOUT_MS = 3000;

export async function reportServerFailure(params: {
  /** 原始错误（Error 或任意抛出值） */
  error: unknown;
  /** 出错页面路径，如 `/activities/cmv...`（与 onRequestError 的 path 一致才能被去重合并） */
  path?: string | null;
}): Promise<void> {
  const { error, path } = params;
  const message = error instanceof Error ? error.message : String(error);
  if (!message) return;

  try {
    createLogger("server-error").error("服务端数据加载失败（已降级处理）", {
      path: path ?? null,
      message,
    });

    await Promise.race([
      recordErrorReport({
        message,
        stack: error instanceof Error ? error.stack ?? null : null,
        url: path ?? null,
        userAgent: null,
        userId: null,
        kind: "server",
        notifyAdmins: true,
      }),
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, REPORT_TIMEOUT_MS) as unknown as { unref?: () => void };
        timer.unref?.();
      }),
    ]);
  } catch {
    // 上报失败不影响页面
  }
}
