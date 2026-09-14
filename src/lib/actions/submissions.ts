"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { deleteFromR2, deleteManyFromR2 } from "@/lib/utils/upload";

// ============================================================
// 辅助函数
// ============================================================

async function createProjectFromSubmission(data: {
  title: string;
  description: string;
  coverImage?: string;
  screenshots: string[];
  creators: { name: string; roles: string[] }[];
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
        ? { create: creators.map((c) => ({
            externalName: c.name,
            roles: c.roles,
          })) }
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

// ============================================================
// 作品提交
// ============================================================

export async function submitJamWork(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

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

  if (!title) return { error: "请填写作品标题" };
  if (!description || description.length < 10) return { error: "作品描述至少需要 10 个字" };

  const membership = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
    include: { team: true },
  });
  if (!membership) return { error: "你还没有加入队伍" };

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
    return { error: "表单数据格式错误" };
  }

  const existing = await prisma.jamSubmission.findUnique({
    where: { teamId: membership.teamId },
  });

  let projectId: string | undefined = existing?.projectId ?? undefined;

  if (submitToWorks) {
    try {
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

      await invalidateWorksCaches();
    } catch (err: any) {
      console.error("[submitJamWork] 作品库提交失败:", err);
      return { error: `作品库提交失败: ${err.message}` };
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

    await prisma.jamSubmission.update({
      where: { id: existing.id },
      data: {
        title,
        description: description || undefined,
        projectId: projectId || null,
        files: screenshots,
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
      deleteManyFromR2(oldUrls).catch(() => {});
    }
  } else {
    await prisma.jamSubmission.create({
      data: {
        activityId,
        teamId: membership.teamId,
        title,
        description: description || undefined,
        projectId: projectId || null,
        files: screenshots,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
  }

  invalidateCache(`jam:${activityId}:submissions`);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/submit`);
  return { success: true };
}

// ============================================================
// 删除参赛作品
// ============================================================

export async function deleteJamSubmission(activityId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const isAdmin =
    (session.user.role as string) === "ADMIN" ||
    (session.user.role as string) === "SUPER_ADMIN";

  const membership = await prisma.jamTeamMember.findFirst({
    where: { userId: session.user.id, team: { activityId } },
    include: { team: { include: { submission: true } } },
  });

  if (!membership && !isAdmin) return { error: "你还没有加入队伍" };

  const submission = isAdmin
    ? (await prisma.jamSubmission.findFirst({
        where: { activityId },
        include: { team: { include: { members: { where: { userId: session.user.id } } } } },
      }))
    : membership!.team.submission;

  if (!isAdmin) {
    if (!submission) return { error: "该队伍还没有提交作品" };
    const isLeader = membership!.role === "LEADER";
    if (!isLeader) return { error: "只有队长或管理员可以删除作品" };
  }

  if (!submission) return { error: "未找到参赛作品" };

  // 捕获旧文件 URL
  const oldFiles = submission.files || [];
  const oldMetadata = (submission.metadata || {}) as Record<string, any>;
  const oldCoverImage = typeof oldMetadata.coverImage === "string" ? oldMetadata.coverImage : null;

  await prisma.jamSubmission.delete({ where: { id: submission.id } });

  // ── 清理 R2 文件（best-effort）──
  const oldUrls: (string | null)[] = [...oldFiles, oldCoverImage];
  deleteManyFromR2(oldUrls).catch(() => {});

  invalidateCache(`jam:${activityId}:submissions`);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/game-jam/submit`);
  return { success: true };
}

// ============================================================
// 事后提交到作品库
// ============================================================

export async function submitToWorksLibrary(activityId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const submissionId = (formData.get("submissionId") as string || "").trim();
  const projectType = (formData.get("projectType") as string || "TRIAL_DEMO").trim();
  const developYearStr = (formData.get("developYear") as string || "").trim();

  if (!submissionId) return { error: "缺少提交 ID" };

  const isAdmin =
    (session.user.role as string) === "ADMIN" ||
    (session.user.role as string) === "SUPER_ADMIN";

  const submission = await prisma.jamSubmission.findUnique({
    where: { id: submissionId },
    include: { team: { include: { members: true } } },
  });

  if (!submission) return { error: "参赛作品不存在" };
  if (submission.projectId) return { error: "该作品已在作品库中" };

  if (!isAdmin) {
    const isMember = submission.team.members.some((m) => m.userId === session.user.id);
    if (!isMember) return { error: "只有队员或管理员可以执行此操作" };
  }

  const metadata = (submission.metadata || {}) as any;

  const developYear = developYearStr
    ? parseInt(developYearStr, 10)
    : new Date().getFullYear();

  try {
    const projectId = await createProjectFromSubmission({
      title: submission.title,
      description: submission.description || "",
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

    await invalidateWorksCaches();
    invalidateCache(`jam:${activityId}:submissions`);
    revalidatePath(`/activities/${activityId}`);
    return { success: true, projectId };
  } catch (err: any) {
    console.error("[submitToWorksLibrary] 提交失败:", err);
    return { error: `提交失败: ${err.message}` };
  }
}
