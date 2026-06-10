"use client";

import { useState } from "react";

interface Result {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  results: { id: string; name: string | null; status: string; oldSize?: number; newSize?: number }[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CompressAvatarsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");

  async function handleCompress() {
    if (!confirm("将压缩所有用户头像到 64×64。已有头像将被替换为新文件。继续？")) return;

    setStatus("loading");
    setResult(null);
    setMessage("正在处理，请稍候…");

    try {
      const res = await fetch("/api/admin/compress-avatars", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "压缩失败");
      setResult(json as Result);

      const r = json as Result;
      if (r.total === 0) {
        setMessage("没有需要处理的头像。");
      } else {
        setMessage(`处理完成：${r.success} 成功 / ${r.skipped} 跳过 / ${r.failed} 失败（共 ${r.total} 个）`);
      }
      setStatus("done");
    } catch (err: any) {
      setMessage("❌ " + (err.message || "压缩失败"));
      setStatus("error");
    }
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <div className="inline-flex items-center gap-3">
        <button
          onClick={handleCompress}
          disabled={status === "loading"}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: status === "done" ? "#88C232" : status === "error" ? "#E38043" : "#E8A040",
            color: "#fff",
          }}
        >
          {status === "loading" ? (
            <span className="inline-flex items-center gap-1.5">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              压缩中…
            </span>
          ) : (
            "压缩所有头像"
          )}
        </button>
        {message && (
          <span className="text-xs" style={{ color: status === "error" ? "#E38043" : "#555" }}>
            {message}
          </span>
        )}
      </div>

      {/* 详细结果列表 */}
      {result && result.results.length > 0 && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border text-xs" style={{ borderColor: "#D0DEE8" }}>
          <table className="w-full">
            <thead className="sticky top-0" style={{ background: "#F0F5FA" }}>
              <tr>
                <th className="text-left px-3 py-1.5 font-medium" style={{ color: "#555" }}>用户</th>
                <th className="text-left px-3 py-1.5 font-medium" style={{ color: "#555" }}>状态</th>
                <th className="text-right px-3 py-1.5 font-medium" style={{ color: "#555" }}>变化</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "#E6F0F8" }}>
                  <td className="px-3 py-1.5" style={{ color: "#333" }}>{r.name || r.id.slice(0, 8)}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs"
                      style={{
                        background: r.status === "成功" ? "#E8F5E9" : r.status.startsWith("已") ? "#FFF3E0" : "#FDE8E8",
                        color: r.status === "成功" ? "#2E7D32" : r.status.startsWith("已") ? "#E65100" : "#C62828",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: r.newSize ? "#2E7D32" : "#999" }}>
                    {r.oldSize && r.newSize
                      ? `${formatBytes(r.oldSize)} → ${formatBytes(r.newSize)}`
                      : r.oldSize
                        ? formatBytes(r.oldSize)
                        : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
