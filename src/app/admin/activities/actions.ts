"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { auth } from "@/lib/auth/auth";
import { invalidateCache } from "@/lib/db/cache";
import { createNotification, notifyMentions } from "@/lib/services/notification";
import { revalidatePath } from "next/cache";
import { ActivityStatus, CourseParticipantRole, Prisma, ProposalStatus, ProposalType } from "@prisma/client";
import { deleteFromR2, deleteManyFromR2 } from "@/lib/utils/upload";
import { isCourseAttachmentUrl, parseCourseMaterials } from "@/lib/activities/course-materials";
import { withoutCourseMediaReferences } from "@/lib/activities/course-media";
import { parseBvId } from "@/lib/activities/constants";
import { parseActivityDateTime } from "@/lib/activities/datetime";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import { showcaseKey } from "@/lib/activities/showcase";
import { canSubmitActivityTalk } from "@/lib/activities/capabilities";

const TYPE_LABEL: Record<string, string> = {
  MEETING: "例会", COURSE: "策划公开课", ENGINE_COURSE: "引擎教学公开课", COMPETITION: "Game Jam", GENERAL: "大事件",
};

/** 简单 slug 生成 */
function toSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, "").slice(0, 60);
}

function readFocus(formData: FormData): { x: number; y: number } | { error: string } {
  const x = Number(formData.get("courseCoverFocusX") ?? 50);
  const y = Number(formData.get("courseCoverFocusY") ?? 50);
  if (!Number.isInteger(x) || x < 0 || x > 100 || !Number.isInteger(y) || y < 0 || y > 100) return { error: "封面焦点无效" };
  return { x, y };
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

function readSchedule(formData: FormData):
  | { error: string }
  | { timePending: true; courseHasClock: false; startTime: null; endTime: null; startRaw?: undefined }
  | { timePending: false; courseHasClock: boolean; startTime: Date; endTime: Date; startRaw: string } {
  if (formData.get("timePending") === "on") {
    return { timePending: true, courseHasClock: false, startTime: null, endTime: null };
  }
  const startTime = ((formData.get("startTime") as string) || "").trim();
  const endTime = ((formData.get("endTime") as string) || "").trim();
  if (!startTime || !endTime) return { error: "请选择开始和结束日期，或改为待定" };
  const courseHasClock = formData.get("courseHasClock") === "on";
  const startClock = String(formData.get("startClock") || "");
  const endClock = String(formData.get("endClock") || "");
  if (courseHasClock && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startClock) || (endClock && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endClock)))) {
    return { error: "请填写有效的开始时间，结束时间可以留空" };
  }
  const parsedStart = parseActivityDateTime(courseHasClock ? `${startTime}T${startClock}` : startTime, "start");
  const parsedEnd = parseActivityDateTime(courseHasClock && endClock ? `${endTime}T${endClock}` : endTime, "end");
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime()) || parsedStart >= parsedEnd) {
    return { error: "开始日期必须早于或等于结束日期" };
  }
  return { timePending: false, courseHasClock, startTime: parsedStart, endTime: parsedEnd, startRaw: startTime };
}

/** 如果标题为空，生成默认标题：YYYY年MM月DD日 + 活动类型 */
function defaultTitle(type: string, startTime?: string): string {
  if (!startTime) return `新${TYPE_LABEL[type] || "活动"}`;
  // 日期字符串按北京时间的日历日解析，避免 new Date() 的时区歧义
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
  if (id) {
    revalidatePath(`/activities/${id}`);
    revalidatePath(`/admin/activities/${id}/edit`);
  }
}

