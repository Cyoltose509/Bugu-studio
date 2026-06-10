/**
 * 管理后台 - 审计日志
 * 查看所有数据库操作记录，支持按操作类型、时间范围筛选
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import type { AuditAction } from "@prisma/client";

export const metadata: Metadata = { title: "审计日志 - 管理后台" };
export const dynamic = "force-dynamic";

const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "CREATE", label: "创建" },
  { value: "UPDATE", label: "更新" },
  { value: "DELETE", label: "删除" },
  { value: "USER_REGISTER", label: "注册" },
  { value: "USER_LOGIN", label: "登录" },
  { value: "USER_ROLE_CHANGE", label: "角色变更" },
  { value: "PROJECT_CREATE", label: "作品创建" },
  { value: "PROJECT_UPDATE", label: "作品更新" },
  { value: "PROJECT_DELETE", label: "作品删除" },
  { value: "PROJECT_APPROVE", label: "审核通过" },
  { value: "PROJECT_REJECT", label: "审核拒绝" },
  { value: "FILE_UPLOAD", label: "文件上传" },
  { value: "ADMIN_ACTION", label: "管理员操作" },
  { value: "SUSPICIOUS_REQUEST", label: "可疑请求" },
  { value: "OTHER", label: "其他" },
];

const MODEL_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "全部表" },
  { value: "User", label: "用户" },
  { value: "Project", label: "作品" },
  { value: "ClubMember", label: "社团成员" },
  { value: "ProjectMember", label: "作品成员" },
  { value: "Review", label: "审核" },
  { value: "YearEvent", label: "大事记" },
  { value: "SiteSetting", label: "站点设置" },
  { value: "Tag", label: "标签" },
  { value: "Comment", label: "评论" },
  { value: "InviteCode", label: "邀请码" },
];

interface PageProps {
  searchParams: Promise<{
    action?: string;
    model?: string;
    userId?: string;
    page?: string;
  }>;
}

export default async function AdminAuditLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const action = params.action || "";
  const model = params.model || "";
  const userId = params.userId || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  // 构建查询
  const where: any = {};
  if (action) where.action = action;
  if (model) where.targetType = model;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  // 构建筛选链接的 query string
  function filterQs(overrides: Record<string, string>) {
    const p: Record<string, string> = {};
    const current = { action, model, userId };
    const merged = { ...current, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p[k] = v;
    }
    p.page = "1";
    return new URLSearchParams(p).toString();
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>审计日志</h1>
        <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">
          ← 返回仪表盘
        </Link>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <div className="text-xs" style={{ color: "#777" }}>总记录</div>
          <div className="text-2xl font-bold" style={{ color: "#25547A" }}>{total}</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <div className="text-xs" style={{ color: "#777" }}>今日操作</div>
          <div className="text-2xl font-bold" style={{ color: "#88C232" }}>
            {logs.filter((l: any) => {
              const d = new Date(l.createdAt);
              const today = new Date();
              return d.toDateString() === today.toDateString();
            }).length}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <div className="text-xs" style={{ color: "#777" }}>涉及用户</div>
          <div className="text-2xl font-bold" style={{ color: "#3388BB" }}>
            {new Set(logs.map((l: any) => l.userId).filter(Boolean)).size}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
          <div className="text-xs" style={{ color: "#777" }}>涉及表</div>
          <div className="text-2xl font-bold" style={{ color: "#E67E22" }}>
            {new Set(logs.map((l: any) => l.targetType).filter(Boolean)).size}
          </div>
        </div>
      </div>

      {/* 操作类型筛选 */}
      <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3" style={{ borderColor: "#D0DEE8" }}>
        <div className="text-xs font-medium" style={{ color: "#777" }}>操作类型</div>
        <div className="flex flex-wrap gap-2">
          {ACTION_FILTERS.map((f) => {
            const active = action === f.value;
            return (
              <Link
                key={f.value}
                href={`/admin/audit-logs?${filterQs({ action: f.value })}`}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${active ? "font-medium" : ""}`}
                style={
                  active
                    ? { background: "#25547A", color: "#fff" }
                    : { color: "#555", background: "#F0F5F9" }
                }
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <div className="text-xs font-medium" style={{ color: "#777", marginTop: 4 }}>涉及表</div>
        <div className="flex flex-wrap gap-2">
          {MODEL_FILTERS.map((f) => {
            const active = model === f.value;
            return (
              <Link
                key={f.value}
                href={`/admin/audit-logs?${filterQs({ model: f.value })}`}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${active ? "font-medium" : ""}`}
                style={
                  active
                    ? { background: "#25547A", color: "#fff" }
                    : { color: "#555", background: "#F0F5F9" }
                }
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>
            暂无审计日志
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>时间</th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>操作用户</th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>操作类型</th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>目标</th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>IP</th>
                  <th className="text-left p-3 font-medium" style={{ color: "#555" }}>详情</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr
                    key={log.id}
                    className="border-b hover:bg-[#F0F5F9] transition-colors"
                    style={{ borderColor: "#EEE" }}
                  >
                    <td className="p-3 text-xs whitespace-nowrap" style={{ color: "#999" }}>
                      {new Date(log.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="p-3">
                      {log.user ? (
                        <div>
                          <div className="text-xs font-medium" style={{ color: "#333" }}>
                            {log.user.name || "未命名"}
                          </div>
                          <div className="text-xs" style={{ color: "#999" }}>
                            {log.user.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "#999" }}>系统</span>
                      )}
                    </td>
                    <td className="p-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="p-3">
                      <div className="text-xs" style={{ color: "#333" }}>
                        {log.targetType || "-"}
                      </div>
                      {log.targetId && (
                        <div className="text-xs font-mono" style={{ color: "#999" }}>
                          {log.targetId.slice(0, 12)}...
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs font-mono" style={{ color: "#999" }}>
                      {log.ipAddress || "-"}
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#777" }}>
                      <LogMetadata metadata={log.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/audit-logs?${filterQs({ page: String(page - 1) })}`}
              className="btn-secondary px-3 py-1.5 rounded-lg text-sm"
            >
              上一页
            </Link>
          )}
          <span className="px-3 py-1.5 text-sm" style={{ color: "#777" }}>
            {page} / {totalPages}（共 {total} 条）
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/audit-logs?${filterQs({ page: String(page + 1) })}`}
              className="btn-secondary px-3 py-1.5 rounded-lg text-sm"
            >
              下一页
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** 操作类型徽章 */
function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    CREATE: { bg: "#E8F5E9", fg: "#2E7D32" },
    UPDATE: { bg: "#E3F2FD", fg: "#1565C0" },
    DELETE: { bg: "#FDE8E8", fg: "#C62828" },
    OTHER: { bg: "#F5F5F5", fg: "#616161" },
  };
  const colors = colorMap[action] || { bg: "#FFF3E0", fg: "#E65100" };

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {action}
    </span>
  );
}

/** 日志元数据显示 */
function LogMetadata({ metadata }: { metadata: any }) {
  if (!metadata) return <span>-</span>;

  const parts: string[] = [];

  if (metadata.changedFields?.length) {
    parts.push(`字段: ${metadata.changedFields.join(", ")}`);
  }
  if (metadata.elapsed) {
    parts.push(`${metadata.elapsed}ms`);
  }
  if (metadata.where) {
    try {
      const w = typeof metadata.where === "string" ? JSON.parse(metadata.where) : metadata.where;
      parts.push(`条件: ${JSON.stringify(w).slice(0, 60)}`);
    } catch {
      parts.push(`条件: ${String(metadata.where).slice(0, 60)}`);
    }
  }

  return <span>{parts.length > 0 ? parts.join(" · ") : "-"}</span>;
}
