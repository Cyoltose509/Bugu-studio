import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { createAuditLog, extractRequestInfo } from "@/lib/utils/audit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return apiError("请先登录", 401);

  const userId = session.user.id;

  // 获取用户信息
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) return apiError("用户不存在", 404);

  // 1. 清理 ProjectMember 中的 userId 关联（仅非社团成员的记录）
  //    社团成员通过 memberId 关联，不受影响
  const projectMembersToUpdate = await prisma.projectMember.findMany({
    where: { userId, memberId: null },
    select: { id: true },
  });

  if (projectMembersToUpdate.length > 0) {
    await prisma.projectMember.updateMany({
      where: { userId, memberId: null },
      data: {
        userId: null,
        externalName: user.name || "已注销用户",
      },
    });
  }

  // 2. 软删除用户：标记为停用，清除个人信息
  const deletedSuffix = `_${Date.now().toString(36)}_${userId.slice(0, 6)}`;
  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      name: "已注销用户",
      image: null,
      passwordHash: null,
      bio: null,
      email: `deleted${deletedSuffix}@deleted.local`,
    },
  });

  // 3. 审计日志
  const { ipAddress, userAgent } = extractRequestInfo(request);
  await createAuditLog({
    action: "DELETE",
    userId,
    targetType: "User",
    targetId: userId,
    metadata: {
      originalEmail: user.email,
      originalName: user.name,
      clearedProjectMembers: projectMembersToUpdate.length,
    },
    ipAddress,
    userAgent,
    statusCode: 200,
  });

  return apiResponse({ success: true });
}
