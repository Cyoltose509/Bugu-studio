"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface BackupVersion {
  id: string;
  version: number;
  label: string | null;
  recordCount: number;
  status: string;
  createdAt: string;
  logCount: number;
}

interface RestoreResult {
  date: string;
  totalBefore: number;
  totalBackup: number;
  restoredCount: number;
  restored: string[];
  skipped: string[];
  missingTables: string[];
}

export default function BackupsPage() {
  const [versions, setVersions] = useState<BackupVersion[]>([]);
  const [activeLogCount, setActiveLogCount] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [msg, setMsg] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backups");
      if (res.ok) {
        const json = await res.json();
        setVersions(json.data.versions);
        setActiveLogCount(json.data.activeLogCount);
        setTotalLogs(json.data.totalLogs);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function doBackup() {
    setBacking(true); setMsg("");
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setMsg(`大版本 v${json.data.version.version} 备份完成，${json.data.totalRecords} 条记录`);
        fetchData();
      } else {
        const json = await res.json();
        setMsg(json.error || "备份失败");
      }
    } catch { setMsg("网络错误"); }
    finally { setBacking(false); }
  }

  async function doRestore(v: BackupVersion) {
    const date = new Date(v.createdAt).toISOString().slice(0, 10);
    if (!confirm(
      `⚠️ 危险操作\n\n确定要恢复到 ${date} 的备份（大版本 v${v.version}）吗？\n\n` +
      `当前所有数据将被替换为备份时的状态。\n` +
      `恢复前会自动创建安全备份，但请务必谨慎！\n\n` +
      `输入 "确认恢复" 来继续：`
    )) return;

    const confirmInput = prompt("请输入「确认恢复」以继续：");
    if (confirmInput !== "确认恢复") {
      setMsg("已取消恢复操作");
      return;
    }

    setRestoring(v.id);
    setMsg("");
    setRestoreResult(null);

    try {
      const res = await fetch("/api/admin/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (res.ok) {
        setRestoreResult(json.data as RestoreResult);
        setMsg(`恢复完成：${json.data.restoredCount} 条记录已恢复`);
        fetchData();
      } else {
        setMsg(`恢复失败：${json.error || "未知错误"}`);
      }
    } catch (e: any) {
      setMsg(`恢复异常：${e.message || "网络错误"}`);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="text-brand-text-heading">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">数据库备份与版本管理</h1>
        <button
          onClick={doBackup}
          disabled={backing}
          className={`px-5 py-2.5 rounded-lg text-white font-medium disabled:opacity-50 transition-all ${backing ? "bg-brand-text-muted" : "bg-brand-navy"}`}
        >
          {backing ? "⏳ 备份中..." : "📦 一键备份大版本"}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-md text-sm ${
          msg.includes("失败") || msg.includes("错误") || msg.includes("异常")
            ? "bg-red-50 border border-red-200 text-red-600"
            : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {msg}
        </div>
      )}

      {/* 恢复结果详情 */}
      {restoreResult && (
        <div className="mb-4 p-4 rounded-md bg-blue-50 border border-blue-200 text-sm">
          <div className="font-semibold mb-2 text-brand-navy">
            📋 恢复详情 — {restoreResult.date}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div><span className="text-brand-text-secondary">恢复前记录：</span><b>{restoreResult.totalBefore}</b></div>
            <div><span className="text-brand-text-secondary">备份记录：</span><b>{restoreResult.totalBackup}</b></div>
            <div><span className="text-brand-text-secondary">已恢复：</span><b className="text-green-800">{restoreResult.restoredCount}</b></div>
          </div>
          {restoreResult.skipped.length > 0 && (
            <div className="text-xs mt-1 text-[#E65100]">
              ⚠ 跳过：{restoreResult.skipped.join("; ")}
            </div>
          )}
          {restoreResult.missingTables.length > 0 && (
            <div className="text-xs mt-1 text-brand-text-muted">
              备份中缺失的表：{restoreResult.missingTables.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4 border-[#E0E8F0]">
          <div className="text-sm text-brand-text-secondary">审计日志总数</div>
          <div className="text-3xl font-bold mt-1 text-brand-navy">{totalLogs}</div>
        </div>
        <div className="bg-card border rounded-lg p-4 border-[#E0E8F0]">
          <div className="text-sm text-brand-text-secondary">现行版本日志</div>
          <div className="text-3xl font-bold mt-1 text-brand-orange">{activeLogCount}</div>
          <div className="text-xs mt-1 text-brand-text-muted">最新大版本之后的活跃日志</div>
        </div>
        <div className="bg-card border rounded-lg p-4 border-[#E0E8F0]">
          <div className="text-sm text-brand-text-secondary">大版本数量</div>
          <div className="text-3xl font-bold mt-1 text-brand-blue">{versions.length}</div>
        </div>
      </div>

      {/* 版本时间线 */}
      <h2 className="text-lg font-bold mb-4 text-brand-navy">版本时间线</h2>

      {loading ? (
        <div className="text-center py-8 text-brand-text-muted">加载中...</div>
      ) : versions.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg border-[#E0E8F0] text-brand-text-muted">
          暂无大版本备份，点击上方按钮创建第一个大版本
        </div>
      ) : (
        <div className="space-y-0">
          {/* 现行版本 → 活跃日志 */}
          <div className="relative pl-8 pb-6 border-l-2 border-brand-orange">
            <div className="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full border-2 bg-card border-brand-orange" />
            <div className="bg-card border rounded-lg p-3 border-[#F0D0B0] bg-[#FFFAF5]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-orange">📝 正在更新的日志</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFF0E0] text-brand-orange">{activeLogCount} 条</span>
              </div>
              <div className="text-xs mt-1 text-brand-text-muted">现行版本 — 最新大版本之后的所有操作记录</div>
              <Link href="/admin/audit-logs" className="text-xs mt-2 inline-block hover:underline text-brand-blue">
                查看日志 →
              </Link>
            </div>
          </div>

          {/* 各个大版本（倒序）*/}
          {versions.map((v, i) => (
            <div key={v.id} className={`relative pl-8 pb-6 border-l-2 ${i === versions.length - 1 ? "border-brand-border-subtle" : "border-brand-blue"}`}>
              <div className="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full border-2 bg-card border-brand-blue" />
              <div className="bg-card border rounded-lg p-3 border-brand-border-subtle">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-navy">📦 大版本 v{v.version}</span>
                    {v.label && <span className="text-xs text-brand-text-secondary">{v.label}</span>}
                  </div>
                  <button
                    onClick={() => doRestore(v)}
                    disabled={restoring === v.id}
                    className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 border-brand-orange ${
                      restoring === v.id ? "text-brand-text-muted bg-[#FFF8F0]" : "text-brand-orange"
                    }`}
                    title="恢复到该版本的备份状态"
                  >
                    {restoring === v.id ? "⏳ 恢复中..." : "🔄 恢复到此版本"}
                  </button>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-brand-text-secondary">
                  <span>{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
                  <span>{v.recordCount} 条数据</span>
                  <span className="text-brand-blue">← {v.logCount} 条阶段日志</span>
                </div>
              </div>
            </div>
          ))}

          {/* 时间线起点 */}
          <div className="relative pl-8 pb-2">
            <div className="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full border-2 bg-card border-brand-border-subtle" />
            <div className="text-xs text-[#BBB]">🏁 数据库初始状态</div>
          </div>
        </div>
      )}
    </div>
  );
}
