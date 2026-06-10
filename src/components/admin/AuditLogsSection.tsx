"use client";

import { useState } from "react";
import type { AuditAction } from "@prisma/client";

interface AuditLogEntry {
  id: string;
  action: AuditAction | string;
  targetType: string | null;
  targetId: string | null;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

const ACTION_FILTERS = [
  { value: "", label: "全部" },
  { value: "CREATE", label: "创建" },
  { value: "UPDATE", label: "更新" },
  { value: "DELETE", label: "删除" },
  { value: "ADMIN_ACTION", label: "管理员" },
  { value: "OTHER", label: "其他" },
];

const MODEL_FILTERS = [
  { value: "", label: "全部表" },
  { value: "User", label: "用户" },
  { value: "Project", label: "作品" },
  { value: "ClubMember", label: "成员" },
  { value: "Review", label: "审核" },
  { value: "Comment", label: "评论" },
  { value: "Tag", label: "标签" },
];

/** 折叠式审计日志区段 */
export default function AuditLogsSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [action, setAction] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function fetchLogs(p: number, a: string, m: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (a) params.set("action", a);
      if (m) params.set("model", m);
      params.set("page", String(p));
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "查询失败");
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function switchFilter(a: string, m: string) {
    setAction(a);
    setModel(m);
    setPage(1);
    fetchLogs(1, a, m);
  }

  function doToggle() {
    if (!expanded) {
      setExpanded(true);
      fetchLogs(1, "", "");
    } else {
      setExpanded(false);
    }
  }

  return (
    <div className="rounded-2xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "#D0DEE8" }}>
      <button
        onClick={doToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "#25547A" }}>📋 审计日志</h3>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>数据库操作记录，支持按类型和表筛选</p>
        </div>
        <span className="text-lg transition-transform" style={{ color: "#999", transform: expanded ? "rotate(180deg)" : "" }}>▼</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* 筛选栏 */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-medium mr-1" style={{ color: "#777" }}>操作:</span>
              {ACTION_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => switchFilter(f.value, model)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    action === f.value ? "font-medium text-white" : ""
                  }`}
                  style={action === f.value ? { background: "#25547A" } : { color: "#555", background: "#F0F5F9" }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-medium mr-1" style={{ color: "#777" }}>涉及:</span>
              {MODEL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => switchFilter(action, f.value)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    model === f.value ? "font-medium text-white" : ""
                  }`}
                  style={model === f.value ? { background: "#25547A" } : { color: "#555", background: "#F0F5F9" }}
                >
                  {f.label}
                </button>
              ))}
              {total > 0 && <span className="text-xs ml-2" style={{ color: "#999" }}>共 {total} 条</span>}
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {error}</div>}

          {loading ? (
            <div className="text-center py-6 text-sm" style={{ color: "#999" }}>加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: "#999" }}>暂无审计日志</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#E6F0F8" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "#F0F5FA" }}>
                    <tr>
                      <th className="text-left p-2.5 font-medium text-xs" style={{ color: "#555" }}>时间</th>
                      <th className="text-left p-2.5 font-medium text-xs" style={{ color: "#555" }}>用户</th>
                      <th className="text-left p-2.5 font-medium text-xs" style={{ color: "#555" }}>操作</th>
                      <th className="text-left p-2.5 font-medium text-xs" style={{ color: "#555" }}>目标</th>
                      <th className="text-left p-2.5 font-medium text-xs" style={{ color: "#555" }}>IP</th>
                      <th className="text-left p-2.5 font-medium text-xs" style={{ color: "#555" }}>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t hover:bg-[#F0F5F9] transition-colors" style={{ borderColor: "#EEE" }}>
                        <td className="p-2.5 text-xs whitespace-nowrap" style={{ color: "#999" }}>
                          {new Date(log.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-2.5"><span className="text-xs" style={{ color: "#333" }}>{log.user?.name || log.user?.email?.split("@")[0] || "系统"}</span></td>
                        <td className="p-2.5">
                          <span className="text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{
                            background: log.action === "DELETE" ? "#FDE8E8" : log.action === "CREATE" ? "#E8F5E9" : log.action === "UPDATE" ? "#E3F2FD" : "#FFF3E0",
                            color: log.action === "DELETE" ? "#C62828" : log.action === "CREATE" ? "#2E7D32" : log.action === "UPDATE" ? "#1565C0" : "#E65100",
                          }}>{log.action}</span>
                        </td>
                        <td className="p-2.5"><span className="text-xs" style={{ color: "#333" }}>{log.targetType || "-"}</span></td>
                        <td className="p-2.5 text-xs font-mono" style={{ color: "#999" }}>{log.ipAddress || "-"}</td>
                        <td className="p-2.5 text-xs" style={{ color: "#777" }}>
                          {log.metadata?.changedFields?.length
                            ? `字段: ${log.metadata.changedFields.join(", ")}`
                            : log.metadata?.elapsed
                              ? `${log.metadata.elapsed}ms`
                              : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => { setPage(page - 1); fetchLogs(page - 1, action, model); }}
                    className="px-3 py-1 rounded text-xs border disabled:opacity-30"
                    style={{ borderColor: "#D0DEE8", color: "#555" }}
                  >
                    上一页
                  </button>
                  <span className="text-xs" style={{ color: "#777" }}>{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => { setPage(page + 1); fetchLogs(page + 1, action, model); }}
                    className="px-3 py-1 rounded text-xs border disabled:opacity-30"
                    style={{ borderColor: "#D0DEE8", color: "#555" }}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
