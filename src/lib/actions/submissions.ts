"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { deleteFromR2, deleteManyFromR2 } from "@/lib/utils/upload";
import { notifyNewProject } from "@/lib/services/notification";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import {
  JAM_ADMIN_ENTRY_TOPIC,
  isValidJamTrophy,
  normalizeJamScreenshots,
  parseJamSubmissionMeta,
  type JamCreatorItem,
  type JamTrophyType,
} from "@/lib/activities/jam-entries";

// ============================================================
// 辅助函数
// ============================================================

async function createProjectFromSubmission(data: {
  title: string;
  description: string;
  coverImage?: string;
  screenshots: string[];
  creators: { name: string; roles: string[]; userId?: string; memberId?: string }[];
  links: { label: string; url: string }[];
  tagIds: string[];
  customTags: string[];
  projectType: string;
  developYear: number;
  submitterId: string;
  existingProjectId?: string;
}): Promise<string> {
  const {
    title, description, coverImage, screenshots, creators,
    links, tagIds, customTags, projectType, developYear,
    submitterId, existingProjectId,
  } = data;

  const slugBase = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, "")
    .slice(0, 60);
  let slug = slugBase || `jam-${Date.now()}`;
  const slugExists = await prisma.project.findUnique({ where: { slug } });
  if (slugExists) slug = `${slug}-${Date.now()}`;

  const customTagRecords: { id: string }[] = [];
  for (const name of customTags) {
    const tagSlug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, "")
      .slice(0, 60);
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: tagSlug || `tag-${Date.now()}`, color: "#88C232" },
      select: { id: true },
    });
    customTagRecords.push(tag);
  }

  const allTagIds = [...tagIds, ...customTagRecords.map((t) => t.id)];

  if (existingProjectId) {
    await prisma.project.update({
      where: { id: existingProjectId },
      data: {
        title, description,
        type: projectType as any,
        developYear,
        coverImage: coverImage || undefined,
        slug,
      },
    });
    return existingProjectId;
  }

  const project = await prisma.project.create({
    data: {
      title, description, slug,
      type: projectType as any,
      developYear,
      coverImage: coverImage || undefined,
      status: "PENDING",
      submitterId,
      submittedAt: new Date(),
      links: links.length > 0
        ? { create: links.map((l, i) => ({ label: l.label, url: l.url, sortOrder: i })) }
        : undefined,
      members: creators.length > 0
        ? {
            create: creators.map((c) => ({
              memberId: c.memberId || undefined,
              userId: c.userId || undefined,
              externalName: !c.memberId && !c.userId ? c.name : undefined,
              roles: c.roles && c.roles.length > 0 ? c.roles : ["制作"],
            })),
          }
        : undefined,
      images: screenshots.length > 0
        ? { create: screenshots.map((url, i) => ({ url, sortOrder: i })) }
        : undefined,
      tags: allTagIds.length > 0
        ? { create: allTagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });

  return project.id;
}

async function invalidateWorksCaches() {
  await Promise.all([
    invalidateCache("api:projects:"),
    invalidateCache("works:count:"),
    invalidateCache("works:sidebar:tags"),
    invalidateCache("admin:projects:"),
    invalidateCache("admin:projectCount"),
  ]);
}

async function invalidateJamActivityCaches(activityId: string) {
  await Promise.all([
    invalidateCache(`jam:${activityId}:submissions`),
    invalidateCache(`activity:detail:${activityId}`),
  ]);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/submit`);
  revalidatePath(`/activities/${activityId}/game-jam/judging`);
  revalidatePath(`/activities/${activityId}/game-jam/results`);
}

// ============================================================
// 作品提交
// ============================================================

export async function submitJamWork(activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const title = (formData.get("title") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const coverImage = (formData.get("coverImage") as string || "").trim();
  const screenshotsStr = (formData.get("screenshots") as string || "[]").trim();
  const creatorsStr = (formData.get("creators") as string || "[]").trim();
  const linksStr = (formData.get("links") as string || "[]").trim();
  const tagIdsStr = (formData.get("tagIds") as string || "[]").trim();
  const customTagsStr = (formData.get("customTags") as string || "[]").trim();
  const submitToWorks = (formData.get("submitToWorks") as string || "0") === "1";
  const projectType = (formData.get("projectType") as string || "TRIAL_DEMO").trim();
  const developYearStr = (formData.get("developYear") as string || "").trim();

  if (!title) return { error: t(lang, "gamejam.errTitle") };
  if (!description || description.length < 10) return { error: t(lang, "gamejam.errDesc") };

  const membership = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
    include: { team: true },
  });
  if (!membership) return { error: t(lang, "gamejam.errNoTeam") };

  let screenshots: string[] = [];
  let creators: { name: string; roles: string[] }[] = [];
  let links: { label: string; url: string }[] = [];
  let tagIds: string[] = [];
  let customTags: string[] = [];

  try {
    screenshots = JSON.parse(screenshotsStr);
    creators = JSON.parse(creatorsStr);
    links = JSON.parse(linksStr);
    tagIds = JSON.parse(tagIdsStr);
    customTags = JSON.parse(customTagsStr);
  } catch {
    return { error: t(lang, "gamejam.errForm") };
  }

  const existing = await prisma.jamSubmission.findUnique({
    where: { teamId: membership.teamId },
  });

  let projectId: string | undefined = existing?.projectId ?? undefined;

  if (submitToWorks) {
    try {
      const hadExistingProject = Boolean(projectId);
      const developYear = developYearStr
        ? parseInt(developYearStr, 10)
        : new Date().getFullYear();

      projectId = await createProjectFromSubmission({
        title, description,
        coverImage: coverImage || undefined,
        screenshots, creators, links,
        tagIds, customTags,
        projectType, developYear,
        submitterId: session.user.id,
        existingProjectId: projectId,
      });

      if (!hadExistingProject && projectId) {
        await notifyNewProject(
          {
            projectId,
            projectTitle: title,
            submitterId: session.user.id,
            submitterName: session.user.name || "未知用户",
            actorId: session.user.id,
            actorName: session.user.name || "未知用户",
          },
          { origin: "jam" },
        );
      }

      await invalidateWorksCaches();
    } catch (err: any) {
      console.error("[submitJamWork] 作品库提交失败:", err);
      return { error: t(lang, "gamejam.errWorksFail", { msg: err.message }) };
    }
  }

  const metadata: Record<string, any> = {};
  if (coverImage) metadata.coverImage = coverImage;
  if (links.length > 0) metadata.links = links;
  if (creators.length > 0) metadata.creators = creators;
  if (tagIds.length > 0) metadata.tagIds = tagIds;
  if (customTags.length > 0) metadata.customTags = customTags;

  if (existing) {
    // 捕获旧文件 URL 用于后续清理
    const oldFiles = existing.files || [];
    const oldMetadata = (existing.metadata || {}) as Record<string, any>;
    const oldCoverImage = typeof oldMetadata.coverImage === "string" ? oldMetadata.coverImage : null;

    // 保留管理员先前设置的奖杯与排序位次
    if (isValidJamTrophy(oldMetadata.trophy)) metadata.trophy = oldMetadata.trophy;
    if (typeof oldMetadata.sortOrder === "number") metadata.sortOrder = oldMetadata.sortOrder;
    if (oldMetadata.isAdminPlaceholder) metadata.isAdminPlaceholder = true;

    await prisma.jamSubmission.update({
      where: { id: existing.id },
      data: {
        title,
        description: description || undefined,
        projectId: projectId || null,
        files: normalizeJamScreenshots(screenshots),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });

    // ── 清理 R2 旧文件（best-effort）──
    // 只删被替换掉的截图；仍在用的 URL 必须保留
    const keepFiles = new Set(screenshots.filter(Boolean));
    const oldUrls: (string | null)[] = oldFiles.filter(
      (u) => typeof u === "string" && u && !keepFiles.has(u),
    );
    if (oldCoverImage && oldCoverImage !== metadata.coverImage) {
      oldUrls.push(oldCoverImage);
    }
    if (oldUrls.length > 0) {
      // 同上：必须 await，否则 serverless 冻结后删除请求发不出去
      try {
        await deleteManyFromR2(oldUrls);
      } catch {
        /* best-effort */
      }
    }
  } else {
    await prisma.jamSubmission.create({
      data: {
        activityId,
        teamId: membership.teamId,
        title,
        description: description || undefined,
        projectId: projectId || null,
        files: normalizeJamScreenshots(screenshots),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
  }

  await invalidateJamActivityCaches(activityId);
  return { success: true };
}

// ============================================================
// 删除参赛作品
// ============================================================

export async function deleteJamSubmission(activityId: string) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const isAdmin =
    (session.user.role as string) === "ADMIN" ||
    (session.user.role as string) === "SUPER_ADMIN";

  const membership = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
    include: { team: { include: { submission: true } } },
  });

  if (!membership && !isAdmin) return { error: t(lang, "gamejam.errNoTeam") };

  const submission = isAdmin
    ? (await prisma.jamSubmission.findFirst({
        where: { activityId },
        include: { team: { include: { members: { where: { userId: session.user.id } } } } },
      }))
    : membership!.team.submission;

  if (!isAdmin) {
    if (!submission) return { error: t(lang, "gamejam.errNoSubmission") };
    const isLeader = membership!.role === "LEADER";
    if (!isLeader) return { error: t(lang, "gamejam.errLeaderOnly") };
  }

  if (!submission) return { error: t(lang, "gamejam.errNotFound") };

  // 捕获旧文件 URL
  const oldFiles = submission.files || [];
  const oldMetadata = (submission.metadata || {}) as Record<string, any>;
  const oldCoverImage = typeof oldMetadata.coverImage === "string" ? oldMetadata.coverImage : null;

  await prisma.jamSubmission.delete({ where: { id: submission.id } });

  // ── 清理 R2 文件（best-effort）──
  const oldUrls: (string | null)[] = [...oldFiles, oldCoverImage];
  // 必须 await：server action 返回后 Vercel 会冻结实例，浮空 Promise 会被直接丢弃，
  // 表现为 R2 里的旧图永远清不掉（孤儿文件）。失败不影响主流程，所以吞掉异常。
  // 用 try/await 而不是 .catch()：后者要求函数真返回 Promise，单测里 mock 被 reset 后是 undefined。
  try {
    await deleteManyFromR2(oldUrls);
  } catch {
    /* best-effort */
  }

  await invalidateJamActivityCaches(activityId);
  return { success: true };
}

// ============================================================
// 事后提交到作品库
// ============================================================

export async function submitToWorksLibrary(activityId: string, formData: FormData) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const submissionId = (formData.get("submissionId") as string || "").trim();
  const projectType = (formData.get("projectType") as string || "TRIAL_DEMO").trim();
  const developYearStr = (formData.get("developYear") as string || "").trim();

  if (!submissionId) return { error: t(lang, "gamejam.errNoId") };

  const isAdmin =
    (session.user.role as string) === "ADMIN" ||
    (session.user.role as string) === "SUPER_ADMIN";

  const submission = await prisma.jamSubmission.findUnique({
    where: { id: submissionId },
    include: { team: { include: { members: true } } },
  });

  if (!submission) return { error: t(lang, "gamejam.errSubmissionNotFound") };
  if (submission.projectId) return { error: t(lang, "gamejam.errAlreadyInWorks") };

  if (!isAdmin) {
    const isMember = submission.team.members.some((m) => m.userId === session.user.id);
    if (!isMember) return { error: t(lang, "gamejam.errMemberOnly") };
  }

  const metadata = (submission.metadata || {}) as any;

  const developYear = developYearStr
    ? parseInt(developYearStr, 10)
    : new Date().getFullYear();

  try {
    const projectId = await createProjectFromSubmission({
      title: submission.title,
      description: submission.description || `${submission.title} - Game Jam 参赛作品`,
      coverImage: metadata.coverImage,
      screenshots: submission.files || [],
      creators: metadata.creators || [],
      links: metadata.links || [],
      tagIds: metadata.tagIds || [],
      customTags: metadata.customTags || [],
      projectType,
      developYear,
      submitterId: session.user.id,
    });

    await prisma.jamSubmission.update({
      where: { id: submissionId },
      data: { projectId },
    });

    // 投稿进作品库后是 PENDING，必须让管理员知道，否则作品只会躺在待审核列表里没人看到。
    // 这个函数是 server action，同样受 Vercel 响应后冻结影响，所以 await 而不是浮空调用。
    await notifyNewProject(
      {
        projectId,
        projectTitle: submission.title,
        submitterId: session.user.id,
        submitterName: session.user.name || "未知用户",
        actorId: session.user.id,
        actorName: session.user.name || "未知用户",
      },
      { origin: "jam" },
    );

    await invalidateWorksCaches();
    await invalidateJamActivityCaches(activityId);
    return { success: true, projectId };
  } catch (err: any) {
    console.error("[submitToWorksLibrary] 提交失败:", err);
    return { error: t(lang, "gamejam.errSubmitFail", { msg: err.message }) };
  }
}

// ============================================================
// 管理员：新增 / 编辑 Game Jam 参赛作品占位条目
// ============================================================

export interface AdminSaveJamEntryInput {
  submissionId?: string;
  title: string;
  teamName?: string;
  coverImage?: string;
  screenshots?: string[];
  creators?: JamCreatorItem[];
  trophy?: JamTrophyType | null;
  projectId?: string | null;
}

export async function adminSaveJamEntry(
  activityId: string,
  input: AdminSaveJamEntryInput
) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const role = session.user.role as string;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return { error: "仅管理员可执行此操作" };
  }

  const title = (input.title || "").trim();
  if (!title) return { error: t(lang, "gamejam.errTitle") };

  const rawScreenshots = Array.isArray(input.screenshots) ? input.screenshots : [];
  if (rawScreenshots.length > 3) {
    return { error: "游戏截图至多上传 3 张" };
  }
  const screenshots = normalizeJamScreenshots(rawScreenshots);

  const coverImage = typeof input.coverImage === "string" ? input.coverImage.trim() : "";
  const teamName = typeof input.teamName === "string" ? input.teamName.trim() : "";
  const creators: JamCreatorItem[] = Array.isArray(input.creators)
    ? input.creators
        .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 0)
        .map((c) => ({
          name: c.name.trim(),
          roles: Array.isArray(c.roles) && c.roles.length > 0
            ? c.roles.filter((r) => typeof r === "string" && r.trim().length > 0)
            : ["制作"],
          userId: c.userId || undefined,
          memberId: c.memberId || undefined,
          avatar: c.avatar || null,
        }))
    : [];

  const trophy: JamTrophyType | null = isValidJamTrophy(input.trophy) ? input.trophy : null;

  let validProjectId: string | null = null;
  if (typeof input.projectId === "string" && input.projectId.trim()) {
    const proj = await prisma.project.findUnique({
      where: { id: input.projectId.trim() },
      select: { id: true },
    });
    if (!proj) return { error: "关联的作品库游戏不存在" };
    validProjectId = proj.id;
  }

  if (input.submissionId) {
    const existing = await prisma.jamSubmission.findFirst({
      where: { id: input.submissionId, activityId },
    });
    if (!existing) return { error: t(lang, "gamejam.errSubmissionNotFound") };

    const oldMeta = parseJamSubmissionMeta(existing.metadata);
    const nextMeta: Record<string, any> = {
      ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, any>)
        : {}),
      creators,
      trophy,
      sortOrder: oldMeta.sortOrder,
    };
    if (coverImage) {
      nextMeta.coverImage = coverImage;
    } else {
      delete nextMeta.coverImage;
    }
    if (teamName) {
      nextMeta.teamName = teamName;
    } else {
      delete nextMeta.teamName;
    }

    const updated = await prisma.jamSubmission.update({
      where: { id: existing.id },
      data: {
        title,
        files: screenshots,
        projectId: input.projectId !== undefined ? validProjectId : existing.projectId,
        metadata: nextMeta,
      },
    });

    // Best-effort R2 清理被替换图片
    const keepFiles = new Set(screenshots);
    const oldUrls: (string | null)[] = (existing.files || []).filter(
      (u) => typeof u === "string" && u && !keepFiles.has(u)
    );
    if (oldMeta.coverImage && oldMeta.coverImage !== coverImage) {
      oldUrls.push(oldMeta.coverImage);
    }
    if (oldUrls.length > 0) {
      // 必须 await：server action 返回后 Vercel 会冻结实例，浮空 Promise 会被直接丢弃，
  // 表现为 R2 里的旧图永远清不掉（孤儿文件）。失败不影响主流程，所以吞掉异常。
  // 用 try/await 而不是 .catch()：后者要求函数真返回 Promise，单测里 mock 被 reset 后是 undefined。
  try {
    await deleteManyFromR2(oldUrls);
  } catch {
    /* best-effort */
  }
    }

    await invalidateJamActivityCaches(activityId);
    return { success: true, submissionId: updated.id };
  }

  // 创建管理员占位条目：自动生成专属占位 JamTeam（标记 topic = __ADMIN_ENTRY__，不在常规报名队伍列表展示）
  const uniqueTeamName = `${title.slice(0, 32)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const placeholderTeam = await prisma.jamTeam.create({
    data: {
      activityId,
      name: uniqueTeamName,
      leaderId: session.user.id,
      topic: JAM_ADMIN_ENTRY_TOPIC,
    },
  });

  const nextMeta: Record<string, any> = {
    creators,
    trophy,
    sortOrder: null,
    isAdminPlaceholder: true,
  };
  if (coverImage) nextMeta.coverImage = coverImage;
  if (teamName) nextMeta.teamName = teamName;

  const created = await prisma.jamSubmission.create({
    data: {
      activityId,
      teamId: placeholderTeam.id,
      title,
      files: screenshots,
      projectId: validProjectId,
      metadata: nextMeta,
    },
  });

  await invalidateJamActivityCaches(activityId);
  return { success: true, submissionId: created.id };
}

// ============================================================
// 管理员：设置单个条目的金/银/铜奖杯
// ============================================================

export async function adminSetJamEntryTrophy(
  activityId: string,
  submissionId: string,
  trophy: JamTrophyType | null
) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const role = session.user.role as string;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return { error: "仅管理员可执行此操作" };
  }

  const existing = await prisma.jamSubmission.findFirst({
    where: { id: submissionId, activityId },
  });
  if (!existing) return { error: t(lang, "gamejam.errSubmissionNotFound") };

  const normalizedTrophy = isValidJamTrophy(trophy) ? trophy : null;
  const rawMeta =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, any>)
      : {};

  await prisma.jamSubmission.update({
    where: { id: existing.id },
    data: {
      metadata: {
        ...rawMeta,
        trophy: normalizedTrophy,
      },
    },
  });

  await invalidateJamActivityCaches(activityId);
  return { success: true };
}

