"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n/LangProvider";
import { attemptTransientRecovery, isRecoverableTransientError } from "@/lib/utils/transient-error";
import { shouldSkipClientReport } from "@/lib/errors/report-filter";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();
  const [reportId, setReportId] = useState<number | null>(null);
  // 瞬态错误命中且已触发自动刷新时，短暂显示"正在自动重试"提示（刷新通常很快生效）
  const [autoRetrying, setAutoRetrying] = useState(false);

  useEffect(() => {
    console.error("[Route Error]", error);

    // 自动上报错误给管理员。digest 是生产环境定位服务端错误的唯一线索
    // （Next.js 生产构建会吞掉真实报错信息），必须随报告一起带上。
    // 瞬态错误（chunk 丢失 / 网络抖动）与本地开发来源不上报：前者刷新即恢复，
    // 后者永远不该进生产错误列表，落库只会淹没真实 bug。
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
    // 刷新频率上限与冷却由 attemptTransientRecovery 控制；失败则保留手动「重试」按钮。
    if (isRecoverableTransientError(error) && attemptTransientRecovery()) {
      setAutoRetrying(true);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4" role="alert">
      <h2 className="text-2xl font-bold text-brand-text-heading mb-2">{t("error.routeTitle")}</h2>
      <p className="text-brand-text-secondary mb-3 text-center max-w-md">
        {t("error.routeDesc")}
      </p>
      <p className="text-sm text-brand-blue dark:text-[#5ba8d8] mb-6">
        {t("error.routeReported")}
        {reportId && (
          <span className="font-mono font-bold ml-1">{t("error.routeReportId", { id: reportId })}</span>
        )}
      </p>
      {autoRetrying && (
        // dict 里没有"正在自动重试"的专用词条（dict.ts 有他人未提交改动，不新增），
        // 用已有的 common.loading 作为自动刷新中的提示
        <p role="status" aria-live="polite" className="text-sm text-brand-text-muted mb-6">
          {t("common.loading")}
        </p>
      )}
      <button
        onClick={() => reset()}
        className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium"
      >
        {t("error.routeReload")}
      </button>
      {reportId && (
        <p className="mt-4 text-xs text-brand-text-muted dark:text-[#6a7888]">
          {t("error.routeScreenshotHint")}
        </p>
      )}
    </div>
  );
}
