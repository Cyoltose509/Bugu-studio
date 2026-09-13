"use client";

import { useEffect, useState } from "react";

/**
 * 管理员可在仪表盘重置监控页第二道门锁密码（无需知道旧密码）
 */
export default function MonitoringPasswordCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/monitoring-password")
      .then((r) => r.json())
      .then((j) => setConfigured(!!j.configured))
      .catch(() => setConfigured(null));
  }, []);

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
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setMsg("已更新。请把新密码私下交给需要进监控页的人。");
        setConfigured(true);
        setPassword("");
        setConfirm("");
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
    <div className="bg-card rounded-xl border p-5 shadow-sm border-brand-border-subtle">
      <h2 className="font-semibold mb-1 text-brand-navy">监控页密码</h2>
      <p className="text-xs mb-4 text-brand-text-secondary">
        监控总览有第二道门锁。密码存在数据库里（加密），环境文件里没有明文。
        接手后若不知道旧密码，在这里直接设一个新的即可。
        {configured === true && " 当前：已配置。"}
        {configured === false && " 当前：尚未配置。"}
      </p>
      <form onSubmit={onSubmit} className="space-y-3 max-w-md">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="新密码（至少 8 位）"
          className="w-full px-3 py-2 rounded-lg border text-sm border-brand-border-subtle"
          autoComplete="new-password"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再输入一次"
          className="w-full px-3 py-2 rounded-lg border text-sm border-brand-border-subtle"
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm text-white bg-brand-navy disabled:opacity-50"
        >
          {loading ? "保存中..." : "设置 / 重置监控密码"}
        </button>
        {msg && <p className="text-xs text-brand-text-secondary">{msg}</p>}
      </form>
    </div>
  );
}
