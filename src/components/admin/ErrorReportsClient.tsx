"use client";

import { useState, useEffect, useCallback } from "react";

interface ErrorReport {
  id: string;
  reportId: number;
  message: string;
  stack: string | null;
  url: string | null;
  userId: string | null;
  userAgent: string | null;
  status: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

export default function ErrorReportsClient() {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/error-reports-data?${params}`);
      const json = await res.json();
      setReports(json.reports || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === reports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)));
    }
  };

  const markStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    await fetch("/api/admin/error-reports-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds], status }),
    });
    setSelectedIds(new Set());
    fetchReports();
  };

  const deleteSingle = async (id: string) => {
    if (!confirm("确定要删除这条错误报告吗？此操作不可撤销。")) return;
    await fetch(`/api/admin/error-reports-data?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    fetchReports();
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条错误报告吗？此操作不可撤销。`)) return;
    await fetch(`/api/admin/error-reports-data?ids=${[...selectedIds].join(",")}`, { method: "DELETE" });
    setSelectedIds(new Set());
    fetchReports();
  };

  const deleteAllResolved = async () => {
    if (!confirm("确定要删除所有已解决的错误报告吗？未读和已读的报告不会被删除。此操作不可撤销。")) return;
    await fetch("/api/admin/error-reports-data?resolved=true", { method: "DELETE" });
    fetchReports();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      UNREAD: { label: "未读", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
      READ: { label: "已读", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
      RESOLVED: { label: "已解决", cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
    };
    const b = map[s] || { label: s, cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span>;
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-[#8db8d8]">
            🔥 前端错误报告
          </h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            用户遇到错误时自动上报，含错误编号、页面地址、错误堆栈
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-[#1a2030] border-brand-border-subtle dark:border-[#2a3045] text-[#333] dark:text-[#d0d8e8]"
          >
            <option value="">全部状态</option>
            <option value="UNREAD">未读</option>
            <option value="READ">已读</option>
            <option value="RESOLVED">已解决</option>
          </select>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="text-sm px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "刷新中..." : "🔄 刷新"}
          </button>
          <button
            onClick={deleteAllResolved}
            className="text-sm px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
          >
            🗑️ 删除已解决
          </button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <span className="text-sm text-yellow-700 dark:text-yellow-400">
            已选择 {selectedIds.size} 项
          </span>
          <button onClick={() => markStatus("READ")} className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">标记已读</button>
          <button onClick={() => markStatus("RESOLVED")} className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">标记已解决</button>
          <button onClick={deleteSelected} className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">🗑️ 删除所选</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm px-3 py-1 text-gray-600 dark:text-gray-400 hover:underline">取消</button>
        </div>
      )}

      {/* 报告列表 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-[#1e2438] animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-brand-text-secondary text-lg">暂无错误报告</p>
          <p className="text-sm text-brand-text-muted mt-1">系统运行正常，没有用户遇到错误</p>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border shadow-sm border-brand-border-subtle dark:border-[#2a3045] overflow-hidden">
            {/* 表头 */}
            <div className="hidden md:grid grid-cols-[40px_80px_1fr_100px_100px_120px_50px] gap-3 px-4 py-2.5 bg-muted dark:bg-[#1a2030] text-xs font-medium text-brand-text-muted uppercase tracking-wider">
              <div className="flex items-center">
                <input type="checkbox" checked={selectedIds.size === reports.length && reports.length > 0} onChange={toggleSelectAll} className="rounded" />
              </div>
              <div>编号</div>
              <div>错误信息</div>
              <div>状态</div>
              <div>次数</div>
              <div>最近发生</div>
              <div />
            </div>

            {reports.map((r) => (
              <div key={r.id} className="border-t border-brand-border-subtle dark:border-[#2a3045]">
                <div className="grid grid-cols-1 md:grid-cols-[40px_80px_1fr_100px_100px_120px_50px] gap-3 px-4 py-3 items-start hover:bg-muted/50 dark:hover:bg-[#1e2438]/50 transition-colors">
                  <div className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="rounded"
                    />
                  </div>
                  <div className="font-mono font-bold text-brand-orange dark:text-[#f09055] text-sm">
                    #{r.reportId}
                  </div>
                  <div className="min-w-0">
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="text-left text-sm font-medium text-[#333] dark:text-[#d0d8e8] hover:text-brand-blue dark:hover:text-[#5ba8d8] transition-colors line-clamp-2 w-full"
                    >
                      {r.message}
                    </button>
                    {r.url && (
                      <div className="text-xs text-brand-text-muted truncate mt-0.5 max-w-md">
                        {r.url}
                      </div>
                    )}
                    {/* 展开详情 */}
                    {expandedId === r.id && (
                      <div className="mt-3 p-3 bg-muted dark:bg-[#1a2030] rounded-lg text-xs space-y-2">
                        {r.stack && (
                          <div>
                            <div className="font-semibold text-brand-text-heading mb-1">错误堆栈：</div>
                            <pre className="whitespace-pre-wrap text-[#666] dark:text-[#8898a8] max-h-48 overflow-y-auto bg-white dark:bg-[#141822] p-2 rounded border border-brand-border-subtle dark:border-[#2a3045]">
                              {r.stack}
                            </pre>
                          </div>
                        )}
                        {r.userAgent && (
                          <div>
                            <span className="font-semibold text-brand-text-heading">浏览器：</span>
                            <span className="text-brand-text-secondary ml-1">{r.userAgent.slice(0, 120)}</span>
                          </div>
                        )}
                        {r.user && (
                          <div>
                            <span className="font-semibold text-brand-text-heading">用户：</span>
                            <span className="text-brand-text-secondary ml-1">{r.user.name || r.user.email}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-brand-text-heading">首次发生：</span>
                          <span className="text-brand-text-secondary ml-1">{new Date(r.firstSeenAt).toLocaleString("zh-CN")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">{statusBadge(r.status)}</div>
                  <div className="text-sm text-brand-text-secondary">
                    {r.count > 1 ? `${r.count} 次` : "1 次"}
                  </div>
                  <div className="text-sm text-brand-text-muted">{timeAgo(r.lastSeenAt)}</div>
                  <div className="flex items-center justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSingle(r.id); }}
                      className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors p-1"
                      title="删除"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-brand-border-subtle dark:border-[#2a3045] disabled:opacity-40 hover:bg-muted dark:hover:bg-[#1e2438] text-[#333] dark:text-[#d0d8e8] transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-brand-text-secondary px-2">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-brand-border-subtle dark:border-[#2a3045] disabled:opacity-40 hover:bg-muted dark:hover:bg-[#1e2438] text-[#333] dark:text-[#d0d8e8] transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
