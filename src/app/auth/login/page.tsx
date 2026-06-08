"use client";
import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function getLoginErrorMsg(error: string | undefined): string {
  if (!error) return "登录失败，请核对邮箱和密码";
  const map: Record<string, string> = {
    CredentialsSignin: "邮箱或密码错误",
    OAuthSignin: "第三方登录失败",
    OAuthCallback: "第三方登录回调失败",
    OAuthCreateAccount: "第三方账号创建失败",
    EmailCreateAccount: "邮箱注册失败",
    Callback: "回调失败",
    OAuthAccountNotLinked: "该邮箱已绑定其他登录方式",
    SessionRequired: "请先登录",
  };
  return map[error] ?? "登录出错，请重试";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(true);

  // 检测是否已登录：已登录自动跳转
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => { if (s?.user) router.push(callbackUrl); })
      .finally(() => setChecking(false));
  }, [callbackUrl, router]);

  if (checking) {
    return <div className="min-h-[80vh] flex items-center justify-center text-gray-400">加载中...</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg("");
    const result = await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
    setLoading(false);
    if (result?.ok) { router.push(callbackUrl); router.refresh(); }
    else setMsg(getLoginErrorMsg(result?.error));
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white border rounded-xl p-8 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: "#25547A" }}>登录</h1>
        <p className="text-sm text-center mb-8" style={{ color: "#777" }}>布谷工作室</p>
        {error && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">{error === "CredentialsSignin" ? "邮箱或密码错误" : "登录出错，请重试"}</div>}
        {msg && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">{msg}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="email">邮箱</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
              style={{ borderColor: "#D0DEE8", color: "#333" }} placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="password">密码</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
              style={{ borderColor: "#D0DEE8", color: "#333" }} placeholder="至少 8 位" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm" style={{ color: "#777" }}>
          还没有账号？ <Link href="/auth/register" className="hover:underline" style={{ color: "#3388BB" }}>注册</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center"><div style={{ color: "#999" }}>加载中...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
