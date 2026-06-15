"use client"; // 全局错误边界必须是 Client Component

import { useEffect, useState } from "react";

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
    <html lang="zh-CN">
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
              抱歉，出了点问题
            </h1>
            <p className="text-[#666] dark:text-[#8898a8] mb-2">
              页面加载时发生了意外错误，请尝试刷新页面。
            </p>
            <p className="text-sm text-[#3388BB] dark:text-[#5ba8d8] mb-6">
              该错误已自动上报给管理员
              {reportId && (
                <span className="font-mono font-bold ml-1">
                  （错误编号：#{reportId}）
                </span>
              )}
            </p>
          </div>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-[#E38043] text-white rounded-lg hover:bg-[#d47035] transition-colors font-medium"
          >
            重新加载
          </button>
          {reportId && (
            <p className="mt-4 text-xs text-[#999] dark:text-[#667]">
              请将此页面截图发送给管理员以加速处理
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
