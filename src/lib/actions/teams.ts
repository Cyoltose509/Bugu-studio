"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalidateCache } from "@/lib/db/cache";

// ============================================================
// 辅助函数
// ============================================================

async function getTeamSizeInfo(teamId: string) {
  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: {
      _count: { select: { members: true } },
      activity: { select: { maxTeamSize: true } },
    },
  });
  if (!team) return null;
  const maxTeamSize = team.activity?.maxTeamSize ?? 6;
  const currentCount = team._count.members;
  return { maxTeamSize, currentCount };
}

// ============================================================
// 队伍操作
// ============================================================

export async function createTeam(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const name = (formData.get("name") as string || "").trim();
  if (!name || name.length > 30) return { error: "队伍名称为 1-30 个字符" };

  const existing = await prisma.jamTeam.findFirst({
    where: { activityId, name },
  });
  if (existing) return { error: "队伍名称已被使用" };

  const alreadyInTeam = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
  });
  if (alreadyInTeam) return { error: "你已加入其他队伍" };

  const team = await prisma.jamTeam.create({
    data: {
      activityId,
      name,
      leaderId: session.user.id,
      members: { create: { userId: session.user.id, role: "LEADER" } },
    },
  });

  invalidateCache(`jam:${activityId}:teams`);
  invalidateCache(`activity:detail:${activityId}`);
  revalidatePath(`/activities/${activityId}`, "layout");
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

export async function setTeamTopic(teamId: string, activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以设置讲题" };

  const topic = (formData.get("topic") as string || "").trim();
  if (!topic || topic.length > 200) return { error: "讲题为 1-200 个字符" };

  await prisma.jamTeam.update({ where: { id: teamId }, data: { topic } });
  invalidateCache(`jam:${activityId}:teams`);
  invalidateCache(`activity:detail:${activityId}`);
  revalidatePath(`/activities/${activityId}`, "layout");
  return { success: true, topic };
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

  const alreadyInTeam = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
  });
  if (alreadyInTeam) return { error: "你已加入队伍" };

  const existingApp = await prisma.jamTeamApplication.findFirst({
    where: { teamId, userId: session.user.id, status: "PENDING" },
  });
  if (existingApp) return { error: "你已提交过入队申请，请等待审批" };

  await prisma.jamTeamApplication.create({
    data: { teamId, userId: session.user.id, message: message || undefined },
  });

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    select: { leaderId: true, name: true },
  });
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
  teamId: string, activityId: string, applicationId: string,
  action: "APPROVED" | "REJECTED",
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

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
    const sizeInfo = await getTeamSizeInfo(teamId);
    if (sizeInfo && sizeInfo.currentCount >= sizeInfo.maxTeamSize) {
      return { error: `队伍已满（最多 ${sizeInfo.maxTeamSize} 人）` };
    }

    await prisma.jamTeamMember.create({
      data: { teamId, userId: app.userId, role: "MEMBER" },
    });

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

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以邀请" };

  const invitee = await prisma.user.findUnique({
    where: { id: inviteeUserId },
    include: { member: { select: { graduated: true } } },
  });
  if (!invitee) return { error: "找不到该用户" };
  if (invitee.id === session.user.id) return { error: "不能邀请自己" };
  if (invitee.role === "GUEST") return { error: "Guest 用户不能被邀请" };
  if (invitee.member && invitee.member.graduated) return { error: "该用户已毕业，不能被邀请" };

  const alreadyMember = await prisma.jamTeamMember.findFirst({
    where: { teamId, userId: invitee.id },
  });
  if (alreadyMember) return { error: "该用户已在队伍中" };

  const inOtherTeam = await prisma.jamTeamMember.findFirst({
    where: { userId: invitee.id, team: { activityId, id: { not: teamId } } },
  });
  if (inOtherTeam) return { error: "该用户已加入其他队伍" };

  const sizeInfo = await getTeamSizeInfo(teamId);
  if (sizeInfo && sizeInfo.currentCount >= sizeInfo.maxTeamSize) {
    return { error: `队伍已满（最多 ${sizeInfo.maxTeamSize} 人）` };
  }

  const existingInv = await prisma.jamTeamInvitation.findFirst({
    where: { teamId, inviteeId: invitee.id, status: "PENDING" },
  });
  if (existingInv) return { error: "已向该用户发送过邀请" };

  await prisma.jamTeamInvitation.create({
    data: { teamId, inviterId: session.user.id, inviteeId: invitee.id },
  });

  await prisma.notification.create({
    data: {
      userId: invitee.id,
      type: "JAM_INVITATION",
      title: "队伍邀请",
      content: `${session.user.name || "有人"} 邀请你加入队伍「${team.name}」`,
      relatedId: activityId,
      relatedType: "Activity",
    },
  });

  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function handleInvitation(
  invitationId: string, activityId: string,
  action: "ACCEPTED" | "REJECTED",
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
    const alreadyInTeam = await prisma.jamTeamMember.findFirst({
      where: { userId: session.user.id, team: { activityId: inv.team.activityId } },
    });
    if (alreadyInTeam) return { error: "你已加入其他队伍" };

    const sizeInfo = await getTeamSizeInfo(inv.teamId);
    if (sizeInfo && sizeInfo.currentCount >= sizeInfo.maxTeamSize) {
      return { error: `队伍已满（最多 ${sizeInfo.maxTeamSize} 人）` };
    }

    await prisma.jamTeamMember.create({
      data: { teamId: inv.teamId, userId: session.user.id, role: "MEMBER" },
    });

    await prisma.notification.create({
      data: {
        userId: inv.inviterId,
        type: "JAM_INVITATION_ACCEPTED",
        title: "邀请已被接受",
        content: `${session.user.name || "有人"} 已接受你的队伍邀请`,
        relatedId: `${activityId}:${inv.teamId}`,
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
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: "只有队长可以移除成员" };

  const member = await prisma.jamTeamMember.findFirst({ where: { id: memberId, teamId } });
  if (!member) return { error: "成员不存在" };
  if (member.role === "LEADER") return { error: "不能移除队长" };

  await prisma.jamTeamMember.delete({ where: { id: memberId } });
  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function leaveTeam(teamId: string, activityId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const membership = await prisma.jamTeamMember.findFirst({
    where: { teamId, userId: session.user.id },
  });
  if (!membership) return { error: "你不在此队伍中" };

  if (membership.role === "LEADER") {
    const otherMembers = await prisma.jamTeamMember.count({
      where: { teamId, userId: { not: session.user.id } },
    });
    if (otherMembers > 0) return { error: "队长不能直接退出，请先转让队长或解散队伍" };

    await prisma.jamTeam.delete({ where: { id: teamId } });
    invalidateCache(`jam:${activityId}:teams`);
    revalidatePath(`/activities/${activityId}`);
    redirect(`/activities/${activityId}`);
  }

  await prisma.jamTeamMember.delete({ where: { id: membership.id } });
  invalidateCache(`jam:${activityId}:teams`);
  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  revalidatePath(`/activities/${activityId}`);
  return { success: true };
}
