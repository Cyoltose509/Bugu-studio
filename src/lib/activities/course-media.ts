import { prisma } from "@/lib/db/prisma";

/** R2 images reused by a course remain owned by the course even after a linked work changes or disappears. */
export async function withoutCourseMediaReferences(urls: (string | null | undefined)[]): Promise<string[]> {
  const candidates = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  if (!candidates.length) return [];
  const [showcase, covers, attachments, activities, projects, images] = await Promise.all([
    prisma.courseShowcaseItem.findMany({ where: { imageUrl: { in: candidates } }, select: { imageUrl: true } }),
    prisma.courseClass.findMany({ where: { OR: [{ coverImage: { in: candidates } }, { scheduleImage: { in: candidates } }] }, select: { coverImage: true, scheduleImage: true } }),
    prisma.courseAttachment.findMany({ where: { url: { in: candidates } }, select: { url: true } }),
    prisma.activity.findMany({ where: { coverImage: { in: candidates } }, select: { coverImage: true } }),
    prisma.project.findMany({ where: { coverImage: { in: candidates } }, select: { coverImage: true } }),
    prisma.projectImage.findMany({ where: { url: { in: candidates } }, select: { url: true } }),
  ]);
  const retained = new Set([...showcase.map((item) => item.imageUrl), ...covers.flatMap((item) => [item.coverImage, item.scheduleImage]), ...attachments.map((item) => item.url), ...activities.map((item) => item.coverImage), ...projects.map((item) => item.coverImage), ...images.map((item) => item.url)]);
  return candidates.filter((url) => !retained.has(url));
}
