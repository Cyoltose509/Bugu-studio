"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";

export async function deleteOwnProject(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("请先登录");

  const project = await prisma.project.findUnique({
    where: { id },
    select: { submitterId: true, slug: true },
  });
  if (!project) throw new Error("作品不存在");
  if (project.submitterId !== session.user.id && session.user.role !== "ADMIN") {
    throw new Error("无权删除此作品");
  }

  await prisma.project.delete({ where: { id } });

  // 清除相关缓存
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
    invalidateCache(`project:detail:${project.slug}`),
    invalidateCache(`project:detail:${id}`),
  ]);

  revalidatePath("/works");
  revalidatePath("/members");
  revalidatePath("/admin/projects");
}
