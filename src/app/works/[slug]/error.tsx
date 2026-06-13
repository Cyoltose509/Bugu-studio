"use client";

import Link from "next/link";

/**
 * 作品详情页错误边界
 */
export default function WorkDetailError({
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
        <h2 className="text-xl font-bold mb-2 text-brand-navy">
          加载失败
        </h2>
        <p className="mb-6 text-brand-text-secondary">
          作品页面暂时无法加载，请稍后重试。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-brand-navy text-white"
          >
            重试
          </button>
          <Link
            href="/works"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-brand-surface-page text-brand-navy"
          >
            返回作品库
          </Link>
        </div>
      </div>
    </div>
  );
}