// ============================================================
// 管理员：保存排序栏与未排序栏顺序及奖杯
// ============================================================

export async function adminUpdateJamRankings(
  activityId: string,
  payload: {
    rankedIds: string[];
    unrankedIds: string[];
    trophies?: Record<string, JamTrophyType | null>;
  }
) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const role = session.user.role as string;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return { error: "仅管理员可执行此操作" };
  }

  const submissions = await prisma.jamSubmission.findMany({
    where: { activityId },
    select: { id: true, metadata: true },
  });

  const subMap = new Map(submissions.map((s) => [s.id, s]));
  const rankedSet = new Set<string>();
  const cleanRanked = (payload.rankedIds || []).filter((id) => {
    if (!subMap.has(id) || rankedSet.has(id)) return false;
    rankedSet.add(id);
    return true;
  });

  const updates: Promise<any>[] = [];

  cleanRanked.forEach((id, idx) => {
    const sub = subMap.get(id)!;
    const rawMeta =
      sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
        ? (sub.metadata as Record<string, any>)
        : {};
    const nextMeta: Record<string, any> = {
      ...rawMeta,
      sortOrder: idx,
    };
    if (payload.trophies && id in payload.trophies) {
      const tVal = payload.trophies[id];
      nextMeta.trophy = isValidJamTrophy(tVal) ? tVal : null;
    }
    updates.push(
      prisma.jamSubmission.update({
        where: { id },
        data: { metadata: nextMeta },
      })
    );
  });

  for (const sub of submissions) {
    if (rankedSet.has(sub.id)) continue;
    const rawMeta =
      sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
        ? (sub.metadata as Record<string, any>)
        : {};
    const nextMeta: Record<string, any> = {
      ...rawMeta,
      sortOrder: null,
    };
    if (payload.trophies && sub.id in payload.trophies) {
      const tVal = payload.trophies[sub.id];
      nextMeta.trophy = isValidJamTrophy(tVal) ? tVal : null;
    }
    updates.push(
      prisma.jamSubmission.update({
        where: { id: sub.id },
        data: { metadata: nextMeta },
      })
    );
  }

  await Promise.all(updates);
  await invalidateJamActivityCaches(activityId);
  return { success: true };
}

