"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/services/notification";

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
  const project = await prisma.project.findUnique({
    where: { id },
    select: { slug: true, status: true, title: true, submitterId: true },
  });
  if (!project) throw new Error("作品不存在");

  // 允许的审核转换：PENDING → PUBLISHED/REJECTED，REJECTED → PUBLISHED
  const isReviewAction = (status === "PUBLISHED" || status === "REJECTED");
  if (isReviewAction && project.status !== "PENDING" && !(status === "PUBLISHED" && project.status === "REJECTED")) {
    throw new Error(`该项目当前状态为"${project.status}"，无法执行此操作`);
  }

  await prisma.project.update({ where: { id }, data: { status } });
  await invalidateProjectCaches(project.slug);
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");

  // ── 审核通过时通知制作者 ──
  if (status === "PUBLISHED" && project.submitterId) {
    const approved = project.status === "PENDING" ? "审核通过" : "重新审核通过";
    await createNotification({
      userId: project.submitterId,
      type: "PROJECT_REVIEW",
      title: `作品${approved} ✅`,
      content: `你的作品《${project.title}》已${approved}，现在可以在社团主页公开展示了`,
      relatedId: id,
      relatedType: "Project",
    });
  }
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
