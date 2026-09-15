"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { auth } from "@/lib/auth/auth";
import { invalidateCache } from "@/lib/db/cache";
import { createNotification, notifyMentions } from "@/lib/services/notification";
import { revalidatePath } from "next/cache";
import { ActivityStatus, ProposalStatus } from "@prisma/client";
import { deleteFromR2 } from "@/lib/utils/upload";
import { DEFAULT_ACTIVITY_LOCATION, parseBvId } from "@/lib/activities/constants";

const TYPE_LABEL: Record<string, string> = {
  MEETING: "例会", COURSE: "公开课", COMPETITION: "比赛", GENERAL: "活动",
};

/** 简单 slug 生成 */
function toSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, "").slice(0, 60);
}

/** 当 maxTeamSize 缩小时，自动移除超限队伍的成员（保留队长和最早加入的成员） */
async function trimTeamMembers(activityId: string, maxTeamSize: number) {
  const teams = await prisma.jamTeam.findMany({
    where: { activityId },
    include: {
      members: { orderBy: { joinedAt: "asc" } },
    },
  });

  for (const team of teams) {
    if (team.members.length <= maxTeamSize) continue;

    // 队长排第一位，然后按加入时间排序
    const sorted = team.members.sort((a, b) => {
      if (a.role === "LEADER") return -1;
      if (b.role === "LEADER") return 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const toRemove = sorted.slice(maxTeamSize);
    await prisma.jamTeamMember.deleteMany({
      where: { id: { in: toRemove.map((m) => m.id) } },
    });
  }
}

/** 如果标题为空，生成默认标题：YYYY年MM月DD日 + 活动类型 */
function defaultTitle(type: string, startTime?: string): string {
  if (!startTime) return `新${TYPE_LABEL[type] || "活动"}`;
  // 直接从 datetime-local 字符串解析，避免 new Date() 的时区歧义
  const [datePart] = startTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return `${year}年${month}月${day}日 ${TYPE_LABEL[type] || "活动"}`;
}

// ── 缓存失效辅助 ──────────────────────────────────────────────
async function invalidateActivityCaches(id?: string) {
  await Promise.all([
    invalidateCache("api:activities:"),
    invalidateCache("activities:list"),
    invalidateCache("home:activities"),
    invalidateCache("admin:activities:"),
    // 年报聚合依赖活动/参赛数据
    invalidateCache("history:"),
    ...(id ? [invalidateCache(`activity:detail:${id}`)] : []),
  ]);
  revalidatePath("/activities");
  revalidatePath("/admin/activities");
  revalidatePath("/history");
  if (id) revalidatePath(`/activities/${id}`);
}

// ── 创建活动 ──────────────────────────────────────────────────
export async function createActivity(formData: FormData) {
  await requireAdmin();

  const title       = (formData.get("title") as string || "").trim();
  const type        = (formData.get("type") as string || "GENERAL");
  const summary     = (formData.get("summary") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const location    = (formData.get("location") as string || "").trim() || DEFAULT_ACTIVITY_LOCATION;
  const meetingUrl  = (formData.get("meetingUrl") as string || "").trim();
  const coverImage   = (formData.get("coverImage") as string || "").trim();
  const startTime   = formData.get("startTime") as string;
  const endTime     = formData.get("endTime") as string;
  const maxStr      = (formData.get("maxParticipants") as string || "").trim();
  const regOpen     = formData.get("registrationOpen") === "on";
  const theme       = (formData.get("theme") as string || "").trim();
  const themeRevealedAt = (formData.get("themeRevealedAt") as string || "").trim();
  const maxTeamSizeStr = (formData.get("maxTeamSize") as string || "").trim();

  if (!startTime || !endTime) return { error: "请选择开始和结束时间" };
  if (new Date(startTime) >= new Date(endTime)) return { error: "开始时间必须早于结束时间" };

  // 标题默认：年月日 + 活动类型
  const finalTitle = title || defaultTitle(type, startTime);
  const slug = toSlug(finalTitle);
  const maxParticipants = maxStr ? parseInt(maxStr, 10) : undefined;
  const maxTeamSize = maxTeamSizeStr ? parseInt(maxTeamSizeStr, 10) : 6;

  const activity = await prisma.activity.create({
    data: {
      title: finalTitle,
      slug,
      type: type as any,
      summary: summary || undefined,
      description: description || undefined,
      location,
      meetingUrl: meetingUrl || undefined,
      coverImage: coverImage || undefined,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      maxParticipants,
      registrationOpen: regOpen,
      status: ActivityStatus.DRAFT,
      theme: theme || undefined,
      themeRevealedAt: themeRevealedAt ? new Date(themeRevealedAt) : undefined,
      maxTeamSize,
    },
  });

  // @mention 通知
  if (description) {
    const session = await auth();
    if (session?.user) {
      await notifyMentions(description, session.user.name || "未知用户", session.user.id, {
        type: "Activity",
        id: activity.id,
        title: finalTitle,
      });
    }
  }

  await invalidateActivityCaches();
  revalidatePath("/admin/activities");
  return { success: true, id: activity.id, slug: activity.slug };
}

// ── 更新活动 ──────────────────────────────────────────────────
export async function updateActivity(id: string, formData: FormData) {
  await requireAdmin();

  const title       = (formData.get("title") as string || "").trim();
  const type        = (formData.get("type") as string || "GENERAL");
  const summary     = (formData.get("summary") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const location    = (formData.get("location") as string || "").trim() || DEFAULT_ACTIVITY_LOCATION;
  const meetingUrl  = (formData.get("meetingUrl") as string || "").trim();
  const coverImage   = (formData.get("coverImage") as string || "").trim();
  const startTime   = formData.get("startTime") as string;
  const endTime     = formData.get("endTime") as string;
  const maxStr      = (formData.get("maxParticipants") as string || "").trim();
  const regOpen     = formData.get("registrationOpen") === "on";
  const status      = (formData.get("status") as string || "DRAFT");
  const theme       = (formData.get("theme") as string || "").trim();
  const themeRevealedAt = (formData.get("themeRevealedAt") as string || "").trim();
  const maxTeamSizeStr = (formData.get("maxTeamSize") as string || "").trim();

  if (!title) return { error: "请填写活动标题" };
  if (!startTime || !endTime) return { error: "请选择开始和结束时间" };
  if (new Date(startTime) >= new Date(endTime)) return { error: "开始时间必须早于结束时间" };

  const activity = await prisma.activity.findUnique({ where: { id }, select: { slug: true, maxTeamSize: true, coverImage: true } });
  const slug = activity ? activity.slug : toSlug(title);
  const maxParticipants = maxStr ? parseInt(maxStr, 10) : undefined;
  const newMaxTeamSize = maxTeamSizeStr ? parseInt(maxTeamSizeStr, 10) : 6;
  const oldMaxTeamSize = activity?.maxTeamSize ?? 6;

  await prisma.activity.update({
    where: { id },
    data: {
      title,
      slug,
      type: type as any,
      summary: summary || undefined,
      description: description || undefined,
      location,
      meetingUrl: meetingUrl || undefined,
      coverImage: coverImage || undefined,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      maxParticipants,
      registrationOpen: regOpen,
      status: status as ActivityStatus,
      theme: theme || undefined,
      themeRevealedAt: themeRevealedAt ? new Date(themeRevealedAt) : undefined,
      maxTeamSize: newMaxTeamSize,
    },
  });

  // @mention 通知
  if (description) {
    const session = await auth();
    if (session?.user) {
      await notifyMentions(description, session.user.name || "未知用户", session.user.id, {
        type: "Activity",
        id,
        title,
      });
    }
  }

  // 如果缩小了 maxTeamSize，自动踢出超限队伍的成员
  if (newMaxTeamSize < oldMaxTeamSize) {
    await trimTeamMembers(id, newMaxTeamSize);
  }

  // ── 清理 R2 旧封面（best-effort）──
  const oldCover = activity?.coverImage;
  if (oldCover && coverImage && oldCover !== coverImage) {
    deleteFromR2(oldCover).catch(() => {});
  }

  await invalidateActivityCaches(id);
  return { success: true };
}

// ── 删除活动 ──────────────────────────────────────────────────
export async function deleteActivity(id: string) {
  await requireAdmin();

  // 捕获旧封面 URL
  const activity = await prisma.activity.findUnique({ where: { id }, select: { coverImage: true } });
  const oldCover = activity?.coverImage;

  await prisma.activity.delete({ where: { id } });

  // ── 清理 R2 旧封面（best-effort）──
  if (oldCover) {
    deleteFromR2(oldCover).catch(() => {});
  }

  await invalidateActivityCaches(id);
  return { success: true };
}

// ── 更新活动状态 ──────────────────────────────────────────────
export async function updateActivityStatus(id: string, status: ActivityStatus) {
  await requireAdmin();
  await prisma.activity.update({ where: { id }, data: { status } });
  await invalidateActivityCaches(id);
}

// ── 通知管理员：活动有新动态 ─────────────────────────────────
async function notifyAdminsOfActivity(params: {
  activityId: string;
  userId: string;
  userName: string;
  title: string;
  activityName: string;
  notifType: string;
  relatedType: string;
}) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", member: { graduated: false } }, select: { id: true } });
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: params.notifType,
        title: `活动有新${params.activityName}`,
        content: `${params.userName} 提交了「${params.title}」`,
        relatedId: params.activityId,
        relatedType: params.relatedType,
      });
    }
  } catch (err) {
    console.error("[Notification] 通知管理员失败:", err);
  }
}

