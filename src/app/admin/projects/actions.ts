"use server";

import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification, notifyNewProject } from "@/lib/services/notification";

async function invalidateProjectCaches(id?: string) {
  await Promise.all([
    invalidateCache("api:projects:"),
    invalidateCache("api:project:"),
    invalidateCache("works:count:"),
    invalidateCache("works:sidebar:tags"),
    invalidateCache("works:likes:"),
    invalidateCache("works:latest"),
    invalidateCache("admin:projects:"),
    invalidateCache("admin:projectCount"),
    invalidateCache("members:all"),
    ...(id ? [invalidateCache(`project:detail:${id}`)] : []),
  ]);
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  await requireAdmin();
  const session = await auth();

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

  const approved = status === ProjectStatus.PUBLISHED;

  // 事务：更新作品状态 + 创建审核记录
  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: {
        status,
        publishedAt: approved ? new Date() : null,
      },
    }),
    prisma.review.create({
      data: {
        projectId: id,
        reviewerId: session!.user.id,
        approved,
        note: approved ? "管理后台审核通过" : "管理后台审核拒绝",
      },
    }),
  ]);

  await invalidateProjectCaches(project.slug);
  revalidatePath("/admin/projects");
  revalidatePath("/members");
  revalidatePath("/works");
  revalidatePath(`/works/${project.slug}`);

  // ── 通知提交者审核结果 ──
  if (project.submitterId) {
    await createNotification({
      userId: project.submitterId,
      type: "PROJECT_REVIEW",
      title: approved ? "作品审核通过 ✅" : "作品审核未通过 ❌",
      content: approved
        ? `你的作品《${project.title}》已审核通过，现在可以在社团主页公开展示了`
        : `你的作品《${project.title}》未通过审核，你可以修改后重新提交`,
      relatedId: id,
      relatedType: "Project",
    });

    // ── 通过时通知管理员 & 关注上新的成员 ──
    if (approved) {
      const submitter = await prisma.user.findUnique({
        where: { id: project.submitterId },
        select: { name: true },
      });
      await notifyNewProject(id, project.title, submitter?.name || "未知用户");
    }
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