// ── 创建活动 ──────────────────────────────────────────────────
export async function createActivity(formData: FormData) {
  await requireAdmin();

  const title       = (formData.get("title") as string || "").trim();
  const type        = (formData.get("type") as string || "GENERAL");
  const summary     = (formData.get("summary") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const location    = (formData.get("location") as string || "").trim();
  const meetingUrl  = (formData.get("meetingUrl") as string || "").trim();
  const coverImage   = (formData.get("coverImage") as string || "").trim();
  const maxStr      = (formData.get("maxParticipants") as string || "").trim();
  const talkSubmissionOpen = formData.get("talkSubmissionOpen") === "on";
  const publish     = formData.get("status") === "PUBLISHED";
  const theme       = (formData.get("theme") as string || "").trim();
  const themeRevealedAt = (formData.get("themeRevealedAt") as string || "").trim();
  const maxTeamSizeStr = (formData.get("maxTeamSize") as string || "").trim();
  const schedule = readSchedule(formData);
  if ("error" in schedule) return schedule;
  const focus = readFocus(formData);
  if ("error" in focus) return focus;

  // 标题默认：年月日 + 活动类型；待定则只用类型
  const finalTitle = title || defaultTitle(type, schedule.startRaw);
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
      location: location || null,
      meetingUrl: meetingUrl || undefined,
      coverImage: coverImage || undefined,
      timePending: schedule.timePending,
      courseHasClock: schedule.courseHasClock,
      courseCoverFocusX: focus.x,
      courseCoverFocusY: focus.y,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      maxParticipants,
      registrationOpen: false,
      talkSubmissionOpen,
      status: publish ? ActivityStatus.PUBLISHED : ActivityStatus.DRAFT,
      theme: theme || undefined,
      themeRevealedAt: themeRevealedAt ? parseActivityDateTime(themeRevealedAt, "start") : undefined,
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
  const location    = (formData.get("location") as string || "").trim();
  const meetingUrl  = (formData.get("meetingUrl") as string || "").trim();
  const coverImage   = (formData.get("coverImage") as string || "").trim();
  const maxStr      = (formData.get("maxParticipants") as string || "").trim();
  const talkSubmissionOpen = formData.get("talkSubmissionOpen") === "on";
  const status      = (formData.get("status") as string || "DRAFT");
  const theme       = (formData.get("theme") as string || "").trim();
  const themeRevealedAt = (formData.get("themeRevealedAt") as string || "").trim();
  const maxTeamSizeStr = (formData.get("maxTeamSize") as string || "").trim();
  const schedule = readSchedule(formData);
  const focus = readFocus(formData);

  if (!title) return { error: "请填写活动标题" };
  if ("error" in schedule) return schedule;
  if ("error" in focus) return focus;

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
      location: location || null,
      meetingUrl: meetingUrl || undefined,
      coverImage: coverImage || undefined,
      timePending: schedule.timePending,
      courseHasClock: schedule.courseHasClock,
      courseCoverFocusX: focus.x,
      courseCoverFocusY: focus.y,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      maxParticipants,
      registrationOpen: false,
      talkSubmissionOpen,
      status: status as ActivityStatus,
      theme: theme || undefined,
      themeRevealedAt: themeRevealedAt ? parseActivityDateTime(themeRevealedAt, "start") : undefined,
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

  const talksRaw = formData.get("talksJson");
  if (typeof talksRaw === "string") {
    let talks: unknown;
    try {
      talks = JSON.parse(talksRaw);
    } catch {
      return { error: "议程数据无效" };
    }
    if (!Array.isArray(talks)) return { error: "议程数据无效" };
    const talkResult = await saveMeetingTalks(id, talks);
    if (talkResult && "error" in talkResult && talkResult.error) return { error: talkResult.error };
  }

  if (type === "COURSE" || type === "ENGINE_COURSE") {
    const courseRaw = formData.get("courseJson");
    if (typeof courseRaw === "string") {
      let course: unknown;
      try {
        course = JSON.parse(courseRaw);
      } catch {
        return { error: "公开课资料无效" };
      }
      const courseResult = await saveCourseMaterials(id, course);
      if (courseResult && "error" in courseResult && courseResult.error) return { error: courseResult.error };
    }
  }

  const showcaseRaw = formData.get("showcaseJson");
  if (typeof showcaseRaw === "string" && type === "GENERAL") {
    let showcase: unknown;
    try {
      showcase = JSON.parse(showcaseRaw);
    } catch {
      return { error: "海报数据无效" };
    }
    const { saveActivityShowcase } = await import("./showcase-actions");
    const showcaseResult = await saveActivityShowcase(id, showcase);
    if (showcaseResult && "error" in showcaseResult && showcaseResult.error) {
      return { error: showcaseResult.error };
    }
  }

  await invalidateActivityCaches(id);
  return { success: true };
}

// ── 删除活动 ──────────────────────────────────────────────────
export async function deleteActivity(id: string) {
  await requireAdmin();

  // 捕获旧封面 URL
  const activity = await prisma.activity.findUnique({
    where: { id },
    select: { coverImage: true, courseAttachments: { select: { url: true } }, courseClasses: { select: { scheduleImage: true, coverImage: true, showcase: { select: { imageUrl: true } } } } },
  });
  const oldCover = activity?.coverImage;
  const attachmentUrls = activity?.courseAttachments.map((file) => file.url) || [];
  const programUrls = activity?.courseClasses.flatMap((item) => [item.coverImage, item.scheduleImage, ...item.showcase.map((work) => work.imageUrl)]) || [];

  await prisma.$transaction([
    prisma.siteSetting.deleteMany({ where: { key: showcaseKey(id) } }),
    prisma.activity.delete({ where: { id } }),
  ]);

  // ── 清理 R2 旧封面（best-effort）──
  const disposable = await withoutCourseMediaReferences([oldCover, ...attachmentUrls, ...programUrls]);
  if (disposable.length) deleteManyFromR2(disposable).catch(() => {});

  await invalidateActivityCaches(id);
  return { success: true };
}

// ── 更新活动状态 ──────────────────────────────────────────────
export async function updateActivityStatus(id: string, status: ActivityStatus) {
  await requireAdmin();
  await prisma.activity.update({ where: { id }, data: { status } });
  await invalidateActivityCaches(id);
}

async function saveCourseMaterials(activityId: string, raw: unknown) {
  const parsed = parseCourseMaterials(raw);
  if ("error" in parsed) return parsed;
  const memberIds = parsed.participants.flatMap((item) => item.memberId ? [item.memberId] : []);
  const members = memberIds.length
    ? await prisma.clubMember.findMany({ where: { id: { in: memberIds } }, select: { id: true } })
    : [];
  if (members.length !== memberIds.length) return { error: "有成员不存在或已删除" };

  const publicBase = process.env.R2_PUBLIC_URL || "";
  for (const file of parsed.attachments) {
    if (!isCourseAttachmentUrl(file.url, publicBase)) return { error: "附件地址无效" };
  }

  const previous = await prisma.courseAttachment.findMany({ where: { activityId }, select: { url: true } });
  await prisma.$transaction([
    prisma.courseParticipant.deleteMany({ where: { activityId } }),
    prisma.courseAttachment.deleteMany({ where: { activityId } }),
    ...(parsed.participants.length
      ? [prisma.courseParticipant.createMany({
          data: parsed.participants.map((item, index) => ({
            activityId,
            memberId: item.memberId,
            externalName: item.externalName,
            role: item.role === "INSTRUCTOR" ? CourseParticipantRole.INSTRUCTOR : CourseParticipantRole.STUDENT,
            sortOrder: index,
          })),
        })]
      : []),
    ...(parsed.attachments.length
      ? [prisma.courseAttachment.createMany({
          data: parsed.attachments.map((file, index) => ({
            activityId,
            name: file.name,
            url: file.url,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sortOrder: index,
          })),
        })]
      : []),
  ]);

  const kept = new Set(parsed.attachments.map((file) => file.url));
  const removed = previous.map((file) => file.url).filter((url) => !kept.has(url));
  if (removed.length) {
    const disposable = await withoutCourseMediaReferences(removed);
    if (disposable.length) deleteManyFromR2(disposable).catch(() => {});
  }
  return { success: true as const };
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

// ── 活动：提交分享/展示申请 ───────────────────────────────────
export async function submitProposal(formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user) return { error: t(lang, "meeting.errLoginFirst") };

  const userId = session.user.id;

  const activityId   = formData.get("activityId") as string;
  const title        = (formData.get("title") as string || "").trim();
  const description  = (formData.get("description") as string || "").trim();
  const imageUrlRaw   = (formData.get("imageUrl") as string || "").trim();
  const imageUrl = imageUrlRaw && /^(https?:\/\/|\/)/.test(imageUrlRaw) ? imageUrlRaw.slice(0, 2048) : null;
  const proposalType = (formData.get("proposalType") as string || "SHARE");
  if (proposalType !== "SHARE" && proposalType !== "SHOWCASE") {
    return { error: t(lang, "meeting.errInvalidType") };
  }

  if (!activityId) return { error: t(lang, "meeting.errInvalidActivity") };
  if (!title)       return { error: t(lang, "meeting.errTitleRequired") };
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { talkSubmissionOpen: true, status: true, endTime: true, timePending: true },
  });
  if (!activity || !canSubmitActivityTalk(activity)) {
    return { error: t(lang, "meeting.errTalkClosed") };
  }

  const isAdmin = session.user.role === "ADMIN";
  try {
    await prisma.$transaction(async (tx) => {
      const proposal = await tx.meetingProposal.create({
        data: {
          activityId,
          userId,
          title,
          description: description || undefined,
          imageUrl: imageUrl || undefined,
          proposalType: proposalType as ProposalType,
          status: isAdmin ? ProposalStatus.APPROVED : ProposalStatus.PENDING,
        },
      });
      if (isAdmin) {
        const agenda = await ensureProposalAgendaTalk(tx, proposal.id, true);
        if ("error" in agenda) throw new Error(agenda.error);
      }
    }, { timeout: 20_000 });
  } catch (error) {
    console.error("[agenda] 提交失败:", error);
    return { error: t(lang, "meeting.errSubmitFailed") };
  }

  // ── 通知管理员：有新申请 ──
  if (!isAdmin) {
    await notifyAdminsOfActivity({
      activityId,
      userId,
      userName: session.user.name || "未知用户",
      title,
      activityName: proposalType === "SHARE" ? "分享申请" : "展示申请",
      notifType: "ACTIVITY_PROPOSAL",
      relatedType: "Activity",
    });
  }

  await invalidateActivityCaches(activityId);
  return { success: true, published: isAdmin };
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

  await prisma.$transaction(
    async (tx) => {
      await tx.meetingTalk.deleteMany({ where: { sourceProposalId: proposalId } });
      await tx.meetingProposal.delete({ where: { id: proposalId } });
    },
    { timeout: 20_000 },
  );
  await invalidateActivityCaches(proposal.activityId);
  return { success: true };
}

