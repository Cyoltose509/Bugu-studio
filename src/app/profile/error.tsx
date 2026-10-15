"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/LangProvider";

/**
 * 个人中心页错误边界
 */
export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-4xl mb-4">😵</div>
        <h2 className="text-xl font-bold mb-2 text-brand-navy">
          {t("error.loadFailed")}
        </h2>
        <p className="mb-6 text-brand-text-secondary">
          {t("error.profileDesc")}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-brand-navy text-white"
          >
            {t("error.retry")}
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-brand-surface-page text-brand-navy"
          >
            {t("common.backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
