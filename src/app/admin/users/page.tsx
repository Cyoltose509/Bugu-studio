/**
 * 管理后台 - 用户管理
 * 列出所有注册用户，支持修改角色、激活/停用、删除
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import RoleSelect from "@/components/admin/RoleSelect";
import ToggleActiveButton from "@/components/admin/ToggleActiveButton";
import DeleteButton from "@/components/admin/UserDeleteButton";
import ConfirmedNotMemberCheckbox from "@/components/admin/ConfirmedNotMemberCheckbox";

export const metadata: Metadata = { title: "用户管理 - 管理后台" };
export const dynamic = "force-dynamic";

const ROLES = [
  { value: "", label: "全部" },
  { value: "ADMIN", label: "管理员" },
  { value: "MEMBER", label: "成员" },
  { value: "USER", label: "普通用户" },
];

interface PageProps {
  searchParams: Promise<{ role?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const role = params.role || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (role) where.role = role;

  const cacheKey = `admin:users:${role}:${page}`;

  // 1. 缓存用户列表 + 总数
  const [users, total] = await cachedQuery(cacheKey, () =>
    Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true, name: true, email: true, role: true,
          isActive: true, emailVerified: true,
          lastLoginAt: true, createdAt: true,
          confirmedNotMember: true,
        },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]), 15);

  // 2. 批量获取作品数统计（lightweight groupBy，不缓存但很快）
  const projectCounts = await prisma.project.groupBy({
    by: ["submitterId"],
    where: { submitterId: { in: users.map((u: any) => u.id) } },
    _count: { submitterId: true },
  });

  // 3. 组装用户+作品数
  const countMap = Object.fromEntries(
    projectCounts.map((pc: any) => [pc.submitterId, pc._count.submitterId])
  );
  const userWithCounts = users.map(u => ({ ...u, projectCount: countMap[u.id] || 0 }));

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">用户管理</h1>
        <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
      </div>

      {/* 角色筛选 */}
      <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-wrap gap-2 border-brand-border-subtle">
        {ROLES.map(r => {
          const active = role === r.value;
          return (
            <Link key={r.value} href={`/admin/users?role=${r.value}&page=1`}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "font-medium bg-brand-navy text-white" : "text-brand-text-body bg-brand-surface-page"}`}>
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* 用户列表 */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden border-brand-border-subtle">
        {userWithCounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-brand-text-secondary">暂无用户</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-brand-border-subtle bg-brand-surface-page">
                <th className="text-left p-3 font-medium text-brand-text-body">用户</th>
                <th className="text-left p-3 font-medium text-brand-text-body">角色</th>
                <th className="text-left p-3 font-medium text-brand-text-body">状态</th>
                <th className="text-left p-3 font-medium text-brand-text-body">非成员</th>
                <th className="text-left p-3 font-medium text-brand-text-body">作品数</th>
                <th className="text-left p-3 font-medium text-brand-text-body">注册时间</th>
                <th className="text-right p-3 font-medium text-brand-text-body">操作</th>
              </tr>
            </thead>
            <tbody>
              {userWithCounts.map(u => (
                <tr key={u.id} className="border-b hover:bg-brand-surface-page transition-colors border-[#EEE]">
                  <td className="p-3">
                    <div className="font-medium text-brand-text-heading">{u.name || "未命名"}</div>
                    <div className="text-xs text-brand-text-secondary">{u.email}</div>
                    {u.emailVerified && (
                      <span className="text-xs text-brand-green">已验证</span>
                    )}
                  </td>
                  <td className="p-3">
                    <RoleSelect userId={u.id} currentRole={u.role} />
                  </td>
                  <td className="p-3">
                    {u.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ui-bg-green-light)] text-[var(--ui-text-green)]">
                        正常
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">
                        已停用
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {u.role === "USER" && (
                      <ConfirmedNotMemberCheckbox userId={u.id} value={u.confirmedNotMember} />
                    )}
                  </td>
                  <td className="p-3 text-xs text-brand-text-secondary">{u.projectCount}</td>
                  <td className="p-3 text-xs text-brand-text-muted">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/profile?id=${u.id}`} className="text-xs hover:underline text-brand-blue">查看</Link>
                      <ToggleActiveButton userId={u.id} isActive={u.isActive} />
                      <DeleteButton userId={u.id} userName={u.name || u.email} />
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
          {page > 1 && <Link href={`/admin/users?role=${role}&page=${page - 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">上一页</Link>}
          <span className="px-3 py-1.5 text-sm text-brand-text-secondary">{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/users?role=${role}&page=${page + 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </div>
  );
}
