/**
 * 隐私设置 — 修改密码 + 注销账号
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";

const inputClass = "w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading";

export default function PrivacyPage() {
  const router = useRouter();

  // ── 修改密码 ──
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess("");
    if (newPwd.length < 8) { setPwdError("新密码长度至少为 8 位"); return; }
    if (newPwd !== confirmPwd) { setPwdError("两次输入的新密码不一致"); return; }
    if (newPwd === currentPwd) { setPwdError("新密码不能与当前密码相同"); return; }
    setPwdLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd, confirmPassword: confirmPwd }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setPwdError(json?.error || "修改失败");
      } else {
        setPwdSuccess("密码已修改");
        setCurrentPwd("");
        setNewPwd("");
        setConfirmPwd("");
      }
    } catch {
      setPwdError("网络错误，请稍后重试");
    } finally {
      setPwdLoading(false);
    }
  }

  // ── 注销账号 ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "注销") {
      setDeleteError("请输入「注销」确认");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/user/delete-account", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteError(json?.error || "注销失败");
        setDeleteLoading(false);
      } else {
        await signOut({ redirect: false });
        router.push("/auth/login");
      }
    } catch {
      setDeleteError("网络错误，请稍后重试");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in space-y-8">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-brand-text-muted">
        <Link href="/profile" className="hover:text-brand-blue transition-colors">个人中心</Link>
        <span>/</span>
        <span className="text-brand-text-heading">隐私设置</span>
      </div>

      <h1 className="text-2xl font-bold text-brand-navy">隐私设置</h1>

      {/* ══════════ 修改密码 ══════════ */}
      <div className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm">
        <h2 className="font-semibold mb-1 text-brand-navy">修改密码</h2>
        <p className="text-xs text-brand-text-muted mb-5">更换您的登录密码</p>
        <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="currentPwd">当前密码</label>
            <input
              id="currentPwd"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="newPwd">新密码</label>
            <input
              id="newPwd"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
            <p className="text-[11px] text-brand-text-muted mt-1">至少 8 位字符</p>
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="confirmPwd">确认新密码</label>
            <input
              id="confirmPwd"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          {pwdError && (
            <div className="text-sm px-4 py-2.5 rounded-lg bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="text-sm px-4 py-2.5 rounded-lg bg-[var(--ui-bg-green-light)] text-[var(--ui-text-green)]">
              {pwdSuccess}
            </div>
          )}
          <button
            type="submit"
            disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors bg-brand-navy hover:bg-[#1a3a4a]"
          >
            {pwdLoading ? "修改中..." : "修改密码"}
          </button>
        </form>
      </div>

      {/* ══════════ 注销账号 ══════════ */}
      <div className="bg-card rounded-xl border border-red-100 p-6 shadow-sm">
        <h2 className="font-semibold mb-1 text-red-700">注销账号</h2>
        <p className="text-xs text-brand-text-muted mb-5">
          注销后，您的个人信息将被清除，但您参与的作品记录将保留。
          已发布的评论和点赞将被保留但显示为「已注销用户」。
          此操作不可撤销。
        </p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors bg-red-600 hover:bg-red-700"
          >
            注销账号
          </button>
        ) : (
          <div className="space-y-4 max-w-sm p-4 rounded-lg border border-red-200 bg-red-50">
            <div className="text-sm text-red-800">
              <p className="font-medium mb-1">⚠️ 确认注销账号</p>
              <p>请在下方输入「注销」以确认：</p>
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                setDeleteError("");
              }}
              placeholder="输入「注销」"
              className={inputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDeleteAccount();
              }}
            />
            {deleteError && (
              <div className="text-sm px-3 py-2 rounded bg-red-100 text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== "注销"}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? "注销中..." : "确认注销"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError("");
                }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-brand-border-subtle text-brand-text-body hover:bg-muted"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
