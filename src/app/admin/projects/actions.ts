"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  await requireAdmin();
  await prisma.project.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
  await invalidateCache("members:all");
}

export async function deleteProject(id: string) {
  await requireAdmin();
  await prisma.project.delete({ where: { id } });
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
  await invalidateCache("members:all");
}

export async function toggleFeatured(id: string, current: boolean) {
  await requireAdmin();
  await prisma.project.update({ where: { id }, data: { isFeatured: !current } });
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
  await invalidateCache("members:all");
}
