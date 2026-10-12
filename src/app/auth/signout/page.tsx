/**
 * 自定义退出登录页面
 * NextAuth 默认页面简陋，这里替换为品牌一致的 UI
 */
"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangProvider";

export default function SignOutPage() {
  const router = useRouter();
  const { t } = useLang();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-6">
          <img
            src="/images/logo.png"
            alt={t("brand.name")}
            className="w-16 h-16 mx-auto rounded-xl"
          />
        </div>

        <h1 className="text-xl font-bold mb-2 text-brand-navy">
          {t("auth.signoutTitle")}
        </h1>
        <p className="text-sm mb-8 text-brand-text-secondary">
          {t("auth.signoutConfirm")}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90 bg-[var(--ui-text-red)]"
          >
            {t("auth.signoutYes")}
          </button>

          <button
            onClick={() => router.back()}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors border text-brand-text-body border-brand-border-subtle"
          >
            {t("auth.backPrev")}
          </button>
        </div>

        <p className="mt-8 text-xs text-[#AAA]">
          <Link href="/" className="hover:underline text-brand-blue">
            {t("common.backToHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
