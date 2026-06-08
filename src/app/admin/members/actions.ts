"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";

export async function toggleMemberActive(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.clubMember.update({ where: { id }, data: { isActive } });
  invalidateMemberCaches(id);
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

export async function deleteMember(id: string) {
  await requireAdmin();
  await prisma.clubMember.delete({ where: { id } });
  invalidateMemberCaches(id);
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

export async function updateMemberDetails(id: string, formData: FormData) {
  await requireAdmin();

  const grade = formData.get("grade") as string;
  const position = formData.get("position") as string;
  const isActiveStr = formData.get("isActive") as string;

  const isValidPosition = ["MEMBER", "PRESIDENT", "VICE_PRESIDENT"].includes(position);

  await prisma.clubMember.update({
    where: { id },
    data: {
      ...(grade !== undefined && { grade: grade || null }),
      ...(isValidPosition && { position }),
      ...(isActiveStr !== null && { isActive: isActiveStr === "true" }),
    },
  });

  invalidateMemberCaches(id);
  revalidatePath("/admin/members");
  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  revalidatePath("/profile");
}

/** 清除与指定成员相关的所有查询缓存 */
function invalidateMemberCaches(memberId: string) {
  invalidateCache(`member:detail:${memberId}`);
  invalidateCache(`member:meta:${memberId}`);
  invalidateCache("members:all");
  invalidateCache("admin:memberCount");
  // admin:members:page* 的 TTL 只有 15s，超时自动失效
}