// ── 例会：提交分享/展示申请 ───────────────────────────────────
export async function submitProposal(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("请先登录");

  const userId = session.user.id;

  const activityId   = formData.get("activityId") as string;
  const title        = (formData.get("title") as string || "").trim();
  const description  = (formData.get("description") as string || "").trim();
  const proposalType = (formData.get("proposalType") as string || "SHARE");

  if (!activityId) return { error: "无效的活动" };
  if (!title)       return { error: "请填写标题" };

  // 检查是否已提交过申请（一人只能提交一份）
  const existing = await prisma.meetingProposal.findFirst({
    where: { activityId, userId },
  });
  if (existing) {
    return { error: "你已提交过申请，不能重复提交" };
  }

  const proposal = await prisma.meetingProposal.create({
    data: {
      activityId,
      userId,
      title,
      description: description || undefined,
      proposalType: proposalType as any,
    },
  });

  // ── 通知管理员：有新申请 ──
  await notifyAdminsOfActivity({
    activityId,
    userId,
    userName: session.user.name || "未知用户",
    title,
    activityName: proposalType === "SHARE" ? "分享申请" : "展示申请",
    notifType: "ACTIVITY_PROPOSAL",
    relatedType: "Activity",
  });

  revalidatePath(`/activities/${activityId}`);
  return { success: true };
}

