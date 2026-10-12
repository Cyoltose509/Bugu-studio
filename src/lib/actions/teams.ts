"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalidateCache } from "@/lib/db/cache";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const name = (formData.get("name") as string || "").trim();
  if (!name || name.length > 30) return { error: t(lang, "teams.errNameLength") };

  const existing = await prisma.jamTeam.findFirst({
    where: { activityId, name },
  });
  if (existing) return { error: t(lang, "teams.errNameTaken") };

  const alreadyInTeam = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
  });
  if (alreadyInTeam) return { error: t(lang, "teams.errAlreadyInOther") };

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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: t(lang, "teams.errLeaderEdit") };

  const name = (formData.get("name") as string || "").trim();
  if (!name || name.length > 30) return { error: t(lang, "teams.errNameLength") };

  const existing = await prisma.jamTeam.findFirst({
    where: { activityId, name, id: { not: teamId } },
  });
  if (existing) return { error: t(lang, "teams.errNameTaken") };

  await prisma.jamTeam.update({ where: { id: teamId }, data: { name } });
  invalidateCache(`jam:${activityId}:teams`);
  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function setTeamTopic(teamId: string, activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: t(lang, "teams.errLeaderTopic") };

  const topic = (formData.get("topic") as string || "").trim();
  if (!topic || topic.length > 200) return { error: t(lang, "teams.errTopicLength") };

  await prisma.jamTeam.update({ where: { id: teamId }, data: { topic } });
  invalidateCache(`jam:${activityId}:teams`);
  invalidateCache(`activity:detail:${activityId}`);
  revalidatePath(`/activities/${activityId}`, "layout");
  return { success: true, topic };
}

export async function disbandTeam(teamId: string, activityId: string) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: t(lang, "teams.errLeaderDisband") };

  await prisma.jamTeam.delete({ where: { id: teamId } });
  invalidateCache(`jam:${activityId}:teams`);
  revalidatePath(`/activities/${activityId}`);
  redirect(`/activities/${activityId}`);
}

// ============================================================
// 入队申请
// ============================================================

export async function applyToTeam(teamId: string, activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const message = (formData.get("message") as string || "").trim();

  const alreadyInTeam = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
  });
  if (alreadyInTeam) return { error: t(lang, "teams.errAlreadyInTeam") };

  const existingApp = await prisma.jamTeamApplication.findFirst({
    where: { teamId, userId: session.user.id, status: "PENDING" },
  });
  if (existingApp) return { error: t(lang, "teams.errAlreadyApplied") };

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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: t(lang, "teams.errLeaderHandle") };

  const app = await prisma.jamTeamApplication.findUnique({ where: { id: applicationId } });
  if (!app || app.teamId !== teamId) return { error: t(lang, "teams.errApplicationNotFound") };
  if (app.status !== "PENDING") return { error: t(lang, "teams.errApplicationHandled") };

  await prisma.jamTeamApplication.update({
    where: { id: applicationId },
    data: { status: action },
  });

  if (action === "APPROVED") {
    const sizeInfo = await getTeamSizeInfo(teamId);
    if (sizeInfo && sizeInfo.currentCount >= sizeInfo.maxTeamSize) {
      return { error: t(lang, "teams.errTeamFull", { n: sizeInfo.maxTeamSize }) };
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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const inviteeUserId = (formData.get("inviteeUserId") as string || "").trim();
  if (!inviteeUserId) return { error: t(lang, "teams.errSelectInvitee") };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: t(lang, "teams.errLeaderInvite") };

  const invitee = await prisma.user.findUnique({
    where: { id: inviteeUserId },
    include: { member: { select: { graduated: true } } },
  });
  if (!invitee) return { error: t(lang, "judging.errUserNotFound") };
  if (invitee.id === session.user.id) return { error: t(lang, "teams.errInviteSelf") };
  if (invitee.role === "GUEST") return { error: t(lang, "teams.errGuestInvite") };
  if (invitee.member && invitee.member.graduated) return { error: t(lang, "teams.errGraduatedInvite") };

  const alreadyMember = await prisma.jamTeamMember.findFirst({
    where: { teamId, userId: invitee.id },
  });
  if (alreadyMember) return { error: t(lang, "teams.errUserInTeam") };

  const inOtherTeam = await prisma.jamTeamMember.findFirst({
    where: { userId: invitee.id, team: { activityId, id: { not: teamId } } },
  });
  if (inOtherTeam) return { error: t(lang, "teams.errUserInOtherTeam") };

  const sizeInfo = await getTeamSizeInfo(teamId);
  if (sizeInfo && sizeInfo.currentCount >= sizeInfo.maxTeamSize) {
    return { error: t(lang, "teams.errTeamFull", { n: sizeInfo.maxTeamSize }) };
  }

  const existingInv = await prisma.jamTeamInvitation.findFirst({
    where: { teamId, inviteeId: invitee.id, status: "PENDING" },
  });
  if (existingInv) return { error: t(lang, "teams.errInviteSent") };

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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const inv = await prisma.jamTeamInvitation.findUnique({
    where: { id: invitationId },
    include: { team: true, inviter: true },
  });
  if (!inv || inv.inviteeId !== session.user.id) return { error: t(lang, "teams.errInvitationNotFound") };
  if (inv.status !== "PENDING") return { error: t(lang, "teams.errInvitationHandled") };

  await prisma.jamTeamInvitation.update({
    where: { id: invitationId },
    data: { status: action },
  });

  if (action === "ACCEPTED") {
    const alreadyInTeam = await prisma.jamTeamMember.findFirst({
      where: { userId: session.user.id, team: { activityId: inv.team.activityId } },
    });
    if (alreadyInTeam) return { error: t(lang, "teams.errAlreadyInOther") };

    const sizeInfo = await getTeamSizeInfo(inv.teamId);
    if (sizeInfo && sizeInfo.currentCount >= sizeInfo.maxTeamSize) {
      return { error: t(lang, "teams.errTeamFull", { n: sizeInfo.maxTeamSize }) };
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
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const team = await prisma.jamTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: session.user.id, role: "LEADER" } } },
  });
  if (!team || team.members.length === 0) return { error: t(lang, "teams.errLeaderRemove") };

  const member = await prisma.jamTeamMember.findFirst({ where: { id: memberId, teamId } });
  if (!member) return { error: t(lang, "teams.errMemberNotFound") };
  if (member.role === "LEADER") return { error: t(lang, "teams.errRemoveLeader") };

  await prisma.jamTeamMember.delete({ where: { id: memberId } });
  revalidatePath(`/activities/${activityId}/game-jam/teams/${teamId}`);
  return { success: true };
}

export async function leaveTeam(teamId: string, activityId: string) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const membership = await prisma.jamTeamMember.findFirst({
    where: { teamId, userId: session.user.id },
  });
  if (!membership) return { error: t(lang, "teams.errNotInTeam") };

  if (membership.role === "LEADER") {
    const otherMembers = await prisma.jamTeamMember.count({
      where: { teamId, userId: { not: session.user.id } },
    });
    if (otherMembers > 0) return { error: t(lang, "teams.errLeaderLeave") };

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
