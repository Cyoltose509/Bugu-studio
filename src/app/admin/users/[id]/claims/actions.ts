"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { invalidateCache } from "@/lib/db/cache";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

type ClaimKind = "project" | "course" | "speaker" | "talk" | "showcase";
const kinds = new Set<ClaimKind>(["project", "course", "speaker", "talk", "showcase"]);

export async function claimAssociations(userId: string, formData: FormData) {
  const session = await requireAdmin();
  const raw = formData.getAll("claim");
  const search = String(formData.get("search") || "").trim().slice(0, 80);
  const back = `/admin/users/${encodeURIComponent(userId)}/claims?name=${encodeURIComponent(search)}`;
  if (raw.length === 0 || raw.length > 500) redirect(`${back}&error=selection`);
  const claims = raw.map((value) => {
    const [kind, id] = String(value).split(":");
    if (!kinds.has(kind as ClaimKind) || !id || id.length > 100) throw new Error("无效的认领项");
    return { kind: kind as ClaimKind, id };
  });
  if (new Set(claims.map(({ kind, id }) => `${kind}:${id}`)).size !== claims.length) {
    redirect(`${back}&error=selection`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new Error("用户不存在");
      const originalNames: { kind: ClaimKind; id: string; name: string }[] = [];
      for (const { kind, id } of claims) {
        if (kind === "project") {
          const item = await tx.projectMember.findUnique({ where: { id }, select: { projectId: true, externalName: true, userId: true, memberId: true } });
          if (!item?.externalName || item.userId || item.memberId) throw new Error("作品署名已变更");
          if (await tx.projectMember.count({ where: { projectId: item.projectId, OR: [{ userId }, { member: { userId } }] } })) throw new Error("此用户已关联该作品");
          const updated = await tx.projectMember.updateMany({ where: { id, userId: null, memberId: null, externalName: item.externalName }, data: { userId } });
          if (updated.count !== 1) throw new Error("作品署名已变更");
          originalNames.push({ kind, id, name: item.externalName });
        } else if (kind === "course") {
          const item = await tx.courseParticipant.findUnique({ where: { id }, select: { activityId: true, externalName: true, userId: true, memberId: true } });
          if (!item?.externalName || item.userId || item.memberId) throw new Error("公开课讲师已变更");
          if (await tx.courseParticipant.count({ where: { activityId: item.activityId, OR: [{ userId }, { member: { userId } }] } })) throw new Error("此用户已关联该活动");
          const updated = await tx.courseParticipant.updateMany({ where: { id, userId: null, memberId: null, externalName: item.externalName }, data: { userId } });
          if (updated.count !== 1) throw new Error("公开课讲师已变更");
          originalNames.push({ kind, id, name: item.externalName });
        } else if (kind === "speaker") {
          const item = await tx.meetingTalkSpeaker.findUnique({ where: { id }, select: { name: true } });
          if (!item?.name.trim()) throw new Error("例会主讲无署名");
          const updated = await tx.meetingTalkSpeaker.updateMany({ where: { id, userId: null }, data: { userId } });
          if (updated.count !== 1) throw new Error("例会主讲已变更");
          originalNames.push({ kind, id, name: item.name });
        } else if (kind === "talk") {
          const item = await tx.meetingTalk.findUnique({ where: { id }, select: { speaker: true, userId: true, speakers: { select: { id: true } } } });
          if (!item || item.userId || item.speakers.length) throw new Error("例会议程已变更");
          const updated = await tx.meetingTalk.updateMany({ where: { id, userId: null }, data: { userId } });
          if (updated.count !== 1) throw new Error("例会议程已变更");
          originalNames.push({ kind, id, name: item.speaker });
        } else {
          const item = await tx.courseShowcaseItem.findUnique({ where: { id }, select: { authorName: true } });
          if (!item?.authorName.trim()) throw new Error("课程作品作者无署名");
          const updated = await tx.courseShowcaseItem.updateMany({ where: { id, authorUserId: null }, data: { authorUserId: userId } });
          if (updated.count !== 1) throw new Error("课程作品作者已变更");
          originalNames.push({ kind, id, name: item.authorName });
        }
      }
      await tx.auditLog.create({ data: {
        action: "ADMIN_ACTION", userId: session.user.id, targetType: "User", targetId: userId,
        metadata: { operation: "claim_external_associations", claims: originalNames }, ipAddress: "server-action",
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
  } catch (error) {
    console.error("[ClaimAssociations]", error);
    redirect(`${back}&error=conflict`);
  }

  await Promise.all([
    invalidateCache(`profile:projects:${userId}`), invalidateCache(`profile:activities:${userId}`),
    invalidateCache("member:detail:"), invalidateCache("activity:"),
    invalidateCache("project:detail:"), invalidateCache("projects:latest:"),
  ]);
  revalidatePath("/profile");
  revalidatePath("/members/[id]", "page");
  revalidatePath("/activities/[id]", "page");
  revalidatePath("/works/[slug]", "page");
  redirect(`${back}&success=${claims.length}`);
}
