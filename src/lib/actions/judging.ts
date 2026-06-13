"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";

// ============================================================
// 评委管理
// ============================================================

export async function addJudge(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  if (session.user.role === "GUEST") return { error: "权限不足" };

  const judgeUserId = (formData.get("judgeUserId") as string || "").trim();
  if (!judgeUserId) return { error: "请选择评委" };

  const judge = await prisma.user.findUnique({
    where: { id: judgeUserId },
    include: { member: { select: { isActive: true } } },
  });
  if (!judge) return { error: "找不到该用户" };
  if (judge.role === "GUEST") return { error: "Guest 用户不能担任评委" };
  if (judge.member && !judge.member.isActive) return { error: "该用户已退役，不能担任评委" };

  const existing = await prisma.jamJudge.findFirst({
    where: { activityId, userId: judge.id },
  });
  if (existing) return { error: "该用户已是评委" };

  await prisma.jamJudge.create({
    data: { activityId, userId: judge.id },
  });

  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

export async function removeJudge(activityId: string, judgeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };
  if (session.user.role === "GUEST") return { error: "权限不足" };

  const judge = await prisma.jamJudge.findFirst({ where: { id: judgeId, activityId } });
  if (!judge) return { error: "评委不存在" };

  await prisma.jamJudge.delete({ where: { id: judgeId } });
  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

// ============================================================
// 评分（作品评审 — COMPETITION）
// ============================================================

export async function submitScore(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const submissionId = (formData.get("submissionId") as string || "").trim();
  if (!submissionId) return { error: "缺少提交 ID" };

  const isJudge = await prisma.jamJudge.findFirst({
    where: { activityId, userId: session.user.id },
  });
  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isJudge && !isAdmin) return { error: "只有评委或管理员可以打分" };

  const art = parseInt((formData.get("art") as string) || "0", 10);
  const story = parseInt((formData.get("story") as string) || "0", 10);
  const gameplay = parseInt((formData.get("gameplay") as string) || "0", 10);
  const comment = (formData.get("comment") as string || "").trim();

  if (art < 0 || story < 0 || gameplay < 0) return { error: "分数不能为负" };
  if (art > 100 || story > 100 || gameplay > 100) return { error: "分数不能超过 100" };

  const totalScore = Math.round((art + story + gameplay) / 3);
  const criteria = { art, story, gameplay };

  const existing = await prisma.jamScore.findFirst({
    where: { submissionId, judgeId: session.user.id },
  });

  if (existing) {
    await prisma.jamScore.update({
      where: { id: existing.id },
      data: { criteria, totalScore, comment: comment || undefined },
    });
  } else {
    await prisma.jamScore.create({
      data: {
        submissionId,
        judgeId: session.user.id,
        criteria,
        totalScore,
        comment: comment || undefined,
      },
    });
  }

  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

// ============================================================
// 评分（讲题评审 — COURSE）
// ============================================================

export async function submitCourseScore(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const teamId = (formData.get("teamId") as string || "").trim();
  if (!teamId) return { error: "缺少队伍 ID" };

  const isJudge = await prisma.jamJudge.findFirst({
    where: { activityId, userId: session.user.id },
  });
  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isJudge && !isAdmin) return { error: "只有评委或管理员可以打分" };

  const content = parseInt((formData.get("content") as string) || "0", 10);
  const delivery = parseInt((formData.get("delivery") as string) || "0", 10);
  const preparation = parseInt((formData.get("preparation") as string) || "0", 10);
  const comment = (formData.get("comment") as string || "").trim();

  if (content < 0 || delivery < 0 || preparation < 0) return { error: "分数不能为负" };
  if (content > 100 || delivery > 100 || preparation > 100) return { error: "分数不能超过 100" };

  const totalScore = Math.round((content + delivery + preparation) / 3);
  const criteria = { content, delivery, preparation };

  const existing = await prisma.courseScore.findUnique({
    where: { teamId_judgeId: { teamId, judgeId: session.user.id } },
  });

  if (existing) {
    await prisma.courseScore.update({
      where: { id: existing.id },
      data: { criteria, totalScore, comment: comment || undefined },
    });
  } else {
    await prisma.courseScore.create({
      data: {
        teamId, judgeId: session.user.id, activityId,
        criteria, totalScore, comment: comment || undefined,
      },
    });
  }

  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

// ============================================================
// 结果公布
// ============================================================

export async function publishResults(activityId: string) {
  const session = await auth();
  if (!session?.user?.id || ((session.user.role as string) !== "ADMIN" && (session.user.role as string) !== "SUPER_ADMIN")) {
    return { error: "只有管理员可以公布结果" };
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: { status: "ARCHIVED" },
  });

  invalidateCache("activities:list");
  invalidateCache("home:activities");
  revalidatePath(`/activities/${activityId}`);
  return { success: true };
}