/**
 * Ensure an approved proposal has exactly one formal agenda item.
 * The unique sourceProposalId relation is the idempotency boundary; titles are
 * deliberately not used because different people may submit the same topic.
 */
async function ensureProposalAgendaTalk(
  tx: Prisma.TransactionClient,
  proposalId: string,
  requireApproved: boolean,
) {
  const proposal = await tx.meetingProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      activityId: true,
      userId: true,
      title: true,
      description: true,
      imageUrl: true,
      proposalType: true,
      status: true,
      user: { select: { name: true, member: { select: { displayName: true } } } },
    },
  });
  if (!proposal) return { error: "申请不存在" };
  if (requireApproved && proposal.status !== ProposalStatus.APPROVED) {
    return { error: "仅已通过的申请可以列入议程" };
  }

  const title = proposal.title.trim();
  if (!title) return { error: "申请标题为空" };

  const existing = await tx.meetingTalk.findUnique({
    where: { sourceProposalId: proposal.id },
    select: { id: true },
  });
  if (existing) return { success: true as const, already: true, activityId: proposal.activityId };

  const speaker =
    proposal.user.member?.displayName?.trim() ||
    proposal.user.name?.trim() ||
    "主讲";
  const maxSort = await tx.meetingTalk.aggregate({
    where: { activityId: proposal.activityId },
    _max: { sortOrder: true },
  });

  await tx.meetingTalk.create({
    data: {
      activityId: proposal.activityId,
      sourceProposalId: proposal.id,
      speaker,
      title,
      description: proposal.description,
      imageUrl: proposal.imageUrl,
      talkType: proposal.proposalType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
      userId: proposal.userId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      speakers: {
        create: [{ name: speaker, userId: proposal.userId, sortOrder: 0 }],
      },
    },
  });

  return { success: true as const, already: false, activityId: proposal.activityId };
}

