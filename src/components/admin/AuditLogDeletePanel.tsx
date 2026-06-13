"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuditLogDeletePanel({ total }: { total: number }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState("");
  const [nValue, setNValue] = useState("");
  const [showLastN, setShowLastN] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete(mode: "lastN" | "all", n?: number) {
    setDeleting(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/audit-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "lastN" ? { mode: "lastN", n } : { mode: "all" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "删除失败");
      setMsg(`已删除 ${json.deleted} 条记录`);
      setShowLastN(false);
      setShowAll(false);
      setNValue("");
      setConfirmText("");
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border border-brand-border-subtle p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-navy">
          审计日志管理
          <span className="text-xs font-normal ml-2 text-brand-text-muted">共 {total} 条</span>
        </h3>
      </div>

      <div className="flex flex-wrap gap-3 items-start">
        {/* 删除最后 N 条 */}
        {!showLastN ? (
          <button
            type="button"
            onClick={() => setShowLastN(true)}
            disabled={deleting || total === 0}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 border-brand-border-subtle text-brand-text-muted bg-card"
          >
            🗑️ 删除末尾 N 条
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-brand-text-body">删除最后</span>
            <input
              type="number"
              min={1}
              max={Math.min(total, 1000)}
              value={nValue}
              onChange={(e) => setNValue(e.target.value)}
              placeholder="N"
              className="w-20 rounded border px-2 py-1 text-sm text-center border-brand-border-subtle text-brand-text-heading"
            />
            <span className="text-xs text-brand-text-body">条</span>
            <button
              type="button"
              disabled={deleting || !nValue || parseInt(nValue, 10) < 1}
              onClick={() => {
                const n = parseInt(nValue, 10);
                if (n > 0 && confirm(`确认删除最后 ${n} 条审计日志？此操作不可撤回。`)) {
                  handleDelete("lastN", n);
                }
              }}
              className="text-xs px-3 py-1 rounded-lg text-white transition-colors disabled:opacity-50 bg-brand-orange"
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => { setShowLastN(false); setNValue(""); }}
              className="text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 border-brand-border-subtle text-brand-text-muted bg-card"
            >
              取消
            </button>
          </div>
        )}

        {/* 删除全部 */}
        {!showAll ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            disabled={deleting || total === 0}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 border-[var(--ui-bg-red-light)] text-[var(--ui-text-red)] bg-card"
          >
            🗑️ 删除全部
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--ui-text-red)]">
              确认删除全部 {total} 条？请输入「确认删除」：
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="确认删除"
              className="rounded border px-2 py-1 text-sm border-[var(--ui-bg-red-light)] text-brand-text-heading"
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmText === "确认删除") {
                  handleDelete("all");
                }
              }}
            />
            <button
              type="button"
              disabled={deleting || confirmText !== "确认删除"}
              onClick={() => {
                if (confirmText === "确认删除") {
                  handleDelete("all");
                }
              }}
              className="text-xs px-3 py-1 rounded-lg text-white transition-colors disabled:opacity-50 bg-[var(--ui-text-red)]"
            >
              {deleting ? "删除中..." : "确认删除全部"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => { setShowAll(false); setConfirmText(""); }}
              className="text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 border-brand-border-subtle text-brand-text-muted bg-card"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`text-xs px-3 py-1.5 rounded-lg ${
          msg.includes("已删除") ? "bg-[var(--ui-bg-green-light)] text-[var(--ui-text-green)]" : "bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
        }`}>
          {msg}
        </div>
      )}
    </div>
  );
}
