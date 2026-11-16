"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { auth } from "@/lib/auth/auth";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";
import { notifyProjectPublished, notifyProjectReviewResult } from "@/lib/services/notification";

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

  // ── 通知提交者（审核人就是提交者时内部会跳过） ──
  if (project.submitterId) {
    await notifyProjectReviewResult({
      projectId: id,
      projectTitle: project.title,
      submitterId: project.submitterId,
      approved: true,
      reReview: project.status !== "PENDING",
      reviewerId: session?.user?.id,
    });
  }

  // ── 通知关注上新的成员（作品已通过，不再给管理员发"待审核"） ──
  if (project.submitterId) {
    const submitter = await prisma.user.findUnique({
      where: { id: project.submitterId },
      select: { name: true },
    });
    await notifyProjectPublished(id, project.title, submitter?.name || "未知用户", {
      excludeUserIds: [project.submitterId, session?.user?.id].filter(Boolean) as string[],
    });
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