export async function promoteProposalToAgenda(proposalId: string) {
  await requireAdmin();
  if (!proposalId) return { error: "缺少申请 ID" };
  const result = await prisma.$transaction((tx) =>
    ensureProposalAgendaTalk(tx, proposalId, true),
  );
  if (result && "activityId" in result && result.activityId) {
    await invalidateActivityCaches(result.activityId);
  }
  return result;
}

// ── 审核：分享/展示申请 ──────────────────────────────────────
export async function reviewProposal(id: string, status: ProposalStatus, adminNote?: string) {
  const session = await requireAdmin();
  const lang = await getLang();
  if (status !== ProposalStatus.APPROVED && status !== ProposalStatus.REJECTED) {
    return { error: t(lang, "meeting.errInvalidReview") };
  }
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.meetingProposal.findUnique({
      where: { id },
      select: { activityId: true, userId: true, title: true, proposalType: true },
    });
    if (!current) return { error: t(lang, "meeting.errProposalMissing") };

    if (status === ProposalStatus.APPROVED) {
      const agenda = await ensureProposalAgendaTalk(tx, id, false);
      if ("error" in agenda) throw new Error(agenda.error);
    } else {
      // Keep the review status and the public agenda structurally consistent.
      // Only delete the row explicitly owned by this proposal; manually-created
      // agenda items (including same-title items) are never touched.
      await tx.meetingTalk.deleteMany({ where: { sourceProposalId: id } });
    }

    await tx.meetingProposal.update({
      where: { id },
      data: { status, adminNote: status === ProposalStatus.REJECTED ? adminNote?.trim() || null : null },
    });
    return current;
  }, { timeout: 20_000 }).catch((error: unknown) => {
    console.error("[agenda] 审核失败:", error);
    return { error: t(lang, "meeting.errReviewFailed") };
  });
  if ("error" in result) return result;
  const proposal = result;

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_ACTION",
      userId: session.user.id,
      targetType: "MeetingProposal",
      targetId: id,
      metadata: { status },
      ipAddress: "server-action",
    },
  }).catch((err) => console.error("[AuditLog] 分享申请审核写入失败:", err));

  // ── 通知申请人审核结果 ──
  const approved = status === ProposalStatus.APPROVED;
  const typeLabel = proposal.proposalType === "SHOWCASE" ? "展示" : "分享";
  await createNotification({
    userId: proposal.userId,
    type: "PROPOSAL_REVIEW",
    title: approved ? `${typeLabel}申请通过 ✅` : `${typeLabel}申请未通过 ❌`,
    content: approved
      ? `你在活动中的${typeLabel}申请「${proposal.title}」已通过审核，已列入议程`
      : `你的${typeLabel}申请「${proposal.title}」未通过审核${adminNote ? `：${adminNote}` : ""}`,
    relatedId: proposal.activityId,
    relatedType: "Activity",
  }).catch((error) => console.error("[agenda] 审核通知发送失败:", error));

  await invalidateActivityCaches(proposal.activityId);
  return { success: true as const };
}

