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

  const [count, existing] = await Promise.all([
    prisma.projectLike.count({ where: { projectId } }),
    session?.user?.id
      ? prisma.projectLike.findUnique({
          where: { projectId_userId: { projectId, userId: session.user.id } },
          select: { id: true },
        })
      : null,
  ]);

  const liked = !!existing;
  const canLike = !!session?.user && session.user.role !== UserRole.GUEST;
  return apiResponse({ liked, likeCount: count, canLike });
}

/**
 * POST /api/projects/[id]/like
 * 切换点赞（爱心），返回最新点赞数和状态
 *
 * 优化：用 deleteMany + create 替代 findUnique + create/delete，减少 1 次查询
 * 通知采用 fire-and-forget 不阻塞响应
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  if (session.user.role === UserRole.GUEST) return apiError("无权限点赞", 403);

  const { id: projectId } = await params;
  const userId = session.user.id;

  // 尝试删除已有点赞（若存在则取消点赞，否则新增）
  const deleted = await prisma.projectLike.deleteMany({
    where: { projectId, userId },
  });

  let liked: boolean;
  if (deleted.count > 0) {
    liked = false;
  } else {
    // 新增点赞
    try {
      await prisma.projectLike.create({ data: { projectId, userId } });
      liked = true;
    } catch {
      return apiError("作品不存在", 404);
    }
  }

  // 并行查 count + fire-and-forget 通知
  const [count] = await Promise.all([
    prisma.projectLike.count({ where: { projectId } }),
    liked ? sendLikeNotification(projectId, userId, session.user.name || session.user.email || "匿名用户") : Promise.resolve(),
  ]);

  return apiResponse({ liked, likeCount: count });
}

/** 发送点赞通知，fire-and-forget，不阻塞主响应 */
async function sendLikeNotification(projectId: string, likerId: string, likerName: string) {
  try {
    const projectInfo = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true, submitterId: true },
    });
    if (projectInfo?.submitterId && projectInfo.submitterId !== likerId) {
      await prisma.notification.create({
        data: {
          userId: projectInfo.submitterId,
          type: "PROJECT_LIKE",
          title: "有人喜欢了你的作品 ❤️",
          content: `${likerName} 喜欢了你的作品《${projectInfo.title}》`,
          relatedId: projectId,
          relatedType: "Project",
        },
      });
    }
  } catch {
    // 通知失败不影响主流程
  }
}
