import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { formatClock, type EngineCourseClassDraft } from "@/lib/activities/engine-course";
import ProgramEditor from "./ProgramEditor";

export default async function EngineCourseProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [activity, tags, authors] = await Promise.all([
    prisma.activity.findUnique({
      where: { id },
      include: { courseParticipants: { where: { role: "INSTRUCTOR" }, include: { member: { select: { displayName: true } } } }, courseClasses: {
        orderBy: { sortOrder: "asc" },
        include: {
          tags: true,
          lessons: { orderBy: { sortOrder: "asc" } },
          showcase: { orderBy: { sortOrder: "asc" } },
        },
      } },
    }),
    prisma.tag.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true, color: true, group: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, member: { select: { displayName: true } } } }),
  ]);
  if (!activity || activity.type !== "ENGINE_COURSE") notFound();
  const classes: EngineCourseClassDraft[] = activity.courseClasses.map((item) => ({
    scheduleImage: item.scheduleImage || "",
    name: item.name,
    description: item.description || "",
    coverImage: item.coverImage || "",
    coverFocusX: item.coverFocusX,
    coverFocusY: item.coverFocusY,
    tagIds: item.tags.map((tag) => tag.tagId),
    lessons: item.lessons.map((lesson) => ({
      instructorName: lesson.instructorName,
      topic: lesson.topic,
      title: lesson.title,
      date: lesson.date.toISOString().slice(0, 10),
      startTime: formatClock(lesson.startMinute),
      endTime: formatClock(lesson.endMinute),
      meetingUrl: lesson.meetingUrl || "",
      videoUrl: lesson.videoUrl || "",
    })),
    showcase: item.showcase.map((work) => ({ title: work.title, imageUrl: work.imageUrl, projectId: work.projectId, authorName: work.authorName, authorUserId: work.authorUserId })),
  }));
  const instructors = activity.courseParticipants.map((person) => person.member?.displayName || person.externalName).filter((name): name is string => Boolean(name));
  return <ProgramEditor activityId={id} activityTitle={activity.title} initialClasses={classes} tags={tags} authors={authors.map((user) => ({ id: user.id, name: user.member?.displayName || user.name || "未命名用户" }))} instructors={instructors} />;
}
