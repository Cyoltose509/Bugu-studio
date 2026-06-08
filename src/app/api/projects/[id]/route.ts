/**
 * 单个作品详情 API
 * GET    /api/projects/[id] - 获取作品详情
 * PATCH  /api/projects/[id] - 更新作品（提交者/Admin）
 * DELETE /api/projects/[id] - 删除作品（Admin）
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { projectUpdateSchema, reviewSchema } from "@/lib/validations";
import { canEditProject, isAdmin, isReviewerOrAbove } from "@/lib/auth/rbac";
import { getClientIp, checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { createAuditLog, extractRequestInfo } from "@/lib/utils/audit";
import { apiResponse, apiError, generateSlug } from "@/lib/utils";
import { ProjectStatus } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      // 非管理员只能看已发布的
      ...(!isAdmin(session?.user?.role as any) && {
        status: ProjectStatus.PUBLISHED,
      }),
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      members: {
        orderBy: { sortOrder: "asc" },
        include: {
          member: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              grade: true,
              userId: true,
            },
          },
        },
      },
      submitter: { select: { id: true, name: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { reviewer: { select: { name: true } } },
      },
    },
  });

  if (!project) return apiError("作品不存在", 404);

  // 增加浏览量（异步，不等待）
  prisma.project
    .update({ where: { id: project.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return apiResponse(project);
}

// PATCH /api/projects/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return apiError("作品不存在", 404);

  if (
    !canEditProject(
      session.user.role as any,
      session.user.id,
      project.submitterId
    )
  ) {
    return apiError("权限不足", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("请求体格式错误", 400);
  }

  // 检查是否是审核操作
  const reviewParsed = reviewSchema.safeParse(body);
  if (reviewParsed.success && isReviewerOrAbove(session.user.role as any)) {
    const { approved, note } = reviewParsed.data;
    const updated = await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: {
          status: approved ? ProjectStatus.PUBLISHED : ProjectStatus.REJECTED,
          publishedAt: approved ? new Date() : null,
          reviewNote: note,
        },
      }),
      prisma.review.create({
        data: {
          projectId: id,
          reviewerId: session.user.id,
          approved,
          note,
        },
      }),
    ]);

    const { ipAddress, userAgent } = extractRequestInfo(request);
    await createAuditLog({
      action: approved ? "PROJECT_APPROVE" : "PROJECT_REJECT",
      userId: session.user.id,
      targetType: "Project",
      targetId: id,
      ipAddress,
      userAgent,
      statusCode: 200,
    });

    return apiResponse(updated[0]);
  }

  // 普通更新
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("数据验证失败", 422, parsed.error.flatten());
  }

  const { tagIds, memberRoles, links, customTags, ...projectData } = parsed.data;

  // 处理自定义标签：upsert 新标签并合并到 tagIds
  let finalTagIds = tagIds;
  if (customTags !== undefined) {
    const customTagIds: string[] = [];
    for (const name of customTags) {
      const tagSlug = generateSlug(name);
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug: tagSlug, color: "#88C232" },
        select: { id: true },
      });
      customTagIds.push(tag.id);
    }
    // 合并已有标签和自定义标签（去重）
    finalTagIds = [...(tagIds || []), ...customTagIds.filter((id) => !(tagIds || []).includes(id))];
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...projectData,
      ...(finalTagIds !== undefined && {
        tags: {
          deleteMany: {},
          create: finalTagIds.map((tagId) => ({ tagId })),
        },
      }),
      ...(memberRoles !== undefined && {
        members: {
          deleteMany: {},
          create: memberRoles.map(({ memberId, role }, idx) => ({
            memberId,
            role,
            sortOrder: idx,
          })),
        },
      }),
      ...(links !== undefined && {
        links: {
          deleteMany: {},
          create: links.map((l, i) => ({
            label: l.label,
            url: l.url,
            sortOrder: i,
          })),
        },
      }),
    },
  });

  const { ipAddress, userAgent } = extractRequestInfo(request);
  await createAuditLog({
    action: "PROJECT_UPDATE",
    userId: session.user.id,
    targetType: "Project",
    targetId: id,
    ipAddress,
    userAgent,
    statusCode: 200,
  });

  return apiResponse(updated);
}

// DELETE /api/projects/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  if (!isAdmin(session.user.role as any)) return apiError("权限不足", 403);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return apiError("作品不存在", 404);

  await prisma.project.delete({ where: { id } });

  const { ipAddress, userAgent } = extractRequestInfo(request);
  await createAuditLog({
    action: "PROJECT_DELETE",
    userId: session.user.id,
    targetType: "Project",
    targetId: id,
    metadata: { title: project.title },
    ipAddress,
    userAgent,
    statusCode: 200,
  });

  return apiResponse({ deleted: true });
}
