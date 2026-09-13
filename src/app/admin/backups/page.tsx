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
  version: number;
  totalBackup: number;
  restoredCount: number;
  restored: string[];
  note?: string;
}

export default function BackupsPage() {
  const [versions, setVersions] = useState<BackupVersion[]>([]);
  const [activeLogCount, setActiveLogCount] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [msg, setMsg] = useState("");
  const [restoring, setRestoring] = useState<number | null>(null);
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function doBackup() {
    setBacking(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setMsg(
          `大版本 v${json.data.version.version} 已备份到云端（R2），共 ${json.data.totalRecords} 条记录`
        );
        fetchData();
      } else {
        setMsg(json.error || "备份失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setBacking(false);
    }
  }

  async function doRestore(v: BackupVersion) {
    if (
      !confirm(
        `危险操作\n\n确定要恢复到大版本 v${v.version} 吗？\n\n` +
          `当前数据库会被整库替换为该备份内容（在一个事务里完成，失败会自动回滚）。\n` +
          `恢复后可能需要重新登录。`
      )
    ) {
      return;
    }

    const confirmInput = prompt("请输入「确认恢复」以继续：");
    if (confirmInput !== "确认恢复") {
      setMsg("已取消恢复操作");
      return;
    }

    setRestoring(v.version);
    setMsg("");
    setRestoreResult(null);

    try {
      const res = await fetch("/api/admin/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: v.version, confirm: "确认恢复" }),
      });
      const json = await res.json();
      if (res.ok) {
        setRestoreResult(json.data as RestoreResult);
        setMsg(`恢复完成：v${json.data.version}，已写入 ${json.data.restoredCount} 条记录`);
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
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">数据库备份与版本管理</h1>
          <p className="text-sm mt-1 text-brand-text-secondary">
            备份先 AES 加密再写入 Cloudflare R2；恢复按版本号整库替换（单事务，失败回滚）。
            旧的本地日期目录明文备份不可用。
          </p>
        </div>
        <button
          onClick={doBackup}
          disabled={backing}
          className={`px-5 py-2.5 rounded-lg text-white font-medium disabled:opacity-50 transition-all ${
            backing ? "bg-brand-text-muted" : "bg-brand-navy"
          }`}
        >
          {backing ? "备份中..." : "一键备份大版本"}
        </button>
      </div>

      {msg && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            msg.includes("失败") || msg.includes("错误") || msg.includes("异常")
              ? "bg-red-50 border border-red-200 text-red-600"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {msg}
        </div>
      )}

      {restoreResult && (
        <div className="mb-4 p-4 rounded-md bg-blue-50 border border-blue-200 text-sm">
          <div className="font-semibold mb-2 text-brand-navy">恢复详情 — v{restoreResult.version}</div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <span className="text-brand-text-secondary">备份记录：</span>
              <b>{restoreResult.totalBackup}</b>
            </div>
            <div>
              <span className="text-brand-text-secondary">已恢复：</span>
              <b className="text-green-800">{restoreResult.restoredCount}</b>
            </div>
          </div>
          {restoreResult.note && (
            <div className="text-xs mt-1 text-brand-text-muted">{restoreResult.note}</div>
          )}
        </div>
      )}

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

      <h2 className="text-lg font-bold mb-4 text-brand-navy">版本时间线</h2>

      {loading ? (
        <div className="text-center py-8 text-brand-text-muted">加载中...</div>
      ) : versions.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg border-[#E0E8F0] text-brand-text-muted">
          暂无大版本备份。请先点「一键备份大版本」生成可恢复的云端快照。
        </div>
      ) : (
        <div className="space-y-0">
          <div className="relative pl-8 pb-6 border-l-2 border-brand-orange">
            <div className="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full border-2 bg-card border-brand-orange" />
            <div className="bg-card border rounded-lg p-3 border-[#F0D0B0] bg-[#FFFAF5]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-orange">正在更新的日志</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFF0E0] text-brand-orange">
                  {activeLogCount} 条
                </span>
              </div>
              <div className="text-xs mt-1 text-brand-text-muted">现行版本 — 最新大版本之后的所有操作记录</div>
              <Link href="/admin/audit-logs" className="text-xs mt-2 inline-block hover:underline text-brand-blue">
                查看日志 →
              </Link>
            </div>
          </div>

          {versions.map((v, i) => (
            <div
              key={v.id}
              className={`relative pl-8 pb-6 border-l-2 ${
                i === versions.length - 1 ? "border-brand-border-subtle" : "border-brand-blue"
              }`}
            >
              <div className="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full border-2 bg-card border-brand-blue" />
              <div className="bg-card border rounded-lg p-3 border-brand-border-subtle">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-brand-navy">大版本 v{v.version}</span>
                    {v.label && <span className="text-xs text-brand-text-secondary">{v.label}</span>}
                  </div>
                  <button
                    onClick={() => doRestore(v)}
                    disabled={restoring === v.version}
                    className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 border-brand-orange ${
                      restoring === v.version ? "text-brand-text-muted bg-[#FFF8F0]" : "text-brand-orange"
                    }`}
                    title="恢复到该版本"
                  >
                    {restoring === v.version ? "恢复中..." : "恢复到此版本"}
                  </button>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-brand-text-secondary flex-wrap">
                  <span>{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
                  <span>{v.recordCount} 条数据</span>
                  <span className="text-brand-blue">← {v.logCount} 条阶段日志</span>
                </div>
              </div>
            </div>
          ))}

          <div className="relative pl-8 pb-2">
            <div className="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full border-2 bg-card border-brand-border-subtle" />
            <div className="text-xs text-[#BBB]">数据库初始状态</div>
          </div>
        </div>
      )}
    </div>
  );
}
