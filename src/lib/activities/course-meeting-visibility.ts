import { prisma } from "@/lib/db/prisma";

export const COURSE_MEETING_VISIBILITY_KEY = "course:meeting-visibility";
export const COURSE_MEETING_VISIBILITIES = ["HIDDEN", "MEMBERS", "REGISTERED", "PUBLIC"] as const;
export type CourseMeetingVisibility = typeof COURSE_MEETING_VISIBILITIES[number];

export function parseCourseMeetingVisibility(value: string | null | undefined): CourseMeetingVisibility {
  return COURSE_MEETING_VISIBILITIES.find((option) => option === value) || "HIDDEN";
}

export function canViewCourseMeetingLinks(
  visibility: CourseMeetingVisibility,
  viewer: { id?: string | null; role?: string | null; memberId?: string | null } | null,
): boolean {
  if (viewer?.role === "ADMIN") return true;
  if (visibility === "PUBLIC") return true;
  if (visibility === "REGISTERED") return Boolean(viewer?.id);
  if (visibility === "MEMBERS") return Boolean(viewer?.memberId);
  return false;
}

export async function getCourseMeetingVisibility(): Promise<CourseMeetingVisibility> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: COURSE_MEETING_VISIBILITY_KEY } });
  return parseCourseMeetingVisibility(setting?.value);
}

export function isCourseActivity(type: string): boolean {
  return type === "COURSE" || type === "ENGINE_COURSE";
}

/** Filter before a server component receives the object: its props are serialized into RSC HTML. */
export function redactCourseMeetingLinks<T extends { type: string; meetingUrl?: string | null; courseClasses?: any[] }>(activity: T, canView: boolean): T {
  if (canView || !isCourseActivity(activity.type)) return activity;
  return {
    ...activity,
    meetingUrl: null,
    ...(Array.isArray(activity.courseClasses) ? { courseClasses: activity.courseClasses.map((courseClass) => ({
      ...courseClass,
      lessons: Array.isArray(courseClass.lessons)
        ? courseClass.lessons.map((lesson: any) => ({ ...lesson, meetingUrl: null }))
        : courseClass.lessons,
    })) } : {}),
  } as T;
}
