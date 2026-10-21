"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

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

interface ErrorGroup {
  key: string;
  latest: ErrorReport;
  items: ErrorReport[];
  foldCount: number;
  totalHits: number;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

function groupKey(message: string) {
  return message.trim();
}

function pickGroupStatus(items: ErrorReport[]) {
  if (items.some((item) => item.status === "UNREAD")) return "UNREAD";
  if (items.some((item) => item.status === "READ")) return "READ";
  return items[0]?.status || "READ";
}

function groupReports(reports: ErrorReport[]): ErrorGroup[] {
  const map = new Map<string, ErrorReport[]>();
  for (const report of reports) {
    const key = groupKey(report.message);
    const list = map.get(key);
    if (list) list.push(report);
    else map.set(key, [report]);
  }

  const groups: ErrorGroup[] = [];
  for (const [key, items] of map) {
    items.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
    groups.push({
      key,
      latest: items[0],
      items,
      foldCount: items.length,
      totalHits: items.reduce((sum, item) => sum + (item.count || 1), 0),
      status: pickGroupStatus(items),
      firstSeenAt: items.reduce(
        (min, item) => (item.firstSeenAt < min ? item.firstSeenAt : min),
        items[0].firstSeenAt
      ),
      lastSeenAt: items[0].lastSeenAt,
    });
  }

  groups.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  return groups;
}

function CountDot({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none bg-brand-orange text-white shrink-0"
      title={`${count} 条同款`}
    >
      {count}
    </span>
  );
}

function formatGroupForCopy(group: ErrorGroup) {
  const lines = [
    `#${group.latest.reportId}  ${group.status}  ${group.foldCount}条同款 / ${group.totalHits}次  最近 ${new Date(group.lastSeenAt).toLocaleString("zh-CN")}`,
    group.latest.url ? `页面: ${group.latest.url}` : null,
    `错误: ${group.latest.message}`,
    group.latest.stack ? `堆栈:\n${group.latest.stack}` : null,
    group.latest.userAgent ? `浏览器: ${group.latest.userAgent}` : null,
    group.latest.user ? `用户: ${group.latest.user.name || group.latest.user.email}` : null,
    `首次发生: ${new Date(group.firstSeenAt).toLocaleString("zh-CN")}`,
  ].filter(Boolean) as string[];

  if (group.items.length > 1) {
    lines.push("", "同款记录:");
    for (const item of group.items) {
      lines.push(
        `#${item.reportId}  ${item.count}次  ${item.status}  ${item.url || "-"}  ${new Date(item.lastSeenAt).toLocaleString("zh-CN")}`
      );
    }
  }

  return lines.join("\n");
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }
}

function hasTextSelection(root: EventTarget | null) {
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";
  if (!sel || sel.isCollapsed || text.length < 8) return false;
  const node = sel.anchorNode;
  return !!(root instanceof Node && node && root.contains(node));
}

