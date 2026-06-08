/**
 * admin/users 的 Server Actions
 * 单独文件导出，供 Client Component 引用
 */

"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { revalidatePath } from "next/cache";

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
