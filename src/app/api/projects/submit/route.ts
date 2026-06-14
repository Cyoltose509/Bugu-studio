/**
 * POST /api/projects/submit — 提交新作品 (JSON)
 * 替代 Server Action，供统一的 ProjectForm 组件使用
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { isMemberOrAbove } from "@/lib/auth/rbac";
import { projectCreateSchema } from "@/lib/validations";
import { apiResponse, apiError, generateSlug } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  // 双重校验：role 为 MEMBER 及以上，或有关联的 ClubMember 记录
  if (!isMemberOrAbove(session.user.role as any)) {
    const hasClubMember = await prisma.clubMember.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!hasClubMember) {
      return apiError("仅社团成员可提交作品。如果你已是社团成员，请尝试重新登录后重试。", 403);
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) return apiError("请求体格式错误", 400);

  const { title, subtitle, description, type, developYear, coverImage, tagIds, customTags, links, members, memberRoles, images, aiUsages, platforms } = body;

  const data = {
    title: title || "",
    subtitle: subtitle || undefined,
    description: description || "",
    type: type || "",
    developYear: developYear || new Date().getFullYear(),
    coverImage: coverImage || undefined,
    links: (links || []).filter((l: any) => l.label && l.url),
    tagIds: (tagIds || []),
    customTags: (customTags || []).filter(Boolean),
    memberRoles: (memberRoles || members || []).filter((m: any) => m.memberId || m.userId || m.externalName).slice(0, 50),
    images: (images || []).slice(0, 3),
    aiUsages: (aiUsages || []).filter(Boolean),
    platforms: (platforms || []).filter(Boolean),
  };

  // Zod 校验
  const parsed = projectCreateSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return apiError(msg, 422);
  }

  // 解析 userId → memberId
  const rolesWithUserId = parsed.data.memberRoles.filter((r: any) => r.userId && !r.memberId);
  if (rolesWithUserId.length > 0) {
    const userIds = [...new Set(rolesWithUserId.map((r: any) => r.userId as string))];
    const members = await prisma.clubMember.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    });
    const userToMember = new Map<string, string>(members.map((m: any) => [m.userId, m.id]));
    for (const r of parsed.data.memberRoles) {
      if (r.userId && !r.memberId) {
        const mid = userToMember.get(r.userId as string);
        if (!mid) return apiError(`用户 ${r.userId} 不是社团成员，请以外部成员方式添加`, 400);
        r.memberId = mid;
      }
    }
  }

  // 成员校验
  const memberIds = parsed.data.memberRoles
    .filter((m) => m.memberId)
    .map((m) => m.memberId as string);
  if (memberIds.length > 0) {
    const existingMembers = await prisma.clubMember.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingMembers.map((m) => m.id));
    const invalid = memberIds.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) return apiError(`以下成员不存在: ${invalid.join(", ")}`, 400);
  }

  // 标签校验
  if (tagIds?.length > 0) {
    const existingTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });
    const existingTagIds = new Set(existingTags.map((t) => t.id));
    const invalid = tagIds.filter((id: string) => !existingTagIds.has(id));
    if (invalid.length > 0) return apiError(`以下标签不存在: ${invalid.join(", ")}`, 400);
  }

  // 生成 slug
  let slug = generateSlug(parsed.data.title);
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  // 自定义标签
  const customTagRecords: { id: string }[] = [];
  for (const name of parsed.data.customTags) {
    try {
      const tagSlug = generateSlug(name + "-" + Math.random().toString(36).slice(2, 8));
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug: tagSlug, color: "#88C232" },
        select: { id: true },
      });
      customTagRecords.push(tag);
    } catch (e: any) {
      return apiError(`自定义标签「${name}」处理失败：${e.message || "未知错误"}`, 422);
    }
  }

  const allTagIds = [...(tagIds || []), ...customTagRecords.map((t) => t.id)];

  // 不再强制添加提交者本人——前端已默认填入，若用户主动删除则说明是代投
  const finalMemberRoles = [...parsed.data.memberRoles];

  // 管理员提交直接发布，成员提交需审核
  const isAdminUser = session.user.role === "ADMIN";
  const projectStatus = isAdminUser ? ProjectStatus.PUBLISHED : ProjectStatus.PENDING;
  const publishedAt = isAdminUser ? new Date() : null;

  // 写入
  await prisma.project.create({
    data: {
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description,
      slug,
      type: parsed.data.type as any,
      developYear: parsed.data.developYear,
      coverImage: parsed.data.coverImage || null,
      aiUsages: parsed.data.aiUsages,
      platforms: parsed.data.platforms,
      status: projectStatus,
      publishedAt,
      submitterId: session.user.id,
      submittedAt: new Date(),
      links: {
        create: parsed.data.links.map((l, i) => ({
          label: l.label,
          url: l.url,
          sortOrder: i,
        })),
      },
      tags: { create: allTagIds.map((tagId) => ({ tagId })) },
      members: {
        create: finalMemberRoles.map((m) => ({
          memberId: m.memberId || null,
          externalName: m.memberId ? null : (m.externalName || null),
          roles: m.roles,
        })),
      },
      images: parsed.data.images?.length
        ? { create: parsed.data.images.map((img: any, i: number) => ({ url: img.url, altText: img.altText, sortOrder: i })) }
        : undefined,
    },
  });

  await Promise.all([
    invalidateCache("members:all"),
    invalidateCache("api:projects:"),
    invalidateCache("works:sidebar:tags"),
    invalidateCache("works:count:"),
    invalidateCache("admin:projects:"),
    invalidateCache("admin:projectCount"),
    ...finalMemberRoles.filter(m => m.memberId).map(m => invalidateCache(`member:detail:${m.memberId}`)),
  ]);
  revalidatePath("/submit");
  revalidatePath("/works");
  revalidatePath("/members");

  return apiResponse({ slug }, 201);
}
