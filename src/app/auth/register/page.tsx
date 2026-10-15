"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

const STORAGE_KEY = "bugoo_register_email";

function RegisterForm() {
  const router = useRouter();
  const { lang } = useLang();
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
  const [msgOk, setMsgOk] = useState(false); // msg 是否为成功提示（决定样式/颜色）

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
    e.preventDefault(); setLoading(true); setMsg(""); setMsgOk(false);
    if (password !== confirmPassword) { setMsg(t(lang, "auth.errPasswordMismatch")); setLoading(false); return; }
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
        setMsg(data.error || t(lang, "auth.errRegisterFailed"));
      }
    } catch { setMsg(t(lang, "auth.errNetworkRetry")); }
    setLoading(false);
  }

  async function handleResend() {
    setResendLoading(true); setMsg(""); setMsgOk(false);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), password, inviteCode: inviteCode.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(t(lang, "auth.codeResent")); setMsgOk(true);
        if (data.verification?.code) setCode(data.verification.code);
      } else {
        setMsg(data.error || t(lang, "auth.errSendFailed"));
      }
    } catch { setMsg(t(lang, "auth.errNetworkRetry")); }
    setResendLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault(); setVerifyLoading(true); setMsg(""); setMsgOk(false);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.removeItem(STORAGE_KEY);
        setMsg(t(lang, "auth.emailVerified")); setMsgOk(true);
        setTimeout(() => router.push("/auth/login"), 1500);
      } else {
        setMsg(data.error || t(lang, "auth.errVerifyFailed"));
      }
    } catch { setMsg(t(lang, "auth.errNetworkRetry")); }
    setVerifyLoading(false);
  }

  // ==== 步骤1: 填写注册信息 ====
  if (step === "form") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-sm border-brand-border-subtle">
          <h1 className="text-2xl font-bold mb-2 text-center text-brand-navy">{t(lang, "nav.register")}</h1>
          <p className="text-sm text-center mb-8 text-brand-text-secondary">{t(lang, "join.heroTitle")}</p>
          {msg && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm">{msg}</div>}
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="name">{t(lang, "auth.nickname")}</label>
              <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder={t(lang, "auth.nicknamePlaceholder")} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="email">{t(lang, "auth.email")}</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="password">{t(lang, "auth.password")}</label>
              <input id="password" type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder={t(lang, "auth.passwordPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="confirmPassword">{t(lang, "auth.confirmPassword")}</label>
              <input id="confirmPassword" type="password" required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder={t(lang, "auth.confirmPasswordPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="inviteCode">
                {t(lang, "auth.inviteCode")} <span className="text-xs text-brand-text-muted">{t(lang, "auth.inviteCodeHint")}</span>
              </label>
              <input id="inviteCode" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent font-mono text-sm border-brand-border-subtle text-brand-navy" placeholder="BUGOO-MEMBER-XXXXXX" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? t(lang, "auth.registering") : t(lang, "nav.register")}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-brand-text-secondary">
            {t(lang, "auth.haveAccount")} <Link href="/auth/login" className="hover:underline text-brand-blue">{t(lang, "nav.login")}</Link>
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
        <h1 className="text-xl font-bold mb-2 text-center text-brand-navy">{t(lang, "auth.verifyEmailTitle")}</h1>
        <p className="text-sm text-center mb-4 text-brand-text-secondary">
          {t(lang, "auth.verifyEmailPrefix")}<span className="font-medium text-brand-text-heading">{email}</span>{t(lang, "auth.verifyEmailSuffix")}
        </p>
        {msg && <div className={`mb-4 p-3 rounded-md text-sm ${msgOk ? "bg-green-50 border border-green-200 text-green-600" : "bg-red-50 border border-red-200 text-red-600"}`}>{msg}</div>}
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="code">{t(lang, "auth.verifyCode")}</label>
            <input id="code" type="text" required value={code} onChange={e => setCode(e.target.value)}
              className="w-full rounded-lg bg-card border px-4 py-3 text-center text-2xl tracking-[0.3em] font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading" placeholder="000000" maxLength={6} />
          </div>
          <button type="submit" disabled={verifyLoading || code.length !== 6} className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {verifyLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {verifyLoading ? t(lang, "auth.verifying") : t(lang, "auth.verifyBtn")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-brand-text-secondary">
          {t(lang, "auth.noEmailHint")}{" "}
          <button type="button" onClick={handleResend} disabled={resendLoading} className="hover:underline text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-brand-blue">
            {resendLoading && <div className="w-3 h-3 border-2 border-[#3388BB] border-t-transparent rounded-full animate-spin" />}
            {t(lang, "auth.resendCode")}
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
