"use client";

import { useState } from "react";

/**
 * 监控页第二道门锁：仅出现在系统管理内。
 * 初次设置不需要旧密码；之后改密必须先核对当前密码。
 */
export default function MonitoringPasswordCard({
  mode,
  onConfigured,
}: {
  mode: "setup" | "change";
  onConfigured?: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (password !== confirm) {
      setMsg("两次输入不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/monitoring-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          currentPassword: mode === "change" ? current : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setMsg(mode === "setup" ? "已设置，请用新密码进入。" : "已更新。");
        setCurrent("");
        setPassword("");
        setConfirm("");
        onConfigured?.();
      } else {
        setMsg(json.error || "更新失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm border-brand-border-subtle max-w-md">
      <h2 className="font-semibold mb-1 text-brand-navy">
        {mode === "setup" ? "设置监控页密码" : "更改监控页密码"}
      </h2>
      <p className="text-xs mb-4 text-brand-text-secondary">
        {mode === "setup"
          ? "系统管理有第二道门锁。设好之后，进监控页都要再输一次。"
          : "更改后请私下告知需要进监控页的管理员。不会写进环境变量。"}
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "change" && (
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="当前监控密码"
            className="w-full px-3 py-2 rounded-lg border text-sm border-brand-border-subtle"
            autoComplete="current-password"
            required
          />
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="新密码（至少 8 位）"
          className="w-full px-3 py-2 rounded-lg border text-sm border-brand-border-subtle"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再输入一次"
          className="w-full px-3 py-2 rounded-lg border text-sm border-brand-border-subtle"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm text-white bg-brand-navy disabled:opacity-50"
        >
          {loading ? "保存中..." : mode === "setup" ? "设置密码" : "更新密码"}
        </button>
        {msg && <p className="text-xs text-brand-text-secondary">{msg}</p>}
      </form>
    </div>
  );
}