// ── 删除议程项 ────────────────────────────────────────────────
export async function deleteProposal(formData: FormData) {
  await requireAdmin();
  const proposalId = formData.get("proposalId") as string;
  if (!proposalId) return { error: "缺少申请 ID" };

  const proposal = await prisma.meetingProposal.findUnique({
    where: { id: proposalId },
    select: { activityId: true },
  });
  if (!proposal) return { error: "申请不存在" };

  await prisma.meetingProposal.delete({ where: { id: proposalId } });
  revalidatePath(`/activities/${proposal.activityId}`);
  return { success: true };
}

// ── 审核：分享/展示申请 ──────────────────────────────────────
export async function reviewProposal(id: string, status: ProposalStatus, adminNote?: string) {
  await requireAdmin();
  const proposal = await prisma.meetingProposal.findUnique({
    where: { id },
    select: { activityId: true, userId: true, title: true, proposalType: true },
  });
  if (!proposal) throw new Error("申请不存在");

  await prisma.meetingProposal.update({
    where: { id },
    data: { status, adminNote: adminNote || undefined },
  });

  // ── 通知申请人审核结果 ──
  const approved = status === ProposalStatus.APPROVED;
  const typeLabel = proposal.proposalType === "SHOWCASE" ? "展示" : "分享";
  await createNotification({
    userId: proposal.userId,
    type: "PROPOSAL_REVIEW",
    title: approved ? `${typeLabel}申请通过 ✅` : `${typeLabel}申请未通过 ❌`,
    content: approved
      ? `你在例会中的${typeLabel}申请「${proposal.title}」已通过审核`
      : `你的${typeLabel}申请「${proposal.title}」未通过审核${adminNote ? `：${adminNote}` : ""}`,
    relatedId: proposal.activityId,
    relatedType: "Activity",
  });

  revalidatePath(`/activities/${proposal.activityId}`);
  revalidatePath(`/admin/activities/${proposal.activityId}/edit`);
}

// ── 例会：整表保存分享条目（主讲 + 标题 + BV）────────────────
export async function saveMeetingTalks(
  activityId: string,
  talks: Array<{ speaker: string; title: string; bvId?: string; userId?: string | null }>,
) {
  await requireAdmin();
  if (!activityId) return { error: "无效的活动" };

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, type: true },
  });
  if (!activity) return { error: "活动不存在" };

  const rawUserIds = [
    ...new Set(
      talks
        .map((t) => (t.userId || "").trim())
        .filter(Boolean),
    ),
  ];
  const validUserIds = new Set<string>();
  if (rawUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: rawUserIds } },
      select: { id: true },
    });
    for (const u of users) validUserIds.add(u.id);
  }

  const normalized = talks
    .map((t, i) => {
      const userId = (t.userId || "").trim();
      return {
        speaker: (t.speaker || "").trim(),
        title: (t.title || "").trim(),
        bvId: parseBvId(t.bvId) || null,
        userId: userId && validUserIds.has(userId) ? userId : null,
        sortOrder: i,
      };
    })
    .filter((t) => t.speaker && t.title);

  for (const t of talks) {
    const speaker = (t.speaker || "").trim();
    const title = (t.title || "").trim();
    if ((speaker && !title) || (!speaker && title)) {
      return { error: "每条分享需同时填写主讲与标题" };
    }
    if (t.bvId && !parseBvId(t.bvId)) {
      return { error: `无法识别 BV 号：${t.bvId}` };
    }
  }

  await prisma.$transaction([
    prisma.meetingTalk.deleteMany({ where: { activityId } }),
    ...(normalized.length
      ? [
          prisma.meetingTalk.createMany({
            data: normalized.map((t) => ({
              activityId,
              speaker: t.speaker,
              title: t.title,
              bvId: t.bvId,
              userId: t.userId,
              sortOrder: t.sortOrder,
            })),
          }),
        ]
      : []),
  ]);

  const saved = await prisma.meetingTalk.findMany({
    where: { activityId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      speaker: true,
      title: true,
      bvId: true,
      sortOrder: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          member: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  await invalidateActivityCaches(activityId);
  return { success: true, talks: saved };
}
