"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function invalidateProjectCaches(id?: string) {
  await Promise.all([
    invalidateCache("api:projects:"),
    invalidateCache("api:project:"),
    invalidateCache("works:count:"),
    invalidateCache("works:sidebar:tags"),
    invalidateCache("works:likes:"),
    invalidateCache("works:featured"),
    invalidateCache("works:latest"),
    invalidateCache("admin:projects:"),
    invalidateCache("admin:projectCount"),
    invalidateCache("members:all"),
    ...(id ? [invalidateCache(`project:detail:${id}`)] : []),
  ]);
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  await requireAdmin();
  const project = await prisma.project.findUnique({ where: { id }, select: { slug: true } });
  await prisma.project.update({ where: { id }, data: { status } });
  await invalidateProjectCaches(project?.slug);
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
}

export async function deleteProject(id: string) {
  await requireAdmin();
  const project = await prisma.project.findUnique({ where: { id }, select: { slug: true } });
  await prisma.project.delete({ where: { id } });
  await invalidateProjectCaches(project?.slug);
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
}

export async function toggleFeatured(id: string, current: boolean) {
  await requireAdmin();
  await prisma.project.update({ where: { id }, data: { isFeatured: !current } });
  await invalidateProjectCaches();
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
}
