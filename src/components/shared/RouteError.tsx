"use client";

import { useEffect, useState } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reportId, setReportId] = useState<number | null>(null);

  useEffect(() => {
    console.error("[Route Error]", error);

    // 自动上报错误给管理员
    fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
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
      <h2 className="text-2xl font-bold text-brand-text-heading mb-2">页面加载失败</h2>
      <p className="text-brand-text-secondary mb-3 text-center max-w-md">
        抱歉，页面在加载时遇到了问题。请稍后再试。
      </p>
      <p className="text-sm text-brand-blue dark:text-[#5ba8d8] mb-6">
        该错误已自动上报给管理员
        {reportId && (
          <span className="font-mono font-bold ml-1">（错误编号：#{reportId}）</span>
        )}
      </p>
      <button
        onClick={() => reset()}
        className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium"
      >
        重新加载
      </button>
      {reportId && (
        <p className="mt-4 text-xs text-brand-text-muted dark:text-[#6a7888]">
          请将此页面截图发送给管理员以加速处理
        </p>
      )}
    </div>
  );
}
