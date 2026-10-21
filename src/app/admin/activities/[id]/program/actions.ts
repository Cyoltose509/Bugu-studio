"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { parseClock, parseEngineCourseProgram } from "@/lib/activities/engine-course";
import { withoutCourseMediaReferences } from "@/lib/activities/course-media";
import { deleteManyFromR2 } from "@/lib/utils/upload";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { invalidateCourseActivities } from "@/lib/activities/course-showcase-cache";

async function refreshCourse(activityId: string) {
  await invalidateCourseActivities([activityId]);
  revalidatePath(`/admin/activities/${activityId}/program`);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/activities");
}

export async function saveEngineCourseProgram(activityId: string, raw: unknown) {
  await requireAdmin();
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { type: true } });
  if (activity?.type !== "ENGINE_COURSE") return { error: "仅引擎教学公开课可编辑班级" };
  const parsed = parseEngineCourseProgram(raw);
  if ("error" in parsed) return parsed;

  const tagIds = [...new Set(parsed.classes.flatMap((item) => item.tagIds))];
  const projectIds = [...new Set(parsed.classes.flatMap((item) => item.showcase.flatMap((work) => work.projectId ? [work.projectId] : [])))];
  const [tagCount, projectCount] = await Promise.all([
    prisma.tag.count({ where: { id: { in: tagIds } } }),
    prisma.project.count({ where: { id: { in: projectIds } } }),
  ]);
  if (tagCount !== tagIds.length) return { error: "有标签不存在" };
  if (projectCount !== projectIds.length) return { error: "有作品不存在，请重新选择" };

  const authorIds = [...new Set(parsed.classes.flatMap((item) => item.showcase.flatMap((work) => work.authorUserId ? [work.authorUserId] : [])))];
  if (await prisma.user.count({ where: { id: { in: authorIds }, isActive: true } }) !== authorIds.length) return { error: "有作者账号不存在或已停用" };

  const previous = await prisma.courseClass.findMany({ where: { activityId }, select: { scheduleImage: true, coverImage: true, showcase: { select: { imageUrl: true } } } });

  await prisma.$transaction(async (tx) => {
    await tx.courseClass.deleteMany({ where: { activityId } });
    for (const [sortOrder, item] of parsed.classes.entries()) {
      await tx.courseClass.create({
        data: {
          activityId,
          scheduleImage: item.scheduleImage || null,
          name: item.name,
          description: item.description || null,
          coverImage: item.coverImage || null,
          coverFocusX: item.coverFocusX,
          coverFocusY: item.coverFocusY,
          sortOrder,
          tags: { create: item.tagIds.map((tagId) => ({ tagId })) },
          lessons: { create: item.lessons.map((lesson, index) => ({
            instructorName: lesson.instructorName,
            topic: lesson.topic,
            title: lesson.title,
            date: new Date(`${lesson.date}T00:00:00Z`),
            startMinute: parseClock(lesson.startTime),
            endMinute: parseClock(lesson.endTime),
            meetingUrl: lesson.meetingUrl || null,
            videoUrl: lesson.videoUrl || null,
            sortOrder: index,
          })) },
          showcase: { create: item.showcase.map((work, index) => ({
            authorName: work.authorName || "",
            authorUserId: work.authorUserId || null,
            title: work.title,
            imageUrl: work.imageUrl,
            projectId: work.projectId,
            sortOrder: index,
          })) },
        },
      });
    }
  });
  const removedUrls = previous.flatMap((item) => [item.coverImage, item.scheduleImage, ...item.showcase.map((work) => work.imageUrl)]);
  const disposable = await withoutCourseMediaReferences(removedUrls);
  if (disposable.length) deleteManyFromR2(disposable).catch(() => {});
  await refreshCourse(activityId);
  return { success: true };
}

export async function createProjectFromShowcase(activityId: string, classIndex: number, workIndex: number, expectedImageUrl: string, expectedTitle: string) {
  const session = await requireAdmin();
  if (!Number.isInteger(classIndex) || classIndex < 0 || !Number.isInteger(workIndex) || workIndex < 0) return { error: "作品位置无效" };
  const item = await prisma.courseShowcaseItem.findFirst({
    where: { sortOrder: workIndex, imageUrl: expectedImageUrl, title: expectedTitle, courseClass: { activityId, sortOrder: classIndex, activity: { type: "ENGINE_COURSE" } } },
    select: { id: true, title: true, imageUrl: true, projectId: true, authorName: true, authorUserId: true },
  });
  if (!item) return { error: "作品大赏项目不存在" };
  if (item.projectId) {
    const project = await prisma.project.findUnique({ where: { id: item.projectId }, select: { slug: true } });
    if (project) return { success: true, editUrl: `/works/${project.slug}/edit` };
  }
  const author = item.authorUserId ? await prisma.user.findUnique({ where: { id: item.authorUserId }, select: { id: true, member: { select: { id: true } } } }) : null;
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        slug: `course-work-${randomUUID().slice(0, 12)}`,
        title: item.title,
        description: item.title,
        coverImage: item.imageUrl,
        status: "DRAFT",
        type: "IN_DEVELOPMENT",
        developYear: new Date().getFullYear(),
        submitterId: session.user.id,
        members: item.authorName ? { create: [{ memberId: author?.member?.id || null, userId: author && !author.member ? author.id : null, externalName: author ? null : item.authorName, roles: [], sortOrder: 0 }] } : undefined,
      },
    });
    const linked = await tx.courseShowcaseItem.updateMany({ where: { id: item.id, projectId: null }, data: { projectId: created.id } });
    if (linked.count !== 1) throw new Error("该作品已转入作品库，请刷新页面");
    return created;
  });
  await refreshCourse(activityId);
  return { success: true, editUrl: `/works/${project.slug}/edit` };
}
