"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n/LangProvider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();
  const [reportId, setReportId] = useState<number | null>(null);

  useEffect(() => {
    console.error("[Route Error]", error);

    // 自动上报错误给管理员。digest 是生产环境定位服务端错误的唯一线索
    // （Next.js 生产构建会吞掉真实报错信息），必须随报告一起带上。
    fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
