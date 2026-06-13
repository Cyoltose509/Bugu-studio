"use client";
import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function getLoginErrorMsg(error: string | undefined): string {
  if (!error) return "邮箱或密码错误，请重试";
  // 安全：所有认证失败统一返回不区分具体原因，防止账户枚举
  if (error === "auth_failed" || error === "CredentialsSignin") {
    return "邮箱或密码错误，请重试";
  }
  // 非认证类错误（OAuth / 会话等）
  const map: Record<string, string> = {
    OAuthSignin:        "第三方登录失败",
    OAuthCallback:      "第三方登录回调失败",
    OAuthCreateAccount: "第三方账号创建失败",
    EmailCreateAccount: "邮箱注册失败",
    Callback:           "回调失败",
    OAuthAccountNotLinked: "该邮箱已绑定其他登录方式",
    SessionRequired:    "请先登录",
  };
  return map[error] ?? "登录出错，请重试";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/";
  // 安全：只允许站内相对路径，防止开放重定向攻击
  const callbackUrl = rawCallbackUrl.startsWith("/") ? rawCallbackUrl : "/";
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(true);

  // 检测是否已登录：已登录自动跳转（但 permission_denied 时不算 callbackUrl，避免再次跳回）
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (s?.user) {
          if (error === "permission_denied") {
            setChecking(false);
            setMsg("你的账号权限不足，无法访问该页面。请联系管理员升级为社团成员。");
            return;
          }
          router.push(callbackUrl);
        }
      })
      .finally(() => { if (error !== "permission_denied") setChecking(false); });
  }, [callbackUrl, router, error]);

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
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
        <h1 className="text-2xl font-bold mb-2 text-center text-brand-navy">登录</h1>
        <p className="text-sm text-center mb-8 text-brand-text-secondary">布谷工作室</p>
        {error && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">{getLoginErrorMsg(error)}</div>}
        {msg && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">{msg}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="email">邮箱</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="password">密码</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="至少 8 位" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-brand-text-secondary">
          还没有账号？ <Link href="/auth/register" className="hover:underline text-brand-blue">注册</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center"><div className="text-brand-text-muted">加载中...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
