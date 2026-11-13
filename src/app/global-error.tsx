"use client"; // 全局错误边界必须是 Client Component

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import { attemptTransientRecovery, isRecoverableTransientError } from "@/lib/utils/transient-error";
import { shouldSkipClientReport } from "@/lib/errors/report-filter";

/**
 * Next.js 全局错误边界 — 捕获根布局中的未处理错误
 * 生产环境下显示降级页面，自动上报错误给管理员
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reportId, setReportId] = useState<number | null>(null);
  // 瞬态错误命中且已触发自动刷新时，短暂显示"正在自动重试"提示
  const [autoRetrying, setAutoRetrying] = useState(false);
  // 该组件渲染在根布局之外，拿不到 LangProvider，故直接读 cookie 判定语言
  const [lang, setLang] = useState<Lang>("cn");

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)locale=(cn|en)/);
    if (m) setLang(m[1] as Lang);
  }, []);

  useEffect(() => {
    // 发送到日志服务
    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        l: "error",
        n: "global-error-boundary",
        m: "Unhandled render error",
        e: { name: error.name, message: error.message, digest: error.digest, stack: error.stack?.split("\n").slice(0, 5) },
      })
    );

    // 自动上报错误给管理员。digest 是生产环境定位服务端错误的唯一线索。
    // 瞬态错误（chunk 丢失 / RSC 流中断 / 本地开发来源）不落库：前者自动刷新即可恢复，
    // 后者是开发噪声，混进生产错误列表会让真实问题不可见。
    if (!shouldSkipClientReport(error.message, window.location.href).skip) {
      fetch("/api/errors/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive：瞬态错误会立刻触发自动刷新，不加上报请求可能随页面卸载一起被中断
        keepalive: true,
        body: JSON.stringify({
          message: error.message,
          stack: error.stack
            ? `${error.stack}\n[digest: ${error.digest ?? "none"}]`
            : `[digest: ${error.digest ?? "none"}]`,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.data?.reportId) setReportId(json.data.reportId);
        })
        .catch(() => {});
    }

    // 瞬态错误（chunk 丢失 / RSC 流中断 / 网络抖动）：先自动刷新一次，
    // 刷新频率上限与冷却由 attemptTransientRecovery 控制；失败则保留手动「重新加载」按钮。
    if (isRecoverableTransientError(error) && attemptTransientRecovery()) {
      setAutoRetrying(true);
    }
  }, [error]);

  return (
    <html lang={lang === "en" ? "en" : "zh-CN"}>
      <body className="bg-[#F0F5F9] dark:bg-[#1a1f2e] min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#E38043]/10 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E38043" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#333] dark:text-[#d0d8e8] mb-2">
              {t(lang, "globalError.title")}
            </h1>
            <p className="text-[#666] dark:text-[#8898a8] mb-2">
              {t(lang, "globalError.desc")}
            </p>
            <p className="text-sm text-[#3388BB] dark:text-[#5ba8d8] mb-6">
              {t(lang, "error.routeReported")}
              {reportId && (
                <span className="font-mono font-bold ml-1">
                  {t(lang, "error.routeReportId", { id: reportId })}
                </span>
              )}
            </p>
            {autoRetrying && (
              // dict 里没有"正在自动重试"的专用词条（dict.ts 有他人未提交改动，不新增），
              // 用已有的 common.loading 作为自动刷新中的提示
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-[#999] dark:text-[#8898a8]"
              >
                {t(lang, "common.loading")}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-[#E38043] text-white rounded-lg hover:bg-[#d47035] transition-colors font-medium"
          >
            {t(lang, "error.routeReload")}
          </button>
          {reportId && (
            <p className="mt-4 text-xs text-[#999] dark:text-[#667]">
              {t(lang, "error.routeScreenshotHint")}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
