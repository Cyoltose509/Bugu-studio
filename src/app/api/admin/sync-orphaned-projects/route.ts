import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { invalidateCache } from "@/lib/db/cache";
import { apiResponse, apiError } from "@/lib/utils";

/**
 * POST /api/admin/sync-orphaned-projects
 * 管理员专用：同步所有"孤儿项目"——即 submitterId 对应有 ClubMember，
 * 但该 ClubMember 尚未加入 ProjectMember 的项目。
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return apiError("仅管理员可执行此操作", 403);
  }

  // ── 1. 找出所有有 submitterId 的项目 ──
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      submitterId: true,
      members: { select: { memberId: true } },
    },
  });

  // ── 2. 找出所有 submitterIds 对应的 ClubMember ──
  const submitterIds = [...new Set(allProjects.map((p) => p.submitterId))];
  const clubMembers = await prisma.clubMember.findMany({
    where: { userId: { in: submitterIds } },
    select: { id: true, userId: true, displayName: true },
  });
  const userIdToMemberId = new Map(clubMembers.map((cm) => [cm.userId, cm]));

  // ── 3. 找出孤儿：有 ClubMember 但未加入 ProjectMember ──
  const orphaned: Array<{
    projectId: string;
    projectTitle: string;
    memberId: string;
    memberName: string;
  }> = [];

  for (const project of allProjects) {
    const cm = userIdToMemberId.get(project.submitterId);
    if (!cm) continue; // submitter 不是社团成员，跳过
    const existingMemberIds = new Set(project.members.map((m) => m.memberId));
    if (!existingMemberIds.has(cm.id)) {
      orphaned.push({
        projectId: project.id,
        projectTitle: project.title,
        memberId: cm.id,
        memberName: cm.displayName,
      });
    }
  }

  if (orphaned.length === 0) {
    return apiResponse({ synced: 0, message: "没有找到孤儿项目，数据已同步。" });
  }

  // ── 4. 批量创建缺失的 ProjectMember 记录 ──
  let created = 0;
  const errors: string[] = [];

  for (const item of orphaned) {
    try {
      // 找到当前项目最大的 sortOrder
      const maxOrder = await prisma.projectMember.aggregate({
        where: { projectId: item.projectId },
        _max: { sortOrder: true },
      });
      const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

      await prisma.projectMember.create({
        data: {
          projectId: item.projectId,
          memberId: item.memberId,
          role: "制作",
          sortOrder: nextOrder,
        },
      });
      created++;
    } catch (err: any) {
      // 可能是 unique 约束冲突（并发），忽略
      if (err.code === "P2002") continue;
      errors.push(`${item.projectTitle}: ${err.message}`);
    }
  }

  // ── 5. 清除缓存 & 刷新页面 ──
  await invalidateCache("members:all");
  for (const item of orphaned) {
    await invalidateCache(`member:detail:${item.memberId}`);
  }
  revalidatePath("/members");
  revalidatePath("/works");

  return apiResponse({
    synced: created,
    total: orphaned.length,
    errors: errors.length > 0 ? errors : undefined,
    details: orphaned.map((o) => `${o.projectTitle} → ${o.memberName}`),
  });
}
