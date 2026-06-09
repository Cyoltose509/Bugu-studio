"use client";

import { useState } from "react";

export default function SyncOrphanedButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");

  async function handleSync() {
    setStatus("loading");
    setResult("");
    try {
      const res = await fetch("/api/admin/sync-orphaned-projects", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "同步失败");
      if (json.synced === 0 || !json.details || json.details.length === 0) {
        setResult(json.message || "✅ 没有孤儿项目，数据已完全同步。");
      } else {
        setResult(
          `✅ 已同步 ${json.synced} 个孤儿项目：\n${(json.details as string[]).map((d) => "  · " + d).join("\n")}`
        );
      }
      setStatus("done");
    } catch (err: any) {
      setResult("❌ " + (err.message || "同步失败"));
      setStatus("error");
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        style={{
          background: status === "done" ? "#88C232" : status === "error" ? "#E38043" : "#3388BB",
          color: "#fff",
        }}
      >
        {status === "loading" ? "同步中..." : "同步孤儿项目"}
      </button>
      {result && (
        <span className="text-xs whitespace-pre-wrap" style={{ color: status === "error" ? "#E38043" : "#555" }}>
          {result}
        </span>
      )}
    </div>
  );
}
