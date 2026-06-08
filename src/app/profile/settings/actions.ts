"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * 更新通知偏好设置
 * - notifyNewProjects: 是否接收作品上新通知
 */
export async function updateNotificationSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("请先登录");

  const notifyNew = formData.get("notifyNewProjects") === "on";

  // 查找当前用户的 ClubMember 记录
  const member = await prisma.clubMember.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (member) {
    await prisma.clubMember.update({
      where: { id: member.id },
      data: { notifyNewProjects: notifyNew },
    });
  }

  return { success: true, notifyNewProjects: notifyNew };
}
