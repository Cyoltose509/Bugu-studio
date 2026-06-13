"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function createInviteCode(formData: FormData) {
  await requireAdmin();
  const role = (formData.get("role") as string) || "MEMBER";

  const VALID_ROLES = ["USER", "MEMBER", "ADMIN"] as const;
  if (!VALID_ROLES.includes(role as any)) {
    throw new Error("无效的角色类型");
  }

  const maxUses = formData.get("maxUses") as string;
  const expiresDays = formData.get("expiresDays") as string;
  const description = formData.get("description") as string;

  const prefix = `BUGOO-${role}`;
  // 安全随机数生成（替代 Math.random()，防止预测）
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  const code = `${prefix}-${random}`;

  await prisma.inviteCode.create({
    data: {
      code,
      role: role as any,
      maxUses: maxUses ? parseInt(maxUses) || null : null,
      expiresAt: expiresDays
        ? new Date(Date.now() + parseInt(expiresDays) * 24 * 60 * 60 * 1000)
        : null,
      description: description || null,
    },
  });
  invalidateCache("admin:invites:");
  revalidatePath("/admin/invites");
}

export async function toggleInviteCode(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.inviteCode.update({ where: { id }, data: { isActive } });
  invalidateCache("admin:invites:");
  revalidatePath("/admin/invites");
}

export async function deleteInviteCode(id: string) {
  await requireAdmin();
  await prisma.inviteCode.delete({ where: { id } });
  invalidateCache("admin:invites:");
  revalidatePath("/admin/invites");
}

/** 删除所有无效邀请码（已过期 / 已禁用 / 已达最大使用次数） */
export async function deleteInvalidInviteCodes() {
  await requireAdmin();
  const now = new Date();
  // 先查出所有邀请码，在应用层筛选「已达最大使用次数」的（Prisma where 不支持字段间比较）
  const all = await prisma.inviteCode.findMany({ select: { id: true, isActive: true, expiresAt: true, maxUses: true, usedCount: true } });
  const invalidIds = all
    .filter(c =>
      !c.isActive ||
      (c.expiresAt && c.expiresAt < now) ||
      (c.maxUses !== null && c.usedCount >= c.maxUses)
    )
    .map(c => c.id);

  let count = 0;
  if (invalidIds.length > 0) {
    const result = await prisma.inviteCode.deleteMany({ where: { id: { in: invalidIds } } });
    count = result.count;
  }
  invalidateCache("admin:invites:");
  revalidatePath("/admin/invites");
  return count;
}

/** 删除全部邀请码 */
export async function deleteAllInviteCodes() {
  await requireAdmin();
  const result = await prisma.inviteCode.deleteMany();
  invalidateCache("admin:invites:");
  revalidatePath("/admin/invites");
  return result.count;
}
