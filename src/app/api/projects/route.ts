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
import { cachedQuery } from "@/lib/db/cache";
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

  const { page, pageSize, q, type, tag, year } = queryResult.data;
  const { skip, take } = getPagination(page, pageSize);

  // 构造查询条件
  const where: any = {
    status: ProjectStatus.PUBLISHED,
    ...(type && { type }),
    ...(year && { developYear: year }),
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

  const cacheKey = `api:projects:${JSON.stringify({ page, pageSize, q, type, tag, year })}`;

  const result = await cachedQuery(cacheKey, () =>
    Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: "desc" }],
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
    ]), 30);

  const [projects, total] = result;

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

  // 不再强制添加提交者本人——前端已默认填入，若用户主动删除则说明是代投
  const finalMemberRoles = [...memberRoles];

  // 解析 userId → memberId（如果是社团成员则关联 memberId，否则保留 userId）
  const rolesWithUserId = finalMemberRoles.filter((r: any) => r.userId && !r.memberId);
  if (rolesWithUserId.length > 0) {
    const userIds = [...new Set(rolesWithUserId.map((r: any) => r.userId as string))];
    const members = await prisma.clubMember.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    });
    const userToMember = new Map<string, string>(members.map((m: any) => [m.userId, m.id]));
    for (const r of finalMemberRoles) {
      if (r.userId && !r.memberId) {
        const mid = userToMember.get(r.userId as string);
        if (mid) r.memberId = mid;
        // 找不到 ClubMember 说明是普通注册用户，保留 userId 直接关联
      }
    }
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
        create: finalMemberRoles.map(({ memberId, externalName, roles, userId }, idx) => ({
          memberId: memberId || null,
          userId: userId || null,
          externalName: (memberId || userId) ? null : (externalName || null),
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
  await Promise.all([
    invalidateCache("members:all"),
    invalidateCache("api:projects:"),
    invalidateCache("works:sidebar:tags"),
    invalidateCache("works:count:"),
    invalidateCache("admin:projects:"),
    invalidateCache("admin:projectCount"),
    ...finalMemberRoles.filter(m => m.memberId).map(m => invalidateCache(`member:detail:${m.memberId}`)),
  ]);
  revalidatePath("/members");
  revalidatePath("/works");

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
