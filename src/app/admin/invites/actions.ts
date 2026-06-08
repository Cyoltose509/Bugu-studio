"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function createInviteCode(formData: FormData) {
  const role = formData.get("role") as string;
  const maxUses = formData.get("maxUses") as string;
  const expiresDays = formData.get("expiresDays") as string;
  const description = formData.get("description") as string;

  const prefix = `BUGU-${role}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
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
  revalidatePath("/admin/invites");
}

export async function toggleInviteCode(id: string, isActive: boolean) {
  await prisma.inviteCode.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/invites");
}

export async function deleteInviteCode(id: string) {
  await prisma.inviteCode.delete({ where: { id } });
  revalidatePath("/admin/invites");
}
