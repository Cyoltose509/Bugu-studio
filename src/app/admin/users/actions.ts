/**
 * admin/users 的 Server Actions
 * 单独文件导出，供 Client Component 引用
 */

"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

/** 确保当前用户是管理员，否则抛异常 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("权限不足：仅管理员可执行此操作");
  }
}

export async function updateUserRole(id: string, formData: FormData) {
  await requireAdmin();
  const role = formData.get("role") as string;
  await prisma.user.update({ where: { id }, data: { role: role as any } });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
