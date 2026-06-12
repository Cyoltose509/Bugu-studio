"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { createNotification } from "@/lib/services/notification";
import { POSITION_LABEL } from "@/lib/position";
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

  const gradeRaw = formData.get("grade") as string;
  const grade = gradeRaw ? parseInt(gradeRaw, 10) : null;
  const joinYearRaw = formData.get("joinYear") as string;
  const joinYear = joinYearRaw ? parseInt(joinYearRaw, 10) : null;
  const position = formData.get("position") as string;
  const isActiveStr = formData.get("isActive") as string;

  const isValidPosition = ["MEMBER", "PRESIDENT", "VICE_PRESIDENT", "PAST_PRESIDENT", "PAST_VICE_PRESIDENT", "FOUNDER"].includes(position);

  // 先查当前成员信息，用于通知
  const current = await prisma.clubMember.findUnique({
    where: { id },
    select: { userId: true, displayName: true, position: true },
  });

  await prisma.clubMember.update({
    where: { id },
    data: {
      ...(grade !== null && { grade }),
      ...(joinYear !== null && { joinYear }),
      ...(isValidPosition && { position }),
      ...(isActiveStr !== null && { isActive: isActiveStr === "true" }),
    },
  });

  // ── 通知成员身份变更 ──
  if (current && isValidPosition) {
    if (current.position !== position) {
      await createNotification({
        userId: current.userId,
        type: "ROLE_CHANGE",
        title: "社团身份已变更",
        content: `你的身份已变更为「${POSITION_LABEL[position] || position}」`,
        relatedId: id,
        relatedType: "User",
      });
    }
  }

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
