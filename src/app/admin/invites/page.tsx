/**
 * 管理后台 - 邀请码管理
 * 创建、查看、删除邀请码
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { createInviteCode, toggleInviteCode } from "./actions";
import DeleteInviteCodeButton from "./DeleteInviteCodeButton";

export const metadata: Metadata = { title: "邀请码管理 - 管理后台" };
export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "成员", color: "#2E7D32", bg: "#E8F5E9" },
  { value: "REVIEWER", label: "审核员", color: "#E65100", bg: "#FFF3E0" },
  { value: "ADMIN", label: "管理员", color: "#C62828", bg: "#FDE8E8" },
];

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminInvitesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const [codes, total] = await Promise.all([
    prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.inviteCode.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>邀请码管理</h1>
        <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
      </div>

      {/* 创建邀请码 */}
      <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-4" style={{ color: "#25547A" }}>创建邀请码</h2>
        <form action={createInviteCode} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#999" }}>角色</label>
            <select name="role" required
              className="text-sm rounded border px-2 py-1.5"
              style={{ borderColor: "#D0DEE8", color: "#333" }}>
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#999" }}>最大使用次数</label>
            <input name="maxUses" type="number" min="1" placeholder="留空=无限"
              className="text-sm rounded border px-2 py-1.5 w-full sm:w-28"
              style={{ borderColor: "#D0DEE8", color: "#333" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#999" }}>有效期（天）</label>
            <input name="expiresDays" type="number" min="1" placeholder="留空=永久"
              className="text-sm rounded border px-2 py-1.5 w-full sm:w-28"
              style={{ borderColor: "#D0DEE8", color: "#333" }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#999" }}>备注</label>
            <input name="description" type="text" placeholder="如：张三入社用"
              className="text-sm rounded border px-2 py-1.5 w-full sm:w-48"
              style={{ borderColor: "#D0DEE8", color: "#333" }} />
          </div>
          <button type="submit" className="btn-primary px-4 py-1.5 rounded-lg text-sm font-medium h-fit">
            生成邀请码
          </button>
        </form>
      </div>

      {/* 邀请码列表 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        {codes.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>暂无邀请码</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>邀请码</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>角色</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>使用次数</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>状态</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>有效期</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>备注</th>
                <th className="text-right p-3 font-medium" style={{ color: "#555" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => {
                const expired = c.expiresAt && c.expiresAt < new Date();
                const exhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
                const roleOpt = ROLE_OPTIONS.find(r => r.value === c.role);
                return (
                  <tr key={c.id} className="border-b hover:bg-[#F0F5F9] transition-colors" style={{ borderColor: "#EEE" }}>
                    <td className="p-3">
                      <code className="text-sm font-mono px-1.5 py-0.5 rounded" style={{ background: "#E6F0F8", color: "#25547A" }}>{c.code}</code>
                    </td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: roleOpt?.bg || "#E6F0F8",
                        color: roleOpt?.color || "#25547A",
                      }}>
                        {roleOpt?.label || c.role}
                      </span>
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#777" }}>
                      {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : " 次"}
                    </td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={
                        c.isActive && !expired && !exhausted
                          ? { background: "#E8F5E9", color: "#2E7D32" }
                          : { background: "#FDE8E8", color: "#C62828" }
                      }>
                        {c.isActive && !expired && !exhausted ? "有效" : "无效"}
                      </span>
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#999" }}>
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("zh-CN") : "永久"}
                      {expired && <span className="ml-1 text-red-600">已过期</span>}
                    </td>
                    <td className="p-3 text-xs" style={{ color: "#777" }}>{c.description || "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <form action={toggleInviteCode.bind(null, c.id, !c.isActive)} className="inline">
                          <button type="submit" className="text-xs hover:underline cursor-pointer" style={{ color: c.isActive ? "#C62828" : "#88C232" }}>
                            {c.isActive ? "禁用" : "启用"}
                          </button>
                        </form>
                        <DeleteInviteCodeButton codeId={c.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Link href={`/admin/invites?page=${page - 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">上一页</Link>}
          <span className="px-3 py-1.5 text-sm" style={{ color: "#777" }}>{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/invites?page=${page + 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </div>
  );
}