function GroupDetails({
  group,
  timeAgo,
}: {
  group: ErrorGroup;
  timeAgo: (d: string) => string;
}) {
  const r = group.latest;
  return (
    <div className="text-xs space-y-2">
      <p className="font-medium text-sm text-[#333] dark:text-[#d0d8e8] whitespace-pre-wrap break-words">
        {r.message}
      </p>
      {r.stack && (
        <div>
          <div className="font-semibold text-brand-text-heading mb-1">错误堆栈</div>
          <pre className="whitespace-pre-wrap text-[#666] dark:text-[#8898a8] max-h-48 overflow-y-auto p-2 rounded border border-brand-border-subtle dark:border-[#2a3045] bg-black/[0.03] dark:bg-white/[0.04]">
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
        <span className="text-brand-text-secondary ml-1">{new Date(group.firstSeenAt).toLocaleString("zh-CN")}</span>
      </div>
      {group.items.length > 1 && (
        <div>
          <div className="font-semibold text-brand-text-heading mb-1">同款 {group.foldCount} 条</div>
          <ul className="space-y-1 text-brand-text-secondary">
            {group.items.map((item) => (
              <li key={item.id} className="flex flex-wrap gap-x-2">
                <span className="font-mono text-brand-orange dark:text-[#f09055]">#{item.reportId}</span>
                <span>{item.count} 次</span>
                <span>{timeAgo(item.lastSeenAt)}</span>
                {item.url && <span className="truncate max-w-xs">{item.url}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ErrorReportsClient() {
  const searchParams = useSearchParams();
  const highlightReportId = searchParams.get("reportId");
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const groups = useMemo(() => groupReports(reports), [reports]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "200" });
      if (statusFilter) params.set("status", statusFilter);
      if (highlightReportId) params.set("reportId", highlightReportId);
      const res = await fetch(`/api/admin/error-reports-data?${params}`);
      const json = await res.json();
      const list: ErrorReport[] = json.reports || [];
      const highlight: ErrorReport | null = json.highlight || null;
      if (highlight && !list.some((r) => r.id === highlight.id)) {
        list.unshift(highlight);
      }
      setReports(list);
      setTotalPages(json.pagination?.totalPages || 1);
      if (highlight) setExpandedKey(groupKey(highlight.message));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, highlightReportId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleSelectGroup = (group: ErrorGroup) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.items.every((item) => next.has(item.id));
      for (const item of group.items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = reports.map((r) => r.id);
    if (selectedIds.size === allIds.length && allIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
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

  const copyAll = async () => {
    const text = groups.map(formatGroupForCopy).join("\n\n----------\n\n");
    if (!text) return;
    const ok = await writeClipboard(text);
    setCopyState(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const copyGroup = async (group: ErrorGroup) => {
    const ok = await writeClipboard(formatGroupForCopy(group));
    setCopiedKey(ok ? group.key : `failed:${group.key}`);
    window.setTimeout(() => setCopiedKey((prev) => (prev === group.key || prev === `failed:${group.key}` ? null : prev)), 1600);
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
            前端错误
          </h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            悬停展开详情，点击即可复制
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
            onClick={copyAll}
            disabled={loading || groups.length === 0}
            className="text-sm px-3 py-1.5 border border-brand-border-subtle dark:border-[#2a3045] rounded-lg hover:bg-muted dark:hover:bg-[#1e2438] disabled:opacity-50 transition-colors text-[#333] dark:text-[#d0d8e8]"
          >
            {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "全部复制"}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <span className="text-sm text-yellow-700 dark:text-yellow-400">
            已选择 {selectedIds.size} 项
          </span>
          <button onClick={() => markStatus("READ")} className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">标记已读</button>
          <button onClick={() => markStatus("RESOLVED")} className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">标记已解决</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm px-3 py-1 text-gray-600 dark:text-gray-400 hover:underline">取消</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-[#1e2438] animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-brand-text-secondary text-lg">暂无错误报告</p>
          <p className="text-sm text-brand-text-muted mt-1">系统运行正常，没有用户遇到错误</p>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border shadow-sm border-brand-border-subtle dark:border-[#2a3045]">
            <div className="hidden md:grid grid-cols-[40px_80px_1fr_100px_120px] gap-3 px-4 py-2.5 bg-muted dark:bg-[#1a2030] text-xs font-medium text-brand-text-muted uppercase tracking-wider">
              <div className="flex items-center">
                <input type="checkbox" checked={selectedIds.size === reports.length && reports.length > 0} onChange={toggleSelectAll} className="rounded" />
              </div>
              <div>编号</div>
              <div>错误信息</div>
              <div>状态</div>
              <div>最近发生</div>
            </div>

            {groups.map((group) => {
              const r = group.latest;
              const groupSelected = group.items.every((item) => selectedIds.has(item.id));
              const pinned = expandedKey === group.key;
              const hovered = hoveredKey === group.key;
              const showDetails = pinned || hovered;
              const copied = copiedKey === group.key;
              const copyFailed = copiedKey === `failed:${group.key}`;
              return (
                <div
                  key={group.key}
                  className={`relative border-t border-brand-border-subtle dark:border-[#2a3045] ${hovered ? "z-20" : "z-0"}`}
                  onMouseEnter={() => setHoveredKey(group.key)}
                  onMouseLeave={() => setHoveredKey((k) => (k === group.key ? null : k))}
                >
                  <div
                    title="点击复制"
                    onClick={(e) => {
                      if (hasTextSelection(e.currentTarget)) return;
                      void copyGroup(group);
                    }}
                    className="grid grid-cols-1 md:grid-cols-[40px_80px_1fr_100px_120px] gap-3 px-4 py-3 items-start cursor-pointer hover:bg-muted/50 dark:hover:bg-[#1e2438]/50 transition-colors"
                  >
                    <div className="flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={groupSelected}
                        onChange={() => toggleSelectGroup(group)}
                        className="rounded"
                        aria-label={`选择 #${r.reportId}`}
                      />
                    </div>
                    <div className="font-mono font-bold text-brand-orange dark:text-[#f09055] text-sm">
                      #{r.reportId}
                    </div>
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        title="点击复制"
                        aria-label={`复制错误 #${r.reportId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void copyGroup(group);
                        }}
                        className="text-left text-sm font-medium text-[#333] dark:text-[#d0d8e8] w-full flex items-start gap-2"
                      >
                        <CountDot count={group.foldCount > 1 ? group.foldCount : group.totalHits} />
                        <span className={pinned ? "break-words" : "line-clamp-2"}>{r.message}</span>
                        {copied && (
                          <span className="shrink-0 text-[11px] font-medium text-green-600 dark:text-green-400">已复制</span>
                        )}
                        {copyFailed && (
                          <span className="shrink-0 text-[11px] font-medium text-red-500">复制失败</span>
                        )}
                      </button>
                      {r.url && (
                        <div className="text-xs text-brand-text-muted truncate mt-0.5 max-w-md">
                          {r.url}
                        </div>
                      )}
                      {showDetails && (
                        <div
                          className={
                            pinned
                              ? "mt-3 p-3 rounded-lg border border-brand-border-subtle dark:border-[#2a3045] bg-black/[0.03] dark:bg-white/[0.04]"
                              : "absolute left-0 right-0 top-full z-20 mt-1 p-3 rounded-lg border border-brand-border-subtle dark:border-[#2a3045] bg-card shadow-lg"
                          }
                        >
                          <GroupDetails group={group} timeAgo={timeAgo} />
                          {!pinned && (
                            <p className="mt-2 text-[11px] text-brand-text-muted">
                              {copied ? "已复制到剪贴板" : "点击复制"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center">{statusBadge(group.status)}</div>
                    <div className="text-sm text-brand-text-muted">{timeAgo(group.lastSeenAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>

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
