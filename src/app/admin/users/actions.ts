/**
 * admin/users 的 Server Actions
 * 单独文件导出，供 Client Component 引用
 */

"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";

const MEMBER_ROLES = ["MEMBER", "ADMIN"] as const;

export async function updateUserRole(id: string, formData: FormData) {
  await requireAdmin();
  const role = formData.get("role") as string;

  // 先获取当前角色用于对比
  const current = await prisma.user.findUnique({
    where: { id },
    select: { role: true, name: true },
  });
  if (!current) throw new Error("用户不存在");

  await prisma.user.update({ where: { id }, data: { role: role as any } });

  const wasMember = MEMBER_ROLES.includes(current.role as any);
  const isMember = MEMBER_ROLES.includes(role as any);

  if (!wasMember && isMember) {
    // 升级为成员：自动创建 ClubMember
    await prisma.clubMember.create({
      data: {
        userId: id,
        displayName: current.name || "未命名",
        joinYear: new Date().getFullYear(),
      },
    });
  } else if (wasMember && !isMember) {
    // 降级为非成员：标记 ClubMember 为已毕业
    await prisma.clubMember.updateMany({
      where: { userId: id },
      data: { graduated: true },
    });
  }
  // wasMember && isMember：角色在成员类之间切换（MEMBER↔ADMIN），只更新 DB 即可

  // 刷新所有相关页面
  revalidatePath("/admin/users");
  revalidatePath("/admin/members");
  revalidatePath("/members");
  revalidatePath("/profile");

  // 清除相关缓存
  await Promise.all([
    invalidateCache("members:all"),
    invalidateCache("admin:members"),
    invalidateCache("admin:memberCount"),
    invalidateCache("admin:users:"),
    invalidateCache("admin:userCount"),
  ]);
}

export async function toggleUserActive(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { isActive } });
  invalidateCache("admin:users:");
  revalidatePath("/admin/users");
  revalidatePath("/profile");
}

export async function toggleConfirmedNotMember(id: string, value: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { confirmedNotMember: value } });
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  await prisma.clubMember.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  await Promise.all([
    invalidateCache("members:all"),
    invalidateCache("admin:members"),
    invalidateCache("admin:memberCount"),
    invalidateCache("admin:users:"),
    invalidateCache("admin:userCount"),
  ]);
  revalidatePath("/admin/users");
  revalidatePath("/admin/members");
  revalidatePath("/members");
}
