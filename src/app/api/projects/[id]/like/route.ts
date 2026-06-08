import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { apiResponse, apiError } from "@/lib/utils";

/**
 * GET /api/projects/[id]/like
 * 查询当前用户是否点赞 + 总点赞数
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id: projectId } = await params;

  const count = await prisma.projectLike.count({ where: { projectId } });

  let liked = false;
  if (session?.user?.id) {
    const existing = await prisma.projectLike.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
      select: { id: true },
    });
    liked = !!existing;
  }

  return apiResponse({ liked, likeCount: count });
}

/**
 * POST /api/projects/[id]/like
 * 切换作品点赞（爱心），返回最新点赞数
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  if (session.user.role === UserRole.GUEST) return apiError("无权限点赞", 403);

  const { id: projectId } = await params;

  // 验证项目存在
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return apiError("作品不存在", 404);

  // 切换点赞
  const existing = await prisma.projectLike.findUnique({
    where: {
      projectId_userId: { projectId, userId: session.user.id },
    },
    select: { id: true },
  });

  let liked: boolean;
  if (existing) {
    await prisma.projectLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.projectLike.create({
      data: { projectId, userId: session.user.id },
    });
    liked = true;
  }

  const count = await prisma.projectLike.count({ where: { projectId } });

  return apiResponse({ liked, likeCount: count });
}
