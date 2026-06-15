"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

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
        setMsg(data.error || "重置失败，请稍后再试");
      }
    } catch {
      setMsg("网络错误，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2 text-brand-navy">密码重置成功</h1>
          <p className="text-sm text-brand-text-secondary mb-6">
            请使用新密码登录
          </p>
          <Link
            href="/auth/login"
            className="btn-primary inline-block w-full py-2.5 rounded-lg font-medium text-center"
          >
            前往登录
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
          <h1 className="text-xl font-bold mb-2 text-brand-navy">链接无效</h1>
          <p className="text-sm text-brand-text-secondary mb-6">
            重置链接缺少令牌，请确认链接完整或重新申请
          </p>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-brand-blue hover:underline"
          >
            重新申请重置
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
        <h1 className="text-2xl font-bold mb-2 text-center text-brand-navy">重置密码</h1>
        <p className="text-sm text-center mb-8 text-brand-text-secondary">
          请输入新密码
        </p>
        {msg && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">
            {msg}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="password">
              新密码
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading"
              placeholder="至少 8 位"
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="confirmPassword">
              确认密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading"
              placeholder="再次输入新密码"
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
            {loading ? "重置中..." : "重置密码"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-brand-text-secondary">
          <Link href="/auth/login" className="hover:underline text-brand-blue">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-brand-text-muted">加载中...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