// ============================================================
// 管理员：将活动页游戏条目关联 / 取消关联到作品库游戏
// ============================================================

export async function adminLinkJamSubmissionProject(
  activityId: string,
  submissionId: string,
  projectId: string | null
) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const role = session.user.role as string;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return { error: "仅管理员可执行此操作" };
  }

  const existing = await prisma.jamSubmission.findFirst({
    where: { id: submissionId, activityId },
  });
  if (!existing) return { error: t(lang, "gamejam.errSubmissionNotFound") };

  let targetProject: { id: string; slug: string; title: string } | null = null;
  if (projectId && projectId.trim()) {
    targetProject = await prisma.project.findUnique({
      where: { id: projectId.trim() },
      select: { id: true, slug: true, title: true },
    });
    if (!targetProject) return { error: "要关联的作品库游戏不存在" };
  }

  await prisma.jamSubmission.update({
    where: { id: existing.id },
    data: { projectId: targetProject ? targetProject.id : null },
  });

  await invalidateJamActivityCaches(activityId);
  return {
    success: true,
    project: targetProject,
  };
}

// ============================================================
// 管理员：按 ID 删除指定的参赛作品条目
// ============================================================

export async function adminDeleteJamEntry(activityId: string, submissionId: string) {
  const lang = await getLang();
  const session = await auth();
  if (!session?.user?.id) return { error: t(lang, "profile.edit.loginFirst") };

  const role = session.user.role as string;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return { error: "仅管理员可执行此操作" };
  }

  const submission = await prisma.jamSubmission.findFirst({
    where: { id: submissionId, activityId },
    include: { team: { select: { id: true, topic: true } } },
  });
  if (!submission) return { error: t(lang, "gamejam.errSubmissionNotFound") };

  const oldFiles = submission.files || [];
  const oldMetadata = (submission.metadata || {}) as Record<string, any>;
  const oldCoverImage = typeof oldMetadata.coverImage === "string" ? oldMetadata.coverImage : null;

  if (submission.team?.topic === JAM_ADMIN_ENTRY_TOPIC) {
    // 级联删除专属占位队伍与该提交
    await prisma.jamTeam.delete({ where: { id: submission.team.id } });
  } else {
    await prisma.jamSubmission.delete({ where: { id: submission.id } });
  }

  const oldUrls: (string | null)[] = [...oldFiles, oldCoverImage];
  // 必须 await：server action 返回后 Vercel 会冻结实例，浮空 Promise 会被直接丢弃，
  // 表现为 R2 里的旧图永远清不掉（孤儿文件）。失败不影响主流程，所以吞掉异常。
  // 用 try/await 而不是 .catch()：后者要求函数真返回 Promise，单测里 mock 被 reset 后是 undefined。
  try {
    await deleteManyFromR2(oldUrls);
  } catch {
    /* best-effort */
  }

  await invalidateJamActivityCaches(activityId);
  return { success: true };
}

// ============================================================
// 管理员：搜索作品库中的游戏用于关联
// ============================================================

export async function searchWorksForJamLink(query: string) {
  const session = await auth();
  if (!session?.user?.id) return { projects: [] };

  const q = (query || "").trim();
  const projects = await prisma.project.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { subtitle: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ developYear: "desc" }, { createdAt: "desc" }],
    take: 15,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
      developYear: true,
      status: true,
      type: true,
    },
  });

  return { projects };
}