// ── 活动：整表保存分享条目（主讲 + 标题 + BV）────────────────
export async function saveMeetingTalks(
  activityId: string,
  talks: Array<{
    id?: string;
    sourceProposalId?: string | null;
    speaker: string;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    talkType?: "SHARE" | "SHOWCASE";
    bvId?: string;
    userId?: string | null;
    speakers?: Array<{ name: string; userId?: string | null }>;
  }>,
) {
  await requireAdmin();
  if (!activityId) return { error: "无效的活动" };

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true },
  });
  if (!activity) return { error: "活动不存在" };

  const rawUserIds = [
    ...new Set(
      talks
        .flatMap((t) => [t.userId, ...(t.speakers || []).map((speaker) => speaker.userId)])
        .map((userId) => (userId || "").trim())
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

  const rawSourceProposalIds = [
    ...new Set(talks.map((talk) => (talk.sourceProposalId || "").trim()).filter(Boolean)),
  ];
  const validSourceProposalIds = new Set<string>();
  if (rawSourceProposalIds.length > 0) {
    const proposals = await prisma.meetingProposal.findMany({
      where: {
        id: { in: rawSourceProposalIds },
        activityId,
        status: ProposalStatus.APPROVED,
      },
      select: { id: true },
    });
    proposals.forEach((proposal) => validSourceProposalIds.add(proposal.id));
    if (validSourceProposalIds.size !== rawSourceProposalIds.length) {
      return { error: "议程关联的报名记录无效或尚未通过审核" };
    }
  }

  const normalized = talks
    .map((t, i) => {
      const seen = new Set<string>();
      const speakers = (t.speakers?.length ? t.speakers : [{ name: t.speaker, userId: t.userId }])
        .map((speaker) => {
          const name = (speaker.name || "").trim();
          const rawUserId = (speaker.userId || "").trim();
          const userId = rawUserId && validUserIds.has(rawUserId) ? rawUserId : null;
          return { name, userId };
        })
        .filter((speaker) => {
          if (!speaker.name) return false;
          const key = speaker.userId ? `user:${speaker.userId}` : `name:${speaker.name.toLocaleLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const first = speakers[0];
      const sourceProposalId = (t.sourceProposalId || "").trim() || null;
      const existingId = (t.id || "").trim();
      return {
        id: existingId || undefined,
        speaker: first?.name || "",
        title: (t.title || "").trim(),
        description: (t.description || "").trim() || null,
        imageUrl: (t.imageUrl || "").trim() || null,
        talkType: t.talkType === "SHOWCASE" ? ProposalType.SHOWCASE : ProposalType.SHARE,
        bvId: parseBvId(t.bvId) || null,
        userId: first?.userId || null,
        sourceProposalId: sourceProposalId && validSourceProposalIds.has(sourceProposalId) ? sourceProposalId : null,
        speakers,
        sortOrder: i,
      };
    })
    .filter((t) => t.speakers.length > 0 && t.title);

  const sourceIds = normalized.flatMap((talk) => talk.sourceProposalId ? [talk.sourceProposalId] : []);
  if (new Set(sourceIds).size !== sourceIds.length) {
    return { error: "同一份报名不能关联到多条议程" };
  }

  for (const t of talks) {
    const title = (t.title || "").trim();
    const hasSpeakers = (t.speakers?.length ? t.speakers : [{ name: t.speaker }])
      .some((speaker) => (speaker.name || "").trim());
    if ((hasSpeakers && !title) || (!hasSpeakers && !!title)) {
      return { error: "每条议程需同时填写至少一位主讲人与内容" };
    }
    if (t.bvId && !parseBvId(t.bvId)) {
      return { error: `无法识别 BV 号：${t.bvId}` };
    }
  }

  // 差异化保存：按 id/关联申请匹配已有议程项，字段级比对后只增删改差异行——
  // 无变化的行零语句跳过。此前整表删除重建会让每行拿到新 id：成员正打开的
  // "修改我的议程"面板失效，并静默覆盖管理员视图之外的他人修改。
  // 20s 超时沿用 P2028 修复；慢链路下逐行语句较多，字段级跳过是关键。
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.meetingTalk.findMany({
        where: { activityId },
        include: { speakers: { orderBy: { sortOrder: "asc" } } },
      });
      const existingById = new Map(existing.map((row) => [row.id, row]));
      const speakersKey = (list: Array<{ name: string; userId: string | null }>) =>
        JSON.stringify(list.map((s) => [s.name, s.userId ?? null]));

      const matched = new Set<string>();
      const toUpdate: Array<{ row: (typeof normalized)[number]; id: string }> = [];
      const toCreate: Array<(typeof normalized)[number]> = [];
      for (const row of normalized) {
        const hitById =
          row.id && existingById.has(row.id) && !matched.has(row.id) ? row.id : null;
        const hitBySource =
          row.sourceProposalId && !hitById
            ? (existing.find(
                (e) => e.sourceProposalId === row.sourceProposalId && !matched.has(e.id),
              )?.id ?? null)
            : null;
        const hit = hitById ?? hitBySource;
        if (hit) {
          matched.add(hit);
          const cur = existingById.get(hit)!;
          const unchanged =
            cur.speaker === row.speaker &&
            cur.title === row.title &&
            (cur.description ?? null) === row.description &&
            (cur.imageUrl ?? null) === row.imageUrl &&
            cur.talkType === row.talkType &&
            (cur.bvId ?? null) === row.bvId &&
            (cur.userId ?? null) === row.userId &&
            (cur.sourceProposalId ?? null) === (row.sourceProposalId ?? null) &&
            cur.sortOrder === row.sortOrder &&
            speakersKey(cur.speakers) === speakersKey(row.speakers);
          if (!unchanged) toUpdate.push({ row, id: hit });
        } else {
          toCreate.push(row);
        }
      }

      // 删除本轮不再存在的行（speaker 行随 onDelete: Cascade 一并移除）
      const staleIds = existing.filter((row) => !matched.has(row.id)).map((row) => row.id);
      if (staleIds.length > 0) {
        await tx.meetingTalk.deleteMany({ where: { id: { in: staleIds } } });
      }

      for (const { row, id } of toUpdate) {
        const cur = existingById.get(id)!;
        const sourceChanging = (cur.sourceProposalId ?? null) !== (row.sourceProposalId ?? null);
        // 两阶段防撞唯一约束：先置空再赋新值，仅在实际换关联时发生
        await tx.meetingTalk.update({
          where: { id },
          data: {
            speaker: row.speaker,
            title: row.title,
            description: row.description,
            imageUrl: row.imageUrl,
            talkType: row.talkType,
            bvId: row.bvId,
            userId: row.userId,
            sourceProposalId: sourceChanging ? null : row.sourceProposalId ?? null,
            sortOrder: row.sortOrder,
          },
        });
        if (speakersKey(cur.speakers) !== speakersKey(row.speakers)) {
          await tx.meetingTalkSpeaker.deleteMany({ where: { talkId: id } });
          if (row.speakers.length > 0) {
            await tx.meetingTalkSpeaker.createMany({
              data: row.speakers.map((speaker, index) => ({
                talkId: id,
                name: speaker.name,
                userId: speaker.userId,
                sortOrder: index,
              })),
            });
          }
        }
        if (sourceChanging && row.sourceProposalId) {
          await tx.meetingTalk.update({
            where: { id },
            data: { sourceProposalId: row.sourceProposalId },
          });
        }
      }

      if (toCreate.length > 0) {
        const created = await tx.meetingTalk.createManyAndReturn({
          data: toCreate.map((talk) => ({
            activityId,
            speaker: talk.speaker,
            title: talk.title,
            description: talk.description,
            imageUrl: talk.imageUrl,
            talkType: talk.talkType,
            bvId: talk.bvId,
            userId: talk.userId,
            sourceProposalId: talk.sourceProposalId,
            sortOrder: talk.sortOrder,
          })),
        });

        const bySort = new Map(toCreate.map((talk) => [talk.sortOrder, talk]));
        const speakerRows = created.flatMap((row) => {
          const talk = bySort.get(row.sortOrder);
          if (!talk) return [];
          return talk.speakers.map((speaker, index) => ({
            talkId: row.id,
            name: speaker.name,
            userId: speaker.userId,
            sortOrder: index,
          }));
        });
        if (speakerRows.length > 0) {
          await tx.meetingTalkSpeaker.createMany({ data: speakerRows });
        }
      }
    },
    { timeout: 20_000 },
  );

  const saved = await prisma.meetingTalk.findMany({
    where: { activityId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      speaker: true,
      title: true,
      description: true,
      imageUrl: true,
      talkType: true,
      bvId: true,
      sortOrder: true,
      userId: true,
      sourceProposalId: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          member: { select: { id: true, displayName: true } },
        },
      },
      speakers: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              member: { select: { id: true, displayName: true } },
            },
          },
        },
      },
    },
  });

  await invalidateActivityCaches(activityId);
  return { success: true, talks: saved };
}

// ── 上传者本人：修改自己关联的议程卡片 ─────────────────────
export async function updateMeetingTalkOwn(
  talkId: string,
  patch: {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    talkType?: "SHARE" | "SHOWCASE";
    bvId?: string;
  },
) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user) return { error: t(lang, "meeting.errLoginFirst") };
  if (!talkId) return { error: t(lang, "meetingTalks.errTalkMissing") };

  const talk = await prisma.meetingTalk.findUnique({
    where: { id: talkId },
    select: {
      id: true,
      activityId: true,
      userId: true,
      speakers: { select: { userId: true } },
      activity: {
        select: { talkSubmissionOpen: true, status: true, endTime: true, timePending: true },
      },
    },
  });
  if (!talk) return { error: t(lang, "meetingTalks.errTalkMissing") };

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = talk.userId === session.user.id
    || talk.speakers.some((speaker) => speaker.userId && speaker.userId === session.user.id);
  if (!isAdmin && !isOwner) return { error: t(lang, "meetingTalks.errNotAllowed") };
  if (!isAdmin && !canSubmitActivityTalk(talk.activity)) {
    return { error: t(lang, "meeting.errTalkClosed") };
  }

  const title = (patch.title || "").trim();
  if (!title) return { error: t(lang, "meeting.errTitleRequired") };
  if (patch.bvId && !parseBvId(patch.bvId)) {
    return { error: `${t(lang, "meetingTalks.errBadBv")}: ${patch.bvId}` };
  }
  const imageUrlRaw = (patch.imageUrl || "").trim();
  const imageUrl = imageUrlRaw && /^(https?:\/\/|\/)/.test(imageUrlRaw) ? imageUrlRaw.slice(0, 2048) : null;

  await prisma.meetingTalk.update({
    where: { id: talkId },
    data: {
      title,
      description: (patch.description || "").trim() || null,
      imageUrl,
      ...(patch.talkType ? { talkType: patch.talkType === "SHOWCASE" ? ProposalType.SHOWCASE : ProposalType.SHARE } : {}),
      bvId: parseBvId(patch.bvId) || null,
    },
  });

  await invalidateActivityCaches(talk.activityId);
  return { success: true as const };
}
