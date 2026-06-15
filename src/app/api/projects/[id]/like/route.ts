import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { apiResponse, apiError } from "@/lib/utils";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { withAuditContext } from "@/lib/db/audit-context";

// 内存缓存：避免短时间内对同一项目重复查 DB（5s TTL）
const likeCache = new Map<string, { data: { liked: boolean; likeCount: number; canLike: boolean }; ts: number }>();
const CACHE_TTL = 5000;

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
  const userId = session?.user?.id ?? "anon";
  const cacheKey = `${projectId}:${userId}`;

  // 命中缓存直接返回
  const cached = likeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return apiResponse(cached.data);
  }

  const [count, existing] = await Promise.all([
    prisma.projectLike.count({ where: { projectId } }),
    session?.user?.id
      ? prisma.projectLike.findUnique({
          where: { projectId_userId: { projectId, userId: session.user.id } },
          select: { id: true },
        })
      : null,
  ]);

  const data = {
    liked: !!existing,
    likeCount: count,
    canLike: !!session?.user && session.user.role !== UserRole.GUEST,
  };

  likeCache.set(cacheKey, { data, ts: Date.now() });
  return apiResponse(data);
}

/**
 * POST /api/projects/[id]/like
 * 切换点赞（爱心），返回最新点赞数和状态
 *
 * 优化：用 deleteMany + create 替代 findUnique + create/delete，减少 1 次查询
 * 通知采用 fire-and-forget 不阻塞响应
 */
const _likePost = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  // 速率限制：每 IP 每秒 3 次（防止刷赞）
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, { windowSeconds: 1, maxRequests: 3, prefix: "like" });
  if (!rl.allowed) {
    return apiError("操作过于频繁", 429);
  }

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

  // 清除该项目的 like 缓存（所有用户的缓存都失效，因为 count 变了）
  for (const key of likeCache.keys()) {
    if (key.startsWith(projectId + ":")) likeCache.delete(key);
  }

  return apiResponse({ liked, likeCount: count });
}

export const POST = withAuditContext(_likePost);

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
