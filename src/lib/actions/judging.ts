"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

// ============================================================
// 评委管理
// ============================================================

export async function addJudge(activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isAdmin) return { error: t(lang, "works.edit.forbidden") };

  const judgeUserId = (formData.get("judgeUserId") as string || "").trim();
  const externalName = (formData.get("externalName") as string || "").trim();
  const title = (formData.get("title") as string || "").trim() || undefined;

  if (externalName) {
    if (externalName.length > 80) return { error: "评委姓名过长（最多80字）" };
    const existing = await prisma.jamJudge.findFirst({
      where: {
        activityId,
        externalName: { equals: externalName, mode: "insensitive" },
      },
    });
    if (existing) return { error: t(lang, "judging.errAlreadyJudge") };

    await prisma.jamJudge.create({
      data: { activityId, externalName, title },
    });
  } else if (judgeUserId) {
    const judge = await prisma.user.findUnique({
      where: { id: judgeUserId },
    });
    if (!judge) return { error: t(lang, "judging.errUserNotFound") };
    if (judge.role === "GUEST") return { error: t(lang, "judging.errGuestJudge") };

    const existing = await prisma.jamJudge.findFirst({
      where: { activityId, userId: judge.id },
    });
    if (existing) return { error: t(lang, "judging.errAlreadyJudge") };

    await prisma.jamJudge.create({
      data: { activityId, userId: judge.id, title },
    });
  } else {
    return { error: t(lang, "judging.errSelectJudge") };
  }

  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

export async function joinAdminAsJudge(activityId: string) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isAdmin) return { error: t(lang, "works.edit.forbidden") };

  const existing = await prisma.jamJudge.findFirst({
    where: { activityId, userId: session.user.id },
  });
  if (existing) return { error: t(lang, "judging.errAlreadyJudge") };

  await prisma.jamJudge.create({
    data: { activityId, userId: session.user.id },
  });

  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

export async function removeJudge(activityId: string, judgeId: string) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";

  const judge = await prisma.jamJudge.findFirst({ where: { id: judgeId, activityId } });
  if (!judge) return { error: t(lang, "judging.errJudgeNotFound") };

  // 仅管理员或评委本人可以移除评委
  if (!isAdmin && judge.userId !== session.user.id) {
    return { error: t(lang, "works.edit.forbidden") };
  }

  await prisma.jamJudge.delete({ where: { id: judgeId } });
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

export async function updateJudgingSettings(activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isAdmin) return { error: t(lang, "works.edit.forbidden") };

  const rawMode = (formData.get("judgingMode") as string || "ONLINE").trim();
  const judgingMode = ["ONLINE", "EXTERNAL", "DISABLED"].includes(rawMode) ? rawMode : "ONLINE";
  const judgesPublic = formData.get("judgesPublic") === "on" || formData.get("judgesPublic") === "true";
  const externalJudgingUrl = (formData.get("externalJudgingUrl") as string || "").trim() || null;

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      judgingMode,
      judgesPublic,
      externalJudgingUrl,
    },
  });

  invalidateCache("activities:list");
  invalidateCache("home:activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/course/judging`);
  return { success: true };
}

// ============================================================
// 评分（作品评审 — COMPETITION）
// ============================================================

export async function submitScore(activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const submissionId = (formData.get("submissionId") as string || "").trim();
  if (!submissionId) return { error: t(lang, "gamejam.errNoId") };

  const isJudge = await prisma.jamJudge.findFirst({
    where: { activityId, userId: session.user.id },
  });
  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isJudge && !isAdmin) return { error: t(lang, "judging.errOnlyJudge") };

  const art = parseInt((formData.get("art") as string) || "0", 10);
  const story = parseInt((formData.get("story") as string) || "0", 10);
  const gameplay = parseInt((formData.get("gameplay") as string) || "0", 10);
  const comment = (formData.get("comment") as string || "").trim();

  if (art < 0 || story < 0 || gameplay < 0) return { error: t(lang, "judging.errNegativeScore") };
  if (art > 100 || story > 100 || gameplay > 100) return { error: t(lang, "judging.errScoreTooHigh") };

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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const teamId = (formData.get("teamId") as string || "").trim();
  if (!teamId) return { error: t(lang, "judging.errNoTeamId") };

  const isJudge = await prisma.jamJudge.findFirst({
    where: { activityId, userId: session.user.id },
  });
  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isJudge && !isAdmin) return { error: t(lang, "judging.errOnlyJudge") };

  const content = parseInt((formData.get("content") as string) || "0", 10);
  const delivery = parseInt((formData.get("delivery") as string) || "0", 10);
  const preparation = parseInt((formData.get("preparation") as string) || "0", 10);
  const comment = (formData.get("comment") as string || "").trim();

  if (content < 0 || delivery < 0 || preparation < 0) return { error: t(lang, "judging.errNegativeScore") };
  if (content > 100 || delivery > 100 || preparation > 100) return { error: t(lang, "judging.errScoreTooHigh") };

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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id || ((session.user.role as string) !== "ADMIN" && (session.user.role as string) !== "SUPER_ADMIN")) {
    return { error: t(lang, "judging.errOnlyAdminPublish") };
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
