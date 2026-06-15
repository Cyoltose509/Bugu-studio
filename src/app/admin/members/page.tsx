/**
 * 管理后台 - 成员管理
 * 列出所有社团成员，支持年级/身份/状态编辑、删除
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import DeleteMemberButton from "@/components/admin/DeleteMemberButton";
import EditableSelect from "@/components/admin/EditableSelect";
import EditableNumber from "@/components/admin/EditableNumber";
import GraduateCheckButton from "@/components/admin/GraduateCheckButton";

export const metadata: Metadata = { title: "成员管理 - 管理后台" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "MEMBER", label: "成员" },
  { value: "VICE_PRESIDENT", label: "副社长" },
  { value: "PRESIDENT", label: "社长" },
  { value: "PAST_PRESIDENT", label: "往届社长" },
  { value: "PAST_VICE_PRESIDENT", label: "往届副社长" },
];

const POSITION_OPTIONS_WITH_FOUNDER: { value: string; label: string }[] = [
  ...POSITION_OPTIONS,
  { value: "FOUNDER", label: "创始人" },
];

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const [members, total] = await Promise.all([
    cachedQuery(`admin:members:page${page}`, () =>
      prisma.clubMember.findMany({
        orderBy: [{ joinYear: "desc" }, { createdAt: "desc" }],
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        skip,
        take: pageSize,
      })
    , 15),
    cachedQuery('admin:members:total', () => prisma.clubMember.count(), 30),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">成员管理</h1>
        <div className="flex items-center gap-3">
          <GraduateCheckButton />
          <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden border-brand-border-subtle">
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-brand-text-secondary">暂无成员</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-brand-border-subtle bg-brand-surface-page">
                <th className="text-left p-3 font-medium text-brand-text-body">名称</th>
                <th className="text-left p-3 font-medium text-brand-text-body">年级</th>
                <th className="text-left p-3 font-medium text-brand-text-body">入社年份</th>
                <th className="text-left p-3 font-medium text-brand-text-body">身份</th>
                <th className="text-left p-3 font-medium text-brand-text-body">状态</th>
                <th className="text-left p-3 font-medium text-brand-text-body">用户角色</th>
                <th className="text-right p-3 font-medium text-brand-text-body">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="border-b hover:bg-brand-surface-page transition-colors border-[#EEE]">
                  <td className="p-3">
                    <div className="font-medium text-brand-text-heading">{m.displayName}</div>
                    <div className="text-xs text-brand-text-muted">{m.user.email}</div>
                  </td>
                  <td className="p-3">
                    <EditableNumber
                      memberId={m.id}
                      field="grade"
                      currentValue={typeof m.grade === "number" ? m.grade : null}
                      preserveValues={{
                        position: m.position || "MEMBER",
                        joinYear: m.joinYear != null ? String(m.joinYear) : "",
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <EditableNumber
                      memberId={m.id}
                      field="joinYear"
                      currentValue={m.joinYear ?? null}
                      preserveValues={{
                        position: m.position || "MEMBER",
                        grade: m.grade != null ? String(m.grade) : "",
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <EditableSelect
                      memberId={m.id}
                      field="position"
                      currentValue={m.position || "MEMBER"}
                      options={m.position === "FOUNDER" ? POSITION_OPTIONS_WITH_FOUNDER : POSITION_OPTIONS}
                      preserveValues={{
                        grade: m.grade != null ? String(m.grade) : "",
                        joinYear: m.joinYear != null ? String(m.joinYear) : "",
                      }}
                      readOnly={m.position === "FOUNDER"}
                    />
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.graduated
                        ? "bg-[#FFF3E0] text-brand-orange"
                        : "bg-[var(--ui-bg-green-light)] text-[var(--ui-text-green)]"
                    }`}>
                      {m.graduated ? "已毕业" : "在读"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.user.role === "ADMIN" ? "bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                        : "bg-[var(--ui-bg-green-light)] text-[var(--ui-text-green)]"
                    }`}>
                      {m.user.role === "ADMIN" ? "管理员" : "成员"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/members/${m.id}`} target="_blank" className="text-xs hover:underline cursor-pointer text-brand-blue">查看</Link>
                      <DeleteMemberButton memberId={m.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Link href={`/admin/members?page=${page - 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">上一页</Link>}
          <span className="px-3 py-1.5 text-sm text-brand-text-secondary">{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/members?page=${page + 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </div>
  );
}
