/**
 * 管理后台 - 成员管理
 * 列出所有社团成员，支持激活/停用、删除
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { toggleMemberActive } from "./actions";
import DeleteMemberButton from "./DeleteMemberButton";

export const metadata: Metadata = { title: "成员管理 - 管理后台" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const [members, total] = await Promise.all([
    prisma.clubMember.findMany({
      orderBy: [{ joinYear: "desc" }, { createdAt: "desc" }],
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      skip,
      take: pageSize,
    }),
    prisma.clubMember.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>成员管理</h1>
        <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>暂无成员</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>名称</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>年级</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>入社年份</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>状态</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>用户角色</th>
                <th className="text-right p-3 font-medium" style={{ color: "#555" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="border-b hover:bg-[#F0F5F9] transition-colors" style={{ borderColor: "#EEE" }}>
                  <td className="p-3">
                    <div className="font-medium" style={{ color: "#333" }}>{m.displayName}</div>
                    <div className="text-xs" style={{ color: "#999" }}>{m.user.email}</div>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "#777" }}>{m.grade || "—"}</td>
                  <td className="p-3 text-xs" style={{ color: "#777" }}>{m.joinYear}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={
                      m.isActive
                        ? { background: "#E8F5E9", color: "#2E7D32" }
                        : { background: "#FDE8E8", color: "#C62828" }
                    }>
                      {m.isActive ? "活跃" : "已停用"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={
                      m.user.role === "ADMIN" ? { background: "#FDE8E8", color: "#C62828" }
                        : m.user.role === "REVIEWER" ? { background: "#FFF3E0", color: "#E65100" }
                        : { background: "#E8F5E9", color: "#2E7D32" }
                    }>
                      {m.user.role === "ADMIN" ? "管理员" : m.user.role === "REVIEWER" ? "审核员" : "成员"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/members/${m.id}`} target="_blank" className="text-xs hover:underline cursor-pointer" style={{ color: "#3388BB" }}>查看</Link>
                      <form action={toggleMemberActive.bind(null, m.id, !m.isActive)} className="inline">
                        <button type="submit" className="text-xs hover:underline cursor-pointer" style={{ color: m.isActive ? "#C62828" : "#88C232" }}>
                          {m.isActive ? "停用" : "激活"}
                        </button>
                      </form>
                      <DeleteMemberButton memberId={m.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Link href={`/admin/members?page=${page - 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">上一页</Link>}
          <span className="px-3 py-1.5 text-sm" style={{ color: "#777" }}>{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/members?page=${page + 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </div>
  );
}
