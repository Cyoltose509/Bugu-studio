"use client";

import { useState, useEffect, useCallback } from "react";

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

/** 折叠式备份管理区段 — 含备份创建、恢复、删除功能 */
export default function BackupSection() {
  const [versions, setVersions] = useState<BackupVersion[]>([]);
  const [activeLogCount, setActiveLogCount] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [backing, setBacking] = useState(false);
  const [msg, setMsg] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    if (expanded && versions.length === 0) fetchData();
  }, [expanded, versions.length, fetchData]);

  function doToggle() {
    if (!expanded) {
      setExpanded(true);
    } else {
      setExpanded(false);
      setMsg("");
      setRestoreResult(null);
    }
  }

  async function doBackup() {
    setBacking(true); setMsg("");
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setMsg(`大版本 v${json.data.version.version} 备份完成，${json.data.totalRecords} 条记录`);
        fetchData();
      } else {
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
    if (confirmInput !== "确认恢复") { setMsg("已取消恢复操作"); return; }

    setRestoring(v.id); setMsg(""); setRestoreResult(null);

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

  async function doDelete(v: BackupVersion) {
    if (!confirm(
      `⚠️ 危险操作\n\n确定删除大版本 v${v.version} 吗？\n` +
      `备份日期：${new Date(v.createdAt).toISOString().slice(0, 10)}\n` +
      `包含 ${v.recordCount} 条记录\n\n` +
      `此操作不可撤销！`
    )) return;

    setDeleting(v.id); setMsg("");
    try {
      const res = await fetch("/api/admin/backups/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: v.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`大版本 v${v.version} 已删除${json.data.filesDeleted ? "（含备份文件）" : ""}`);
        fetchData();
      } else {
        setMsg(`删除失败：${json.error || "未知错误"}`);
      }
    } catch (e: any) {
      setMsg(`删除异常：${e.message || "网络错误"}`);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-border-subtle p-6 shadow-sm bg-card">
      <button
        onClick={doToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-brand-navy">💾 数据库备份与版本管理</h3>
          <p className="text-sm mt-0.5 text-brand-text-muted">创建、恢复、删除大版本备份</p>
        </div>
        <span
          className={`text-lg transition-transform text-brand-text-muted ${expanded ? "rotate-180" : ""}`}
        >▼</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* 操作栏 */}
          <div className="flex items-center gap-3">
            <button
              onClick={doBackup}
              disabled={backing}
              className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition disabled:opacity-50 ${
                backing ? "bg-[#aaa]" : "bg-brand-navy"
              }`}
            >
              {backing ? "⏳ 备份中..." : "📦 一键备份大版本"}
            </button>
            <span className="text-xs text-brand-text-muted">将当前全部数据导出为新的备份版本</span>
          </div>

          {msg && (
            <div className={`p-3 rounded-md text-sm ${
              msg.includes("失败") || msg.includes("错误") || msg.includes("异常")
                ? "bg-red-50 border border-red-200 text-red-600"
                : msg.includes("取消")
                  ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
                  : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {msg}
            </div>
          )}

          {restoreResult && (
            <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-sm">
              <div className="font-semibold mb-2 text-brand-navy">📋 恢复详情 — {restoreResult.date}</div>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div><span className="text-brand-text-muted">恢复前：</span><b>{restoreResult.totalBefore}</b></div>
                <div><span className="text-brand-text-muted">备份：</span><b>{restoreResult.totalBackup}</b></div>
                <div><span className="text-brand-text-muted">已恢复：</span><b className="text-[var(--ui-text-green)]">{restoreResult.restoredCount}</b></div>
              </div>
              {restoreResult.skipped.length > 0 && (
                <div className="text-xs text-[#E65100]">⚠ 跳过：{restoreResult.skipped.join("; ")}</div>
              )}
            </div>
          )}

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-[#E0E8F0] rounded-lg p-3">
              <div className="text-xs text-brand-text-muted">审计日志总数</div>
              <div className="text-xl font-bold mt-0.5 text-brand-navy">{totalLogs}</div>
            </div>
            <div className="bg-card border border-[#E0E8F0] rounded-lg p-3">
              <div className="text-xs text-brand-text-muted">现行版本日志</div>
              <div className="text-xl font-bold mt-0.5 text-brand-orange">{activeLogCount}</div>
            </div>
            <div className="bg-card border border-[#E0E8F0] rounded-lg p-3">
              <div className="text-xs text-brand-text-muted">大版本数量</div>
              <div className="text-xl font-bold mt-0.5 text-brand-blue">{versions.length}</div>
            </div>
          </div>

          {/* 版本时间线 */}
          {loading ? (
            <div className="text-center py-6 text-sm text-brand-text-muted">加载中...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 bg-card border border-[#E0E8F0] rounded-lg text-brand-text-muted">
              暂无大版本备份，点击上方按钮创建
            </div>
          ) : (
            <div className="space-y-0">
              {/* 现行版本 */}
              <div className="relative pl-8 pb-5 border-l-2 border-brand-orange">
                <div className="absolute left-0 top-0 w-3.5 h-3.5 -translate-x-[8px] rounded-full border-2 bg-card border-brand-orange" />
                <div className="bg-card border border-[#F0D0B0] rounded-lg p-3 bg-[#FFFAF5]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-orange">📝 正在更新的日志</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFF0E0] text-brand-orange">{activeLogCount} 条</span>
                  </div>
                  <div className="text-xs mt-1 text-brand-text-muted">现行版本 — 最新大版本之后的所有操作记录</div>
                </div>
              </div>

              {/* 各版本 */}
              {versions.map((v, i) => (
                <div
                  key={v.id}
                  className={`relative pl-8 pb-5 border-l-2 ${
                    i === versions.length - 1 ? "border-brand-border-subtle" : "border-brand-blue"
                  }`}
                >
                  <div className="absolute left-0 top-0 w-3.5 h-3.5 -translate-x-[8px] rounded-full border-2 bg-card border-brand-blue" />
                  <div className="bg-card border border-brand-border-subtle rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-navy">📦 大版本 v{v.version}</span>
                        {v.label && <span className="text-xs text-brand-text-muted">{v.label}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => doRestore(v)}
                          disabled={restoring === v.id || deleting === v.id}
                          className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                            restoring === v.id
                              ? "border-brand-orange text-brand-text-muted bg-[#FFF8F0]"
                              : "border-brand-orange text-brand-orange bg-transparent"
                          }`}
                        >
                          {restoring === v.id ? "⏳ 恢复中..." : "🔄 恢复"}
                        </button>
                        <button
                          onClick={() => doDelete(v)}
                          disabled={deleting === v.id || restoring === v.id}
                          className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                            deleting === v.id
                              ? "border-[#E74C3C] text-brand-text-muted bg-[#FFF0F0]"
                              : "border-[#E74C3C] text-[#E74C3C] bg-transparent"
                          }`}
                        >
                          {deleting === v.id ? "⏳ 删除中..." : "🗑 删除"}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-brand-text-muted">
                      <span>{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
                      <span>{v.recordCount} 条数据</span>
                      <span className="text-brand-blue">← {v.logCount} 条阶段日志</span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="relative pl-8 pb-2">
                <div className="absolute left-0 top-0 w-3.5 h-3.5 -translate-x-[8px] rounded-full border-2 bg-card border-brand-border-subtle" />
                <div className="text-xs text-[#BBB]">🏁 数据库初始状态</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
