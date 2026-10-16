"use client";

/**
 * 监控页面密码门控
 * 未设置时先走设置；已设置则只显示验证框，不再预填任何密码。
 */
import { useCallback, useEffect, useState } from "react";
import MonitoringPasswordCard from "@/components/admin/MonitoringPasswordCard";

export default function MonitorGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshConfigured = useCallback(() => {
    fetch("/api/admin/monitoring-password")
      .then((r) => r.json())
      .then((j) => setConfigured(!!j.configured))
      .catch(() => setConfigured(null));
  }, []);

  useEffect(() => {
    refreshConfigured();
  }, [refreshConfigured]);

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
    [password],
  );

  if (granted) return <>{children}</>;

  if (configured === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <MonitoringPasswordCard
          mode="setup"
          onConfigured={() => {
            setConfigured(true);
            setPassword("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-card rounded-xl border border-brand-border-subtle p-8 shadow-sm max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold mb-2 text-brand-navy">监控总览</h2>
          <p className="text-sm text-brand-orange">涉及到网站后台重要数据</p>
          <p className="text-xs mt-2 text-brand-text-muted">请输入监控密码以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入监控密码"
              autoFocus
              autoComplete="current-password"
              className={`w-full px-4 py-3 rounded-lg border text-sm outline-none transition-colors focus:border-[#3388BB] ${
                error ? "border-brand-orange" : "border-brand-border-subtle"
              } text-brand-text-heading`}
              disabled={loading || configured === null}
            />
            {error && <p className="text-xs mt-1.5 text-brand-orange">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || configured === null}
            className="w-full py-3 rounded-lg text-white font-medium text-sm transition-all hover:opacity-90 disabled:opacity-50 bg-brand-navy"
          >
            {loading ? "验证中..." : "确认进入"}
          </button>
        </form>
      </div>
    </div>
  );
}
