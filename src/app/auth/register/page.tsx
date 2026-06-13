"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "bugoo_register_email";

function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);       // 注册按钮
  const [verifyLoading, setVerifyLoading] = useState(false); // 验证按钮
  const [resendLoading, setResendLoading] = useState(false); // 重新发送按钮
  const [msg, setMsg] = useState("");

  // 恢复 sessionStorage 中的注册状态
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { email: savedEmail, step: savedStep } = JSON.parse(saved);
        if (savedStep === "verify" && savedEmail) {
          setEmail(savedEmail);
          setStep("verify");
        }
      } catch {}
    }
  }, []);

  // 进入验证步骤时持久化 email
  useEffect(() => {
    if (step === "verify" && email) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, step: "verify" }));
    }
  }, [step, email]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg("");
    if (password !== confirmPassword) { setMsg("两次密码不一致"); setLoading(false); return; }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), password, inviteCode: inviteCode.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep("verify");
        if (data.verification?.code) setCode(data.verification.code);
      } else {
        setMsg(data.error || "注册失败");
      }
    } catch { setMsg("网络错误，请重试"); }
    setLoading(false);
  }

  async function handleResend() {
    setResendLoading(true); setMsg("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), password, inviteCode: inviteCode.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("验证码已重新发送！");
        if (data.verification?.code) setCode(data.verification.code);
      } else {
        setMsg(data.error || "发送失败");
      }
    } catch { setMsg("网络错误，请重试"); }
    setResendLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault(); setVerifyLoading(true); setMsg("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.removeItem(STORAGE_KEY);
        setMsg("邮箱验证成功！");
        setTimeout(() => router.push("/auth/login"), 1500);
      } else {
        setMsg(data.error || "验证失败");
      }
    } catch { setMsg("网络错误，请重试"); }
    setVerifyLoading(false);
  }

  // ==== 步骤1: 填写注册信息 ====
  if (step === "form") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
          <h1 className="text-2xl font-bold mb-2 text-center text-brand-navy">注册</h1>
          <p className="text-sm text-center mb-8 text-brand-text-secondary">加入布谷工作室</p>
          {msg && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">{msg}</div>}
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="name">昵称</label>
              <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="你的名称" />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="email">邮箱</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="password">密码</label>
              <input id="password" type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="至少8位" />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="confirmPassword">确认密码</label>
              <input id="confirmPassword" type="password" required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="再次输入密码" />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="inviteCode">
                邀请码 <span className="text-xs text-brand-text-muted">（选填，线下获取）</span>
              </label>
              <input id="inviteCode" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent font-mono text-sm border-brand-border-subtle text-brand-navy" placeholder="BUGOO-MEMBER-XXXXXX" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? "注册中..." : "注册"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-brand-text-secondary">
            已有账号？ <Link href="/auth/login" className="hover:underline text-brand-blue">登录</Link>
          </p>
        </div>
      </div>
    );
  }

  // ==== 步骤2: 验证邮箱 ====
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
        <div className="text-4xl text-center mb-4">📧</div>
        <h1 className="text-xl font-bold mb-2 text-center text-brand-navy">验证你的邮箱</h1>
        <p className="text-sm text-center mb-4 text-brand-text-secondary">
          我们已向 <span className="font-medium text-brand-text-heading">{email}</span> 发送了一封验证邮件，请在下方输入验证码。
        </p>
        {msg && <div className={`mb-4 p-3 rounded-md text-sm ${msg.includes("成功") ? "bg-green-50 border border-green-200 text-green-600" : "bg-red-50 border border-red-200 text-red-600"}`}>{msg}</div>}
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="code">验证码</label>
            <input id="code" type="text" required value={code} onChange={e => setCode(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-3 text-center text-2xl tracking-[0.3em] font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="000000" maxLength={6} />
          </div>
          <button type="submit" disabled={verifyLoading || code.length !== 6} className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {verifyLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {verifyLoading ? "验证中..." : "验证"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-brand-text-secondary">
          没收到邮件？检查垃圾箱，或{" "}
          <button type="button" onClick={handleResend} disabled={resendLoading} className="hover:underline text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-brand-blue">
            {resendLoading && <div className="w-3 h-3 border-2 border-[#3388BB] border-t-transparent rounded-full animate-spin" />}
            重新发送验证码
          </button>
        </p>
      </div>
    </div>
  );
}

// Suspense boundary 用于 useSearchParams
export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-[#3388BB] border-t-transparent rounded-full" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
