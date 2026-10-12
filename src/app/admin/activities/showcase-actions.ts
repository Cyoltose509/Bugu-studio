"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { showcaseKey, showcaseSchema } from "@/lib/activities/showcase";
import { prepareBaituanDraft } from "@/lib/activities/baituan";

export async function createBaituanActivity() {
  await requireAdmin();
  try {
    const activity = await prisma.$transaction(prepareBaituanDraft, { timeout: 20000 });
    await Promise.all([invalidateCache("admin:activities:"), invalidateCache("activities:list")]);
    revalidatePath("/admin/activities");
    return { success: true as const, id: activity.id };
  } catch (error) {
    return { error: error instanceof Error && error.message.includes("五款") ? error.message : "创建失败，请稍后重试" };
  }
}

export async function saveActivityShowcase(activityId: string, input: unknown) {
  await requireAdmin();
  const parsed = showcaseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { slug: true, type: true } });
    if (!activity || activity.type !== "GENERAL") return { error: "仅普通活动支持海报与试玩目录" };
    const validCount = await prisma.project.count({ where: { id: { in: parsed.data.projectIds }, status: "PUBLISHED" } });
    if (validCount !== parsed.data.projectIds.length) return { error: "部分作品已下架或不存在，请移除后重试" };
    await prisma.siteSetting.upsert({
      where: { key: showcaseKey(activityId) },
      create: { key: showcaseKey(activityId), value: JSON.stringify(parsed.data) },
      update: { value: JSON.stringify(parsed.data) },
    });
    revalidatePath(`/activities/${activityId}`);
    revalidatePath(`/activities/${activity.slug}`);
    revalidatePath(`/admin/activities/${activityId}/edit`);
    return { success: true as const };
  } catch { return { error: "保存失败，请稍后重试" }; }
}
