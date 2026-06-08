"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { revalidatePath } from "next/cache";

export async function toggleMemberActive(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.clubMember.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

export async function deleteMember(id: string) {
  await requireAdmin();
  await prisma.clubMember.delete({ where: { id } });
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

  revalidatePath("/admin/members");
  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  revalidatePath("/profile");
}
