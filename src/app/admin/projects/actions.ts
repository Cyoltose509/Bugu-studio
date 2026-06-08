"use server";

import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  await prisma.project.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projects");
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/admin/projects");
}

export async function toggleFeatured(id: string, current: boolean) {
  await prisma.project.update({ where: { id }, data: { isFeatured: !current } });
  revalidatePath("/admin/projects");
}
