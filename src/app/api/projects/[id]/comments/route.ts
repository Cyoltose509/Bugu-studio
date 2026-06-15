import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery, invalidateCache } from "@/lib/db/cache";
import { UserRole } from "@prisma/client";
import { apiResponse, apiError } from "@/lib/utils";
import { createNotification } from "@/lib/services/notification";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { withAuditContext } from "@/lib/db/audit-context";

/** 递归收集某评论的所有子孙 ID */
async function collectAllChildIds(commentId: string): Promise<string[]> {
  const children = await prisma.comment.findMany({
    where: { parentId: commentId },
    select: { id: true },
  });
  const childIds = children.map((c) => c.id);
  const grandChildIds = await Promise.all(childIds.map((id) => collectAllChildIds(id)));
  return [...childIds, ...grandChildIds.flat()];
}

// ── GET: 获取作品留言（分页，含回复嵌套）──
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  const comments = await cachedQuery(`comments:${projectId}:limit${limit}`, () =>
    prisma.comment.findMany({
      where: { projectId, parentId: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, image: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, image: true } },
            replies: {
              orderBy: { createdAt: "asc" },
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
          },
        },
        _count: { select: { replies: true } },
      },
    })
  , 30);

  return apiResponse(comments.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    user: { id: c.user.id, name: c.user.name, image: c.user.image },
    replyCount: c._count.replies,
    replies: c.replies.map((r: any) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      user: { id: r.user.id, name: r.user.name, image: r.user.image },
      replyCount: 0,
      replies: (r.replies || []).map((rr: any) => ({
        id: rr.id,
        content: rr.content,
        createdAt: rr.createdAt,
        user: { id: rr.user.id, name: rr.user.name, image: rr.user.image },
      })),
    })),
  })));
}

// ── POST: 创建留言/回复（USER+权限，300字限制）──
const _postComment = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  // 速率限制：每用户每分钟 10 条评论
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, { windowSeconds: 60, maxRequests: 10, prefix: "comment" });
  if (!rl.allowed) {
    return apiError("发言过于频繁，请稍后再试", 429);
  }

  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);
  if (session.user.role === UserRole.GUEST) return apiError("无权限发表留言", 403);

  const { id: projectId } = await params;

  let body: { content?: string; parentId?: string };
  try { body = await request.json(); } catch { return apiError("请求格式错误", 400); }

  const content = body.content?.trim();
  if (!content) return apiError("留言内容不能为空", 400);
  if (content.length > 300) return apiError(`留言最多300字（当前${content.length}字）`, 400);

  // 验证项目存在
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, slug: true, submitterId: true },
  });
  if (!project) return apiError("项目不存在", 404);

  // 如果是回复，验证父留言存在且属于同一项目
  if (body.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: { id: true, projectId: true, userId: true },
    });
    if (!parent || parent.projectId !== projectId) {
      return apiError("父留言不存在", 404);
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      projectId,
      userId: session.user.id,
      parentId: body.parentId || null,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  // ── 通知：回复他人时通知父留言作者 ──
  if (body.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: { userId: true, content: true },
    });
    if (parentComment && parentComment.userId !== session.user.id) {
      await createNotification({
        userId: parentComment.userId,
        type: "COMMENT_REPLY",
        title: "有人回复了你的留言",
        content: `${session.user.name || "用户"} 在《${project.title}》中回复了你`,
        relatedId: comment.id,
        relatedType: "Comment",
      });
    }
  }

  // ── 通知：顶层留言通知项目提交者 ──
  if (!body.parentId && project.submitterId !== session.user.id) {
    await createNotification({
      userId: project.submitterId,
      type: "COMMENT_REPLY",
      title: "你的作品收到了新留言",
      content: `${session.user.name || "用户"} 评论了《${project.title}》`,
      relatedId: comment.id,
      relatedType: "Comment",
    });
  }

  // ── 清除评论缓存，确保下次 GET 返回新数据 ──
  await invalidateCache(`comments:${projectId}:`);

  return apiResponse({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    user: { id: comment.user.id, name: comment.user.name, image: comment.user.image },
    likeCount: 0,
    hasLiked: false,
    replyCount: 0,
    replies: [],
  }, 201);
}

export const POST = withAuditContext(_postComment);

// ── PATCH: 编辑或删除留言 ──
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError("请先登录", 401);

  const { id: projectId } = await params;

  let body: { commentId?: string; action?: string; content?: string };
  try { body = await request.json(); } catch { return apiError("请求格式错误", 400); }

  if (!body.commentId) return apiError("缺少 commentId", 400);

  const comment = await prisma.comment.findUnique({
    where: { id: body.commentId },
    select: { id: true, userId: true, projectId: true },
  });
  if (!comment || comment.projectId !== projectId) return apiError("留言不存在", 404);

  // 仅作者或管理员可编辑/删除
  const isAdmin = session.user.role === UserRole.ADMIN;
  if (comment.userId !== session.user.id && !isAdmin) {
    return apiError("无权操作此留言", 403);
  }

  if (body.action === "delete") {
    // ── 递归收集所有子留言 ID（防止 onDelete: SetNull 导致子留言浮到顶层）──
    const allChildIds = await collectAllChildIds(body.commentId);
    const idsToDelete = [body.commentId, ...allChildIds];
    await prisma.comment.deleteMany({ where: { id: { in: idsToDelete } } });
    // 清除评论缓存，确保下次 GET 返回最新数据
    await invalidateCache(`comments:${projectId}:`);
    return apiResponse({ deleted: true, deletedCount: idsToDelete.length });
  }

  // 编辑
  const newContent = body.content?.trim();
  if (!newContent) return apiError("留言内容不能为空", 400);
  if (newContent.length > 300) return apiError(`留言最多300字（当前${newContent.length}字）`, 400);

  const updated = await prisma.comment.update({
    where: { id: body.commentId },
    data: { content: newContent },
  });

  // 清除评论缓存
  await invalidateCache(`comments:${projectId}:`);

  return apiResponse({ id: updated.id, content: updated.content, updatedAt: updated.updatedAt });
}
