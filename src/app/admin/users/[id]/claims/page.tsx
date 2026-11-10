import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import ClaimsPanel, { type ClaimCandidate } from "./ClaimsPanel";

export const dynamic = "force-dynamic";

export default async function UserClaimsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string; error?: string; success?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, image: true, member: { select: { displayName: true } } } });
  if (!user) notFound();
  const name = (query.name ?? user.member?.displayName ?? user.name ?? "").trim().slice(0, 80);
  let candidates: ClaimCandidate[] = [];
  if (name) {
    const match = { equals: name, mode: "insensitive" as const };
    const [projects, courses, speakers, talks, showcases] = await Promise.all([
      prisma.projectMember.findMany({ where: { externalName: match, userId: null, memberId: null }, include: { project: { select: { title: true, subtitle: true, slug: true, coverImage: true } } }, orderBy: { sortOrder: "asc" } }),
      prisma.courseParticipant.findMany({ where: { externalName: match, userId: null, memberId: null }, include: { activity: { select: { title: true, coverImage: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.meetingTalkSpeaker.findMany({ where: { name: match, userId: null }, include: { talk: { select: { title: true, activityId: true, activity: { select: { title: true, coverImage: true } } } } }, orderBy: { createdAt: "desc" } }),
      prisma.meetingTalk.findMany({ where: { speaker: match, userId: null, speakers: { none: {} } }, include: { activity: { select: { title: true, coverImage: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.courseShowcaseItem.findMany({ where: { authorName: match, authorUserId: null }, include: { courseClass: { select: { name: true, activityId: true, activity: { select: { title: true } } } } }, orderBy: { createdAt: "desc" } }),
    ]);
    candidates = [
      ...projects.map((item) => ({ key: `project:${item.id}`, kind: "作品成员", name: item.externalName!, title: item.project.title, subtitle: item.project.subtitle, coverImage: item.project.coverImage, href: `/works/${item.project.slug}` })),
      ...courses.map((item) => ({ key: `course:${item.id}`, kind: "公开课讲师", name: item.externalName!, title: item.activity.title, subtitle: "公开课讲师", coverImage: item.activity.coverImage, href: `/activities/${item.activityId}` })),
      ...speakers.map((item) => ({ key: `speaker:${item.id}`, kind: "例会主讲", name: item.name, title: item.talk.activity.title, subtitle: `分享：${item.talk.title}`, coverImage: item.talk.activity.coverImage, href: `/activities/${item.talk.activityId}` })),
      ...talks.map((item) => ({ key: `talk:${item.id}`, kind: "例会主讲（旧记录）", name: item.speaker, title: item.activity.title, subtitle: `分享：${item.title}`, coverImage: item.activity.coverImage, href: `/activities/${item.activityId}` })),
      ...showcases.map((item) => ({ key: `showcase:${item.id}`, kind: "课程作品作者", name: item.authorName, title: item.title, subtitle: `${item.courseClass.activity.title} · ${item.courseClass.name}`, coverImage: item.imageUrl, href: `/activities/${item.courseClass.activityId}` })),
    ];
  }

  return <ClaimsPanel user={user} name={name} candidates={candidates} error={query.error} success={query.success} />;
}
