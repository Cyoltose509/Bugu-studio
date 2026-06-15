"use client";

import { useState, useEffect, useCallback } from "react";

interface DirectiveStat {
  directive: string;
  uniqueReports: number;
  totalEvents: number;
}

interface InitialStats {
  totalUnique: number;
  totalEvents: number;
  last24h: number;
  byDirective: DirectiveStat[];
}

interface CspReportItem {
  id: string;
  blockedUri: string | null;
  violatedDirective: string;
  documentUri: string | null;
  referrer: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  disposition: string | null;
  sample: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  count: number;
  lastSeenAt: string;
  firstSeenAt: string;
}

interface Stats {
  totalUnique: number;
  totalEvents: number;
  last24h: number;
  byDirective: DirectiveStat[];
  byDocumentUri?: { uri: string; uniqueReports: number; totalEvents: number }[];
  byBlockedUri?: { uri: string; uniqueReports: number; totalEvents: number }[];
}

/** 违规指令 -> 中文标签 */
function directiveLabel(d: string): string {
  const map: Record<string, string> = {
    "script-src": "脚本 (script-src)",
    "style-src": "样式 (style-src)",
    "img-src": "图片 (img-src)",
    "connect-src": "连接 (connect-src)",
    "font-src": "字体 (font-src)",
    "media-src": "媒体 (media-src)",
    "frame-src": "内嵌框架 (frame-src)",
    "frame-ancestors": "嵌入限制 (frame-ancestors)",
    "form-action": "表单提交 (form-action)",
    "base-uri": "基址 (base-uri)",
    "default-src": "默认源 (default-src)",
    "object-src": "插件 (object-src)",
  };
  return map[d] ?? d;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function CspReportsClient({ initialStats }: { initialStats: InitialStats }) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [reports, setReports] = useState<CspReportItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedDirective, setSelectedDirective] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "30" });
      if (selectedDirective) params.set("directive", selectedDirective);
      const res = await fetch(`/api/admin/csp-reports-data?${params}`);
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setReports(data.reports ?? []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, [selectedDirective]);

  // 初始加载报告列表
  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => fetchData(page), 30_000);
    return () => clearInterval(t);
  }, [autoRefresh, page, fetchData]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === reports.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reports.map((r) => r.id)));
    }
  };

  const deleteSingle = async (id: string) => {
    if (deleting) return;
    if (!confirm("确定删除这条 CSP 违规报告？")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/csp-reports-data?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
        fetchData(page);
      }
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const deleteSelected = async () => {
    if (deleting || selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 条报告？`)) return;
    setDeleting(true);
    try {
      const ids = [...selected].join(",");
      const res = await fetch(`/api/admin/csp-reports-data?ids=${ids}`, { method: "DELETE" });
      if (res.ok) {
        setSelected(new Set());
        fetchData(page);
      }
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const clearAll = async () => {
    if (deleting) return;
    if (!confirm("⚠️ 确定要清空所有 CSP 违规报告吗？此操作不可撤销！")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/csp-reports-data?all=true`, { method: "DELETE" });
      if (res.ok) {
        setSelected(new Set());
        setPage(1);
        fetchData(1);
      }
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const badgeColor = (directive: string) => {
    if (directive.includes("script")) return "bg-red-100 text-red-700 border-red-200";
    if (directive.includes("style")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (directive.includes("img")) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (directive.includes("connect")) return "bg-blue-100 text-blue-700 border-blue-200";
    if (directive.includes("font")) return "bg-green-100 text-green-700 border-green-200";
    if (directive.includes("frame")) return "bg-purple-100 text-purple-700 border-purple-200";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <div className="space-y-6">
      {/* ===== 概览统计卡片 ===== */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="唯一违规项"
            value={stats.totalUnique}
            icon="📋"
            sub={stats.totalEvents > 0 ? `共 ${stats.totalEvents} 次事件` : undefined}
          />
          <StatCard
            label="24h 新增"
            value={stats.last24h}
            icon="🆕"
            highlight={stats.last24h > 0}
          />
          <StatCard
            label="违规类型"
            value={stats.byDirective.length}
            icon="🔍"
          />
          <StatCard
            label="累计事件"
            value={stats.totalEvents}
            icon="📊"
          />
        </div>
      </section>

      {/* ===== 违规指令分布 ===== */}
      {stats.byDirective.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-brand-navy">📈 违规指令分布</h2>
          <div className="bg-card border rounded-xl p-4 shadow-sm border-brand-border-subtle">
            <div className="space-y-2">
              {stats.byDirective.map((d) => (
                <button
                  key={d.directive}
                  onClick={() => setSelectedDirective(selectedDirective === d.directive ? null : d.directive)}
                  className={`w-full flex items-center justify-between gap-4 text-left p-2 rounded-lg text-sm transition-colors ${
                    selectedDirective === d.directive ? "bg-brand-blue/10" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium text-brand-text-body">{directiveLabel(d.directive)}</span>
                  <div className="flex items-center gap-4 text-xs text-brand-text-secondary">
                    <span>{d.uniqueReports} 项</span>
                    <span>{d.totalEvents} 次</span>
                    {/* 简易进度条 */}
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-blue rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (d.totalEvents / Math.max(1, stats.totalEvents)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== 报告列表 ===== */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-brand-navy">
            📋 违规报告
            {selectedDirective && (
              <span className="ml-2 text-sm font-normal text-brand-text-secondary">
                — 筛选：{directiveLabel(selectedDirective)}
                <button onClick={() => setSelectedDirective(null)} className="ml-2 text-brand-blue hover:underline">
                  清除
                </button>
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                删除选中 ({selected.size})
              </button>
            )}
            {totalCount > 0 && (
              <button
                onClick={clearAll}
                disabled={deleting}
                className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                清空全部
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-brand-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              30s 自动刷新
            </label>
            <span className="text-xs text-brand-text-secondary">
              共 {totalCount} 条，第 {page}/{Math.max(1, totalPages)} 页
            </span>
          </div>
        </div>

        {loading && <div className="text-sm text-brand-text-secondary text-center py-4">加载中...</div>}

        {!loading && reports.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-brand-green font-medium">暂无 CSP 违规</p>
            <p className="text-xs text-brand-text-secondary mt-1">
              一切正常 — 暂时没有浏览器报告任何 Content-Security-Policy 违规
            </p>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden border-brand-border-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === reports.length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-brand-text-secondary">违规指令</th>
                    <th className="px-4 py-3 text-left font-medium text-brand-text-secondary">被阻止 URI</th>
                    <th className="px-4 py-3 text-left font-medium text-brand-text-secondary hidden md:table-cell">
                      页面
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-brand-text-secondary w-16">次数</th>
                    <th className="px-4 py-3 text-center font-medium text-brand-text-secondary w-10">操作</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-text-secondary w-36">最后出现</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.map((r) => {
                    const isOpen = expanded.has(r.id);
                    return (
                      <>
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-2.5 cursor-pointer" onClick={() => toggleExpand(r.id)}>
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full border ${badgeColor(r.violatedDirective)}`}
                            >
                              {directiveLabel(r.violatedDirective)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs max-w-[200px] truncate text-brand-text-body cursor-pointer" onClick={() => toggleExpand(r.id)}>
                            {r.blockedUri ?? "(inline)"}
                          </td>
                          <td className="px-4 py-2.5 text-xs max-w-[200px] truncate hidden md:table-cell text-brand-text-secondary cursor-pointer" onClick={() => toggleExpand(r.id)}>
                            {r.documentUri ? new URL(r.documentUri).pathname : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center cursor-pointer" onClick={() => toggleExpand(r.id)}>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                              r.count > 10 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                            }`}>
                              {r.count}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => deleteSingle(r.id)}
                              disabled={deleting}
                              className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-30"
                              title="删除此条"
                            >
                              🗑
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-brand-text-secondary cursor-pointer" onClick={() => toggleExpand(r.id)}>
                            {timeAgo(r.lastSeenAt)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${r.id}-detail`}>
                            <td colSpan={7} className="bg-gray-50/50 px-6 py-3">
                              <ReportDetail report={r} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchData(p); }}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              上一页
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => { setPage(p); fetchData(p); }}
                  className={`w-8 h-8 text-xs rounded-lg ${
                    p === page
                      ? "bg-brand-blue text-white"
                      : "border hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchData(p); }}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/** 展开的单条报告详情 */
function ReportDetail({ report }: { report: CspReportItem }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
      <KV label="首次出现" value={new Date(report.firstSeenAt).toLocaleString("zh-CN")} />
      <KV label="最后出现" value={new Date(report.lastSeenAt).toLocaleString("zh-CN")} />
      <KV label="页面 URI" value={report.documentUri ?? "—"} mono />
      <KV label="Referrer" value={report.referrer ?? "—"} />
      <KV label="源码文件" value={report.sourceFile ?? "—"} mono />
      <KV label="行:列" value={report.lineNumber != null ? `${report.lineNumber}:${report.columnNumber ?? "?"}` : "—"} />
      <KV label="处置方式" value={report.disposition ?? "enforce"} />
      <KV label="浏览器" value={report.userAgent?.slice(0, 80) ?? "—"} />
      <KV label="客户端 IP" value={report.ipAddress ?? "—"} />
      {report.sample && (
        <div className="md:col-span-2 mt-1">
          <span className="text-brand-text-secondary">违规样本：</span>
          <code className="block mt-1 p-2 bg-red-50 border border-red-100 rounded text-red-700 font-mono text-[11px] break-all max-h-20 overflow-y-auto">
            {escapeHtml(report.sample)}
          </code>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="text-brand-text-secondary shrink-0">{label}:</span>
      <span className={`text-brand-text-body truncate ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string;
  value: number;
  icon: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-card border rounded-xl p-4 shadow-sm border-brand-border-subtle ${highlight ? "ring-2 ring-orange-200" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-brand-text-secondary">{label}</span>
      </div>
      <div className="text-2xl font-bold text-brand-navy">{value}</div>
      {sub && <div className="text-xs text-brand-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s 前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min 前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h 前`;
  const day = Math.floor(hr / 24);
  return `${day}d 前`;
}
