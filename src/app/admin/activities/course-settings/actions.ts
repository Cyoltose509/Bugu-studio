"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { COURSE_MEETING_VISIBILITIES, COURSE_MEETING_VISIBILITY_KEY } from "@/lib/activities/course-meeting-visibility";
import { revalidatePath } from "next/cache";

export async function saveCourseMeetingVisibility(formData: FormData) {
  await requireAdmin();
  const value = String(formData.get("visibility") || "");
  if (!COURSE_MEETING_VISIBILITIES.some((option) => option === value)) throw new Error("权限选项无效");
  await prisma.siteSetting.upsert({
    where: { key: COURSE_MEETING_VISIBILITY_KEY },
    update: { value },
    create: { key: COURSE_MEETING_VISIBILITY_KEY, value },
  });
  revalidatePath("/activities", "layout");
}
