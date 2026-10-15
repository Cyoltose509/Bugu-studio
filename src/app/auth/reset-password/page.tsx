"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { lang } = useLang();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setMsg(data.error || t(lang, "auth.resetFailed"));
      }
    } catch {
      setMsg(t(lang, "auth.networkError"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2 text-brand-navy">{t(lang, "auth.resetSuccessTitle")}</h1>
          <p className="text-sm text-brand-text-secondary mb-6">
            {t(lang, "auth.resetSuccessDesc")}
          </p>
          <Link
            href="/auth/login"
            className="btn-primary inline-block w-full py-2.5 rounded-lg font-medium text-center"
          >
            {t(lang, "profile.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2 text-brand-navy">{t(lang, "auth.invalidLinkTitle")}</h1>
          <p className="text-sm text-brand-text-secondary mb-6">
            {t(lang, "auth.invalidLinkDesc")}
          </p>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-brand-blue hover:underline"
          >
            {t(lang, "auth.requestResetAgain")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
        <h1 className="text-2xl font-bold mb-2 text-center text-brand-navy">{t(lang, "auth.resetTitle")}</h1>
        <p className="text-sm text-center mb-8 text-brand-text-secondary">
          {t(lang, "auth.enterNewPwd")}
        </p>
        {msg && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">
            {msg}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="password">
              {t(lang, "auth.newPassword")}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading"
              placeholder={t(lang, "auth.passwordMin8")}
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="confirmPassword">
              {t(lang, "auth.confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading"
              placeholder={t(lang, "auth.confirmNewPasswordPlaceholder")}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? t(lang, "auth.resetting") : t(lang, "auth.resetTitle")}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-brand-text-secondary">
          <Link href="/auth/login" className="hover:underline text-brand-blue">
            {t(lang, "auth.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { lang } = useLang();
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-brand-text-muted">{t(lang, "common.loading")}</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
