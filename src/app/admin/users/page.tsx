/**
 * 管理后台 - 用户管理
 * 列出所有注册用户，支持修改角色、激活/停用、删除
 */

import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export const metadata: Metadata = { title: "用户管理 - 管理后台" };
export const dynamic = "force-dynamic";

const ROLES = [
  { value: "", label: "全部" },
  { value: "ADMIN", label: "管理员" },
  { value: "REVIEWER", label: "审核员" },
  { value: "MEMBER", label: "成员" },
  { value: "USER", label: "普通用户" },
];

interface PageProps {
  searchParams: Promise<{ role?: string; page?: string }>;
}

async function updateUserRole(id: string, role: string) {
  "use server";
  await prisma.user.update({ where: { id }, data: { role: role as any } });
  revalidatePath("/admin/users");
}

async function updateUserActive(id: string, isActive: boolean) {
  "use server";
  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/users");
}

async function deleteUser(id: string) {
  "use server";
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const role = params.role || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, emailVerified: true,
        lastLoginAt: true, createdAt: true,
      },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  // 单独获取每个用户的作品数
  const userProjectCounts = await Promise.all(
    users.map(u => prisma.project.count({ where: { submitterId: u.id } }))
  );
  const userWithCounts = users.map((u, i) => ({ ...u, projectCount: userProjectCounts[i] }));

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>用户管理</h1>
        <Link href="/admin" className="btn-secondary px-4 py-2 rounded-lg text-sm">← 返回仪表盘</Link>
      </div>

      {/* 角色筛选 */}
      <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-wrap gap-2" style={{ borderColor: "#D0DEE8" }}>
        {ROLES.map(r => {
          const active = role === r.value;
          return (
            <Link key={r.value} href={`/admin/users?role=${r.value}&page=1`}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${active ? "font-medium" : ""}`}
              style={active ? { background: "#25547A", color: "#fff" } : { color: "#555", background: "#F0F5F9" }}>
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
        {userWithCounts.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "#777" }}>暂无用户</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>用户</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>角色</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>状态</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>作品数</th>
                <th className="text-left p-3 font-medium" style={{ color: "#555" }}>注册时间</th>
                <th className="text-right p-3 font-medium" style={{ color: "#555" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {userWithCounts.map(u => (
                <tr key={u.id} className="border-b hover:bg-[#F0F5F9] transition-colors" style={{ borderColor: "#EEE" }}>
                  <td className="p-3">
                    <div className="font-medium" style={{ color: "#333" }}>{u.name || "未命名"}</div>
                    <div className="text-xs" style={{ color: "#777" }}>{u.email}</div>
                    {u.emailVerified && (
                      <span className="text-xs" style={{ color: "#88C232" }}>已验证</span>
                    )}
                  </td>
                  <td className="p-3">
                    <RoleSelect userId={u.id} currentRole={u.role} />
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={
                      u.isActive
                        ? { background: "#E8F5E9", color: "#2E7D32" }
                        : { background: "#FDE8E8", color: "#C62828" }
                    }>
                      {u.isActive ? "正常" : "已停用"}
                    </span>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "#777" }}>{u.projectCount}</td>
                  <td className="p-3 text-xs" style={{ color: "#999" }}>
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/profile?id=${u.id}`} className="text-xs hover:underline" style={{ color: "#3388BB" }}>查看</Link>
                      <form action={updateUserActive.bind(null, u.id, !u.isActive)} className="inline">
                        <button type="submit" className="text-xs hover:underline cursor-pointer" style={{ color: u.isActive ? "#C62828" : "#88C232" }}>
                          {u.isActive ? "停用" : "激活"}
                        </button>
                      </form>
                      <form action={deleteUser.bind(null, u.id)} className="inline"
                        onSubmit={e => { if (!confirm("确认删除此用户？此操作不可撤销。")) e.preventDefault(); }}>
                        <button type="submit" className="text-xs hover:underline cursor-pointer text-red-600">删除</button>
                      </form>
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
          {page > 1 && <Link href={`/admin/users?role=${role}&page=${page - 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">上一页</Link>}
          <span className="px-3 py-1.5 text-sm" style={{ color: "#777" }}>{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/admin/users?role=${role}&page=${page + 1}`} className="btn-secondary px-3 py-1.5 rounded-lg text-sm">下一页</Link>}
        </div>
      )}
    </div>
  );
}

/**
 * 角色下拉选择器（Server Action）
 */
function RoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  async function changeRole(formData: FormData) {
    "use server";
    const newRole = formData.get("role") as string;
    await prisma.user.update({ where: { id: userId }, data: { role: newRole as any } });
    revalidatePath("/admin/users");
  }

  return (
    <form action={changeRole} className="inline">
      <select name="role" defaultValue={currentRole}
        onChange={e => e.currentTarget.form?.requestSubmit()}
        className="text-xs rounded border px-1 py-0.5 cursor-pointer"
        style={{ borderColor: "#D0DEE8", color: "#333", background: "#fff" }}>
        <option value="USER">普通用户</option>
        <option value="MEMBER">成员</option>
        <option value="REVIEWER">审核员</option>
        <option value="ADMIN">管理员</option>
      </select>
    </form>
  );
}
