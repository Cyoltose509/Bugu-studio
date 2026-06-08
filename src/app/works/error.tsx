"use client";

import Link from "next/link";

/**
 * 作品库列表页错误边界
 */
export default function WorksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-4xl mb-4">😵</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#25547A" }}>
          加载失败
        </h2>
        <p className="mb-6" style={{ color: "#777" }}>
          作品列表暂时无法加载，请稍后重试。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "#25547A", color: "#fff" }}
          >
            重试
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "#F0F5F9", color: "#25547A" }}
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
