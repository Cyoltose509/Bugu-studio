import { prisma } from "@/lib/db/prisma";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";

export async function courseActivityIdsForProject(projectId: string): Promise<string[]> {
  const items = await prisma.courseShowcaseItem.findMany({
    where: { projectId },
    select: { courseClass: { select: { activityId: true } } },
  });
  return [...new Set(items.map((item) => item.courseClass.activityId))];
}

export async function invalidateCourseActivities(activityIds: string[]) {
  await Promise.all(activityIds.map((id) => invalidateCache(`activity:detail:${id}`)));
  activityIds.forEach((id) => revalidatePath(`/activities/${id}`));
}
