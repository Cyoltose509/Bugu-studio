"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { auth } from "@/lib/auth/auth";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";
import { createNotification, notifyNewProject } from "@/lib/services/notification";

export async function approveProject(id: string) {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id },
    select: { slug: true, status: true, title: true, submitterId: true },
  });
  if (!project) throw new Error("作品不存在");

  if (project.status !== "PENDING" && project.status !== "REJECTED") {
    throw new Error("该作品当前状态不需要审核");
  }

  await prisma.project.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // 创建审核记录
  const session = await auth();
  if (session?.user?.id) {
    await prisma.review.create({
      data: {
        projectId: id,
        reviewerId: session.user.id,
        approved: true,
        note: "管理员审核通过",
      },
    });
  }

  // ── 通知提交者 ──
  if (project.submitterId) {
    const approvedLabel = project.status === "PENDING" ? "审核通过" : "重新审核通过";
    await createNotification({
      userId: project.submitterId,
      type: "PROJECT_REVIEW",
      title: `作品${approvedLabel} ✅`,
      content: `你的作品《${project.title}》已${approvedLabel}，现在可以在社团主页公开展示了`,
      relatedId: id,
      relatedType: "Project",
    });
  }

  // ── 通知管理员 & 关注上新的成员 ──
  if (project.submitterId) {
    const submitter = await prisma.user.findUnique({
      where: { id: project.submitterId },
      select: { name: true },
    });
    await notifyNewProject(id, project.title, submitter?.name || "未知用户");
  }

  // ── 清除缓存 ──
  await Promise.all([
    invalidateCache("members:all"),
    invalidateCache("api:projects:"),
    invalidateCache("api:project:"),
    invalidateCache("works:sidebar:tags"),
    invalidateCache("works:count:"),
    invalidateCache("admin:projects:"),
    invalidateCache("admin:projectCount"),
    invalidateCache(`project:detail:${project.slug}`),
  ]);
  revalidatePath("/members");
  revalidatePath("/works");
  revalidatePath(`/works/${project.slug}`);
  revalidatePath("/admin/projects");
}
