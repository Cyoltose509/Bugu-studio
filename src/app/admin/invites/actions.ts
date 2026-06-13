"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function createInviteCode(formData: FormData) {
  await requireAdmin();
  const role = (formData.get("role") as string) || "MEMBER";

  // 安全：邀请码最高角色为 MEMBER，禁止直接赋予 ADMIN
  const SAFE_ROLES = ["USER", "MEMBER"] as const;
  if (!SAFE_ROLES.includes(role as any)) {
    throw new Error("邀请码不允许赋予该角色，最高角色为 MEMBER");
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
