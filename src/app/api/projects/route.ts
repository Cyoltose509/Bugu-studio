/**
 * 作品列表 & 创建 API
 * GET  /api/projects - 获取作品列表（公开）
 * POST /api/projects - 创建作品（MEMBER+）
 */

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { projectCreateSchema, projectQuerySchema } from "@/lib/validations";
import { isMemberOrAbove } from "@/lib/auth/rbac";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/utils/rate-limit";
import { createAuditLog, extractRequestInfo } from "@/lib/utils/audit";
import { apiResponse, apiError, generateSlug, getPagination } from "@/lib/utils";
import { invalidateCache } from "@/lib/db/cache";
import { ProjectStatus } from "@prisma/client";

// GET /api/projects
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.SEARCH);
  if (!rl.allowed) {
    return apiError("请求过于频繁，请稍后再试", 429);
  }

  const { searchParams } = new URL(request.url);
  const queryResult = projectQuerySchema.safeParse(
    Object.fromEntries(searchParams)
  );
  if (!queryResult.success) {
    return apiError("参数格式错误", 400, queryResult.error.flatten());
  }

  const { page, pageSize, q, type, tag, year, featured } = queryResult.data;
  const { skip, take } = getPagination(page, pageSize);

  // 构造查询条件
  const where: any = {
    status: ProjectStatus.PUBLISHED,
    ...(type && { type }),
    ...(year && { developYear: year }),
    ...(featured !== undefined && { isFeatured: featured }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(tag && {
      tags: {
        some: { tag: { slug: tag } },
      },
    }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        coverImage: true,
        type: true,
        developYear: true,
        publishedAt: true,
        isFeatured: true,
        steamUrl: true,
        githubUrl: true,
        itchUrl: true,
        tags: {
          select: {
            tag: { select: { name: true, slug: true, color: true } },
          },
        },
        members: {
          select: {
            roles: true,
            member: {
              select: { displayName: true, avatar: true, userId: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return apiResponse({
    items: projects,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST /api/projects
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("请先登录", 401);
  }

  if (!isMemberOrAbove(session.user.role as any)) {
    return apiError("权限不足，仅社团成员可提交作品", 403);
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(
    `${session.user.id}:${ip}`,
    RATE_LIMITS.API_GENERAL
  );
  if (!rl.allowed) {
    return apiError("请求过于频繁，请稍后再试", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("请求体格式错误", 400);
  }

  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("数据验证失败", 422, parsed.error.flatten());
  }

  const { tagIds, memberRoles, links, customTags, images: _, ...projectData } = parsed.data;

  // 生成唯一 slug
  let slug = generateSlug(projectData.title);
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  // ── 自动将提交者本人加入成员列表 ──
  const finalMemberRoles = [...memberRoles] as Array<{
    memberId?: string;
    externalName?: string;
    roles: string[];
  }>;
  const submitterMember = await prisma.clubMember.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (submitterMember && !finalMemberRoles.some((m) => m.memberId === submitterMember.id)) {
    finalMemberRoles.push({ memberId: submitterMember.id, roles: ["制作"] });
  }

  const project = await prisma.project.create({
    data: {
      ...projectData,
      slug,
      submitterId: session.user.id,
      submittedAt: new Date(),
      status: ProjectStatus.PENDING,
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
      members: {
        create: finalMemberRoles.map(({ memberId, externalName, roles }, idx) => ({
          memberId: memberId || null,
          externalName: memberId ? null : (externalName || null),
          roles,
          sortOrder: idx,
        })),
      },
      links: {
        create: links.map((l, i) => ({
          label: l.label,
          url: l.url,
          sortOrder: i,
        })),
      },
    },
    include: {
      tags: { include: { tag: true } },
      members: { include: { member: true } },
    },
  });

  // ── 清除成员相关缓存 & 触发页面刷新 ──
  await invalidateCache("members:all");
  for (const m of finalMemberRoles) {
    if (m.memberId) await invalidateCache(`member:detail:${m.memberId}`);
  }
  revalidatePath("/members");

  // 审计日志
  const { ipAddress, userAgent } = extractRequestInfo(request);
  await createAuditLog({
    action: "PROJECT_CREATE",
    userId: session.user.id,
    targetType: "Project",
    targetId: project.id,
    ipAddress,
    userAgent,
    statusCode: 201,
  });

  return apiResponse(project, 201);
}
