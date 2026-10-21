/**
 * 管理后台 - 编辑活动
 */

import { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { getActivityShowcase } from "@/lib/activities/showcase-data";
import { formatActivityClock, formatActivityDateTime } from "@/lib/activities/datetime";
import EditActivityForm from "./EditActivityForm";
import type { TalkDraft } from "@/components/activities/meeting/MeetingTalksEditor";

interface PageProps {
  params: Promise<{ id: string }>;
}

const getActivity = cache(async (id: string) => {
  return prisma.activity.findUnique({
    where: { id },
    include: {
      talks: {
        orderBy: { sortOrder: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              member: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      courseParticipants: {
        orderBy: { sortOrder: "asc" },
        include: { member: { select: { id: true, displayName: true, avatar: true } } },
      },
      courseAttachments: { orderBy: { sortOrder: "asc" } },
    },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const a = await getActivity(id);
  return { title: a ? `编辑 — ${a.title}` : "编辑活动" };
}

export default async function EditActivityPage({ params }: PageProps) {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();

  const [showcase, projects] = await Promise.all([
    getActivityShowcase(activity.id, activity.slug),
    prisma.project.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true }, orderBy: { title: "asc" } }),
  ]);

  const fmt = formatActivityDateTime;
  const talks: TalkDraft[] = activity.talks.map((t) => ({
    id: t.id,
    speaker: t.speaker,
    title: t.title,
    talkType: (t as { talkType?: string }).talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
    bvId: t.bvId || "",
    userId: t.userId || null,
    linkedLabel: t.userId
      ? (t as { user?: { member?: { displayName: string }; name?: string | null } }).user?.member
        ? `已关联成员 · ${(t as { user?: { member?: { displayName: string } } }).user?.member?.displayName}`
        : `已关联用户 · ${(t as { user?: { name?: string | null } }).user?.name || t.userId}`
      : null,
  }));

  return (
    <div className="animate-fade-in">
      <EditActivityForm
        activity={{
          id: activity.id,
          title: activity.title,
          type: activity.type,
          status: activity.status,
          summary: activity.summary || "",
          description: activity.description || "",
          location: activity.location || "",
          meetingUrl: activity.meetingUrl || "",
          coverImage: activity.coverImage || "",
          startTime: activity.startTime ? fmt(activity.startTime) : "",
          endTime: activity.endTime ? fmt(activity.endTime) : "",
          timePending: activity.timePending,
          courseHasClock: activity.courseHasClock,
          startClock: activity.startTime && activity.courseHasClock ? formatActivityClock(activity.startTime) : "",
          endClock: activity.endTime && activity.courseHasClock && formatActivityClock(activity.endTime) !== "23:59" ? formatActivityClock(activity.endTime) : "",
          courseCoverFocusX: activity.courseCoverFocusX,
          courseCoverFocusY: activity.courseCoverFocusY,
          maxParticipants: activity.maxParticipants || "",
          talkSubmissionOpen: activity.talkSubmissionOpen,
          theme: activity.theme || "",
          themeRevealedAt: activity.themeRevealedAt ? fmt(activity.themeRevealedAt) : "",
          maxTeamSize: activity.maxTeamSize ?? 6,
        }}
        talks={talks}
        showcase={showcase}
        projects={projects}
        courseParticipants={activity.courseParticipants.map((item) => ({
          memberId: item.memberId,
          externalName: item.externalName,
          role: item.role === "INSTRUCTOR" ? "INSTRUCTOR" as const : "STUDENT" as const,
          displayName: item.member?.displayName || item.externalName || "",
          avatar: item.member?.avatar || null,
        }))}
        courseAttachments={activity.courseAttachments.map((file) => ({
          name: file.name,
          url: file.url,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        }))}
      />
    </div>
  );
}
