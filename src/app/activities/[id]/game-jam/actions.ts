"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalidateCache } from "@/lib/db/cache";

// ============================================================
// 队伍操作
// ============================================================

export async function createTeam(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const name = (formData.get("name") as string || "").trim();
  if (!name || name.length > 30) return { error: "队伍名称为 1-30 个字符" };

  // 检查该活动下是否已有同名队伍
  const existing = await prisma.jamTeam.findFirst({
    where: { activityId, name },
  });
  if (existing) return { error: "队伍名称已被使用" };

  // 检查是否已加入其他队伍
  const alreadyInTeam = await prisma.jamTeamMember.findFirst({
    where: {
      userId: session.user.id,
      team: { activityId },
    },
  });
  if (alreadyInTeam) return { error: "你已加入其他队伍" };

  const team = await prisma.jamTeam.create({
    data: {
      activityId,
      name,
      leaderId: session.user.id,
      members: {
        create: { userId: session.user.id, role: "LEADER" },
      },
    },
  });

  invalidateCache(`jam:${activityId}:teams`);
  revalidatePath(`/activities/${activityId}`);
  return { success: true, teamId: team.id };
}

export async function updateTeam(teamId: string, activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以编辑队伍" };

  const name = (formData.get("name") as string || "").trim();
  if (!name || name.length > 30) return { error: "队伍名称为 1-30 个字符" };

  const existing = await prisma.jamTeam.findFirst({
    where: { activityId, name, id: { not: teamId } },
  });
  if (existing) return { error: "队伍名称已被使用" };

  await prisma.jamTeam.update({ where: { id: teamId }, data: { name } });
  invalidateCache(`jam:${activityId}:teams`);
  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function disbandTeam(teamId: string, activityId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以解散队伍" };

  await prisma.jamTeam.delete({ where: { id: teamId } });
  invalidateCache(`jam:${activityId}:teams`);
  revalidatePath(`/activities/${activityId}`);
  redirect(`/activities/${activityId}`);
}

// ============================================================
// 入队申请
// ============================================================

export async function applyToTeam(teamId: string, activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const message = (formData.get("message") as string || "").trim();

  // 检查是否已加入该活动的任何队伍
  const alreadyInTeam = await prisma.jamTeamMember.findFirst({
    where: {
      userId: session.user.id,
      team: { activityId },
    },
  });
  if (alreadyInTeam) return { error: "你已加入队伍" };

  // 检查是否已有待处理申请
  const existingApp = await prisma.jamTeamApplication.findFirst({
    where: { teamId, userId: session.user.id, status: "PENDING" },
  });
  if (existingApp) return { error: "你已提交过入队申请，请等待审批" };

  await prisma.jamTeamApplication.create({
    data: {
      teamId,
      userId: session.user.id,
      message: message || undefined,
    },
  });

  // 通知队长
  const team = await prisma.jamTeam.findUnique({ where: { id: teamId }, select: { leaderId: true, name: true } });
  if (team) {
    await prisma.notification.create({
      data: {
        userId: team.leaderId,
        type: "JAM_APPLICATION",
        title: "新的入队申请",
        content: `有人申请加入队伍「${team.name}」`,
        relatedId: `${activityId}:${teamId}`,
        relatedType: "JamTeam",
      },
    });
  }

  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function handleApplication(
  teamId: string,
  activityId: string,
  applicationId: string,
  action: "APPROVED" | "REJECTED"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  // 检查是否是队长
  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以处理申请" };

  const app = await prisma.jamTeamApplication.findUnique({ where: { id: applicationId } });
  if (!app || app.teamId !== teamId) return { error: "申请不存在" };
  if (app.status !== "PENDING") return { error: "申请已处理" };

  await prisma.jamTeamApplication.update({
    where: { id: applicationId },
    data: { status: action },
  });

  if (action === "APPROVED") {
    await prisma.jamTeamMember.create({
      data: { teamId, userId: app.userId, role: "MEMBER" },
    });

    // 通知申请人
    await prisma.notification.create({
      data: {
        userId: app.userId,
        type: "JAM_APPROVED",
        title: "入队申请已通过",
        content: `你已加入队伍「${team.name}」`,
        relatedId: `${activityId}:${teamId}`,
        relatedType: "JamTeam",
      },
    });
  } else {
    await prisma.notification.create({
      data: {
        userId: app.userId,
        type: "JAM_REJECTED",
        title: "入队申请被拒绝",
        content: `你申请加入队伍「${team.name}」的请求已被拒绝`,
        relatedId: activityId,
        relatedType: "Activity",
      },
    });
  }

  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

// ============================================================
// 邀请队员
// ============================================================

export async function inviteMember(teamId: string, activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const inviteeUserId = (formData.get("inviteeUserId") as string || "").trim();
  if (!inviteeUserId) return { error: "请选择要邀请的成员" };

  // 检查是否是队长
  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以邀请" };

  // 查找被邀请者
  const invitee = await prisma.user.findUnique({
    where: { id: inviteeUserId },
  });
  if (!invitee) return { error: "找不到该用户" };
  if (invitee.id === session.user.id) return { error: "不能邀请自己" };

  // 检查是否已在队伍中
  const alreadyMember = await prisma.jamTeamMember.findFirst({
    where: { teamId, userId: invitee.id },
  });
  if (alreadyMember) return { error: "该用户已在队伍中" };

  // 检查是否已有待处理邀请
  const existingInv = await prisma.jamTeamInvitation.findFirst({
    where: { teamId, inviteeId: invitee.id, status: "PENDING" },
  });
  if (existingInv) return { error: "已向该用户发送过邀请" };

  await prisma.jamTeamInvitation.create({
    data: {
      teamId,
      inviterId: session.user.id,
      inviteeId: invitee.id,
    },
  });

  // 通知被邀请者
  await prisma.notification.create({
    data: {
      userId: invitee.id,
      type: "JAM_INVITATION",
      title: "队伍邀请",
      content: `${session.user.name || "有人"} 邀请你加入队伍「${team.name}」`,
      relatedId: teamId,
      relatedType: "JamTeam",
    },
  });

  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function handleInvitation(
  invitationId: string,
  activityId: string,
  action: "ACCEPTED" | "REJECTED"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const inv = await prisma.jamTeamInvitation.findUnique({
    where: { id: invitationId },
    include: { team: true, inviter: true },
  });
  if (!inv || inv.inviteeId !== session.user.id) return { error: "邀请不存在" };
  if (inv.status !== "PENDING") return { error: "邀请已处理" };

  await prisma.jamTeamInvitation.update({
    where: { id: invitationId },
    data: { status: action },
  });

  if (action === "ACCEPTED") {
    // 检查是否已加入其他队伍
    const alreadyInTeam = await prisma.jamTeamMember.findFirst({
      where: {
        userId: session.user.id,
        team: { activityId: inv.team.activityId },
      },
    });
    if (alreadyInTeam) return { error: "你已加入其他队伍" };

    await prisma.jamTeamMember.create({
      data: { teamId: inv.teamId, userId: session.user.id, role: "MEMBER" },
    });

    await prisma.notification.create({
      data: {
        userId: inv.inviterId,
        type: "JAM_INVITATION_ACCEPTED",
        title: "邀请已被接受",
        content: `${session.user.name || "有人"} 已接受你的队伍邀请`,
        relatedId: inv.teamId,
        relatedType: "JamTeam",
      },
    });
  }

  revalidatePath(`/activities/${activityId}`);
  return { success: true };
}

export async function removeMember(teamId: string, activityId: string, memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { userId: session.user.id, role: "LEADER" } },
    },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以移除成员" };

  const member = await prisma.jamTeamMember.findFirst({ where: { id: memberId, teamId } });
  if (!member) return { error: "成员不存在" };
  if (member.role === "LEADER") return { error: "不能移除队长" };

  await prisma.jamTeamMember.delete({ where: { id: memberId } });
  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

// ============================================================
// 作品提交
// ============================================================

export async function submitJamWork(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const title = (formData.get("title") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const projectId = (formData.get("projectId") as string || "").trim();
  const fileUrlsStr = (formData.get("fileUrls") as string || "").trim();

  if (!title) return { error: "请填写作品标题" };

  // 查找用户的队伍
  const membership = await prisma.jamTeamMember.findFirst({
    where: {
      userId: session.user.id,
      team: { activityId },
    },
    include: { team: true },
  });
  if (!membership) return { error: "你还没有加入队伍" };

  const fileUrls = fileUrlsStr ? fileUrlsStr.split(",").map(s => s.trim()).filter(Boolean) : [];

  // 检查是否已提交过
  const existing = await prisma.jamSubmission.findUnique({
    where: { teamId: membership.teamId },
  });

  if (existing) {
    await prisma.jamSubmission.update({
      where: { id: existing.id },
      data: {
        title,
        description: description || undefined,
        projectId: projectId || undefined,
        files: fileUrls,
      },
    });
  } else {
    await prisma.jamSubmission.create({
      data: {
        activityId,
        teamId: membership.teamId,
        title,
        description: description || undefined,
        projectId: projectId || undefined,
        files: fileUrls,
      },
    });
  }

  invalidateCache(`jam:${activityId}:submissions`);
  revalidatePath(`/activities/${activityId}`);
  return { success: true };
}

// ============================================================
// 评委管理（仅管理员）
// ============================================================

export async function addJudge(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  // 检查是否是管理员或社员
  if (session.user.role === "GUEST") return { error: "权限不足" };

  const judgeUserId = (formData.get("judgeUserId") as string || "").trim();
  if (!judgeUserId) return { error: "请选择评委" };

  const judge = await prisma.user.findUnique({ where: { id: judgeUserId } });
  if (!judge) return { error: "找不到该用户" };
  if (judge.role === "GUEST") return { error: "Guest 用户不能担任评委" };

  const existing = await prisma.jamJudge.findFirst({
    where: { activityId, userId: judge.id },
  });
  if (existing) return { error: "该用户已是评委" };

  await prisma.jamJudge.create({
    data: { activityId, userId: judge.id },
  });

  revalidatePath(`/activities/${activityId}/game-jam/judging`);
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
  return { success: true };
}

// ============================================================
// 评分
// ============================================================

export async function submitScore(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const submissionId = (formData.get("submissionId") as string || "").trim();
  if (!submissionId) return { error: "缺少提交 ID" };

  // 检查是否是评委
  const isJudge = await prisma.jamJudge.findFirst({
    where: { activityId, userId: session.user.id },
  });
  // 管理员也可以打分
  const isAdmin = (session.user.role as string) === "ADMIN" || (session.user.role as string) === "SUPER_ADMIN";
  if (!isJudge && !isAdmin) return { error: "只有评委或管理员可以打分" };

  const creativity = parseInt((formData.get("creativity") as string) || "0", 10);
  const execution = parseInt((formData.get("execution") as string) || "0", 10);
  const themeFit = parseInt((formData.get("theme") as string) || "0", 10);
  const overall = parseInt((formData.get("overall") as string) || "0", 10);
  const comment = (formData.get("comment") as string || "").trim();

  if (creativity < 0 || execution < 0 || themeFit < 0 || overall < 0) return { error: "分数不能为负" };
  if (creativity > 100 || execution > 100 || themeFit > 100 || overall > 100) return { error: "分数不能超过 100" };

  const totalScore = creativity + execution + themeFit + overall;

  const criteria = { creativity, execution, theme: themeFit, overall };

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
