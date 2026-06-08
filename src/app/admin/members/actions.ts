"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function toggleMemberActive(id: string, isActive: boolean) {
  await prisma.clubMember.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/members");
}

export async function deleteMember(id: string) {
  await prisma.clubMember.delete({ where: { id } });
  revalidatePath("/admin/members");
}
