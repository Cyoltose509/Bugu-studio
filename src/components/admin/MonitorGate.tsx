"use client";

/**
 * 监控页面密码门控
 * 显示密码输入界面，验证通过后才渲染 children
 */
import { useState, useCallback } from "react";

export default function MonitorGate({
  children,
  autoFillPassword,
}: {
  children: React.ReactNode;
  autoFillPassword?: string;
}) {
  const [granted, setGranted] = useState(false);
  const [password, setPassword] = useState(autoFillPassword || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) {
        setError("请输入密码");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/verify-monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
        });
        const data = await res.json();
        if (data.ok) {
          setGranted(true);
        } else {
          setError(data.error || "验证失败");
        }
      } catch {
        setError("网络错误，请重试");
      } finally {
        setLoading(false);
      }
    },
    [password]
  );

  if (granted) return <>{children}</>;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-card rounded-xl border border-brand-border-subtle p-8 shadow-sm max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold mb-2 text-brand-navy">
            监控总览
          </h2>
          <p className="text-sm text-brand-orange">
            ⚠️ 涉及到网站后台重要数据
          </p>
          <p className="text-xs mt-2 text-brand-text-muted">
            请输入管理密码以继续访问
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入监控密码"
              autoFocus
              className={`w-full px-4 py-3 rounded-lg border text-sm outline-none transition-colors focus:border-[#3388BB] ${
                error ? "border-brand-orange" : "border-brand-border-subtle"
              } text-brand-text-heading`}
              disabled={loading}
            />
            {error && (
              <p className="text-xs mt-1.5 text-brand-orange">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-medium text-sm transition-all hover:opacity-90 disabled:opacity-50 bg-brand-navy"
          >
            {loading ? "验证中..." : "确认进入"}
          </button>
        </form>
      </div>
    </div>
  );
}
