"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setMsg(data.error || "请求失败，请稍后再试");
      }
    } catch {
      setMsg("网络错误，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-xl font-bold mb-2 text-brand-navy">邮件已发送</h1>
          <p className="text-sm text-brand-text-secondary mb-6">
            如果 <span className="font-medium text-brand-text-body">{email}</span> 已注册，
            你将在几分钟内收到一封包含重置链接的邮件。
          </p>
          <p className="text-xs text-brand-text-muted mb-6">
            没有收到？检查垃圾邮件文件夹，或{" "}
            <button
              type="button"
              onClick={() => { setSent(false); setMsg(""); }}
              className="text-brand-blue hover:underline"
            >
              重新发送
            </button>
          </p>
          <Link href="/auth/login" className="text-sm text-brand-blue hover:underline">
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
        <h1 className="text-2xl font-bold mb-2 text-center text-brand-navy">忘记密码</h1>
        <p className="text-sm text-center mb-8 text-brand-text-secondary">
          输入注册邮箱，我们将发送重置链接
        </p>
        {msg && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">
            {msg}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading"
              placeholder="you@example.com"
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
            {loading ? "发送中..." : "发送重置邮件"}
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
