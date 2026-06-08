import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { apiResponse, apiError } from "@/lib/utils";
import { createNotification } from "@/lib/services/notification";

/**
 * POST /api/projects/[id]/comments/like
 * 切换点赞状态，并返回当前点赞数
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  if (session.user.role === UserRole.GUEST) return apiError("无权限点赞", 403);

  const { id: projectId } = await params;

  let body: { commentId?: string };
  try { body = await request.json(); } catch { return apiError("请求格式错误", 400); }

  const { commentId } = body;
  if (!commentId) return apiError("缺少 commentId", 400);

  // 验证留言存在且属于该项目
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, projectId: true, userId: true, content: true },
  });
  if (!comment || comment.projectId !== projectId) {
    return apiError("留言不存在", 404);
  }

  // 不能给自己点赞
  if (comment.userId === session.user.id) {
    return apiError("不能给自己的留言点赞", 400);
  }

  // 切换点赞
  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId: session.user.id } },
    select: { id: true },
  });

  let liked: boolean;
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.commentLike.create({
      data: { commentId, userId: session.user.id },
    });
    liked = true;

    // 通知留言作者
    if (comment.userId !== session.user.id) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true },
      });
      await createNotification({
        userId: comment.userId,
        type: "COMMENT_LIKE",
        title: "有人赞了你的留言",
        content: `${session.user.name || "用户"} 赞了《${project?.title || "作品"}》中的留言`,
        relatedId: commentId,
        relatedType: "Comment",
      });
    }
  }

  // 查询最新点赞数
  const count = await prisma.commentLike.count({ where: { commentId } });

  return apiResponse({ liked, likeCount: count });
}
