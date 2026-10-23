/**
 * 前台 - 活动详情页（流式渲染）
 * 根据活动类型动态渲染不同内容
 */

import { Metadata, ResolvingMetadata } from "next";
import { cache, Suspense } from "react";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { ProposalStatus } from "@prisma/client";
import SubmitProposalForm from "@/components/activities/meeting/SubmitProposalForm";
import DeleteProposalButton from "@/components/activities/meeting/DeleteProposalButton";
import { RichContent } from "@/components/ui/RichContent";
import TrophyIcon from "@/components/icons/TrophyIcon";
import ReviewProposalForm from "@/components/activities/meeting/ReviewProposalForm";
import BilibiliTvLink from "@/components/activities/meeting/BilibiliTvLink";
import AgendaManagePanel from "@/components/activities/meeting/AgendaManagePanel";
import { AgendaSpeaker, AgendaTypeTag, agendaTypeLabel } from "@/components/activities/meeting/AgendaRow";
import { DisbandTeamButton } from "@/components/activities/teams/DisbandTeamButton";
import { LeaveTeamButton } from "@/components/activities/teams/LeaveTeamButton";
import { InvitationButtons } from "@/components/activities/teams/InvitationButtons";
import { CreateTeamForm } from "@/components/activities/teams/CreateTeamForm";
import EditTopicForm from "@/components/activities/course/EditTopicForm";
import CourseMaterials from "@/components/activities/course/CourseMaterials";
import EngineCoursePage from "@/components/activities/course/EngineCoursePage";
import { canViewCourseMeetingLinks, getCourseMeetingVisibility, isCourseActivity, redactCourseMeetingLinks } from "@/lib/activities/course-meeting-visibility";
import SubmitToWorksButton from "@/components/activities/submit/SubmitToWorksButton";
import { cachedQuery } from "@/lib/db/cache";
import UserAvatar from "@/components/ui/UserAvatar";
import LogoLoading from "@/components/ui/LogoLoading";
import { resolveActivityId } from "@/lib/activities/resolve";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import { getActivityShowcase } from "@/lib/activities/showcase-data";
import ActivityShowcasePage from "@/components/activities/showcase/ActivityShowcasePage";
import { isMockDataEnabled, mockActivityByKey } from "@/lib/mock/frontend-data";
import { getLang } from "@/lib/i18n/getLang";
import { t, type DictKey } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import ShareButton from "@/components/share/ShareButton";
import { activityShareData, shareDescription, shareMetadata } from "@/lib/share";
import { canSubmitActivityTalk, hasActivityTalkSection } from "@/lib/activities/capabilities";
import { activityPhase, formatActivitySchedule } from "@/lib/activities/datetime";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";

// 活动类型 / 状态 → 双语标签
const ACTIVITY_TYPE_KEYS: Record<string, DictKey> = {
  MEETING:    "activity.type.MEETING",
  COURSE:     "activity.type.COURSE",
  ENGINE_COURSE: "activity.type.ENGINE_COURSE",
  COMPETITION: "activityDetail.typeCompetition",
  GENERAL:    "activity.type.GENERAL",
};

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

const ACTIVITY_STATUS_KEYS: Record<string, DictKey> = {
  DRAFT:     "work.badge.DRAFT",
  PUBLISHED: "activityDetail.statusPublished",
  ARCHIVED:  "common.archived",
};

function activityTypeLabel(lang: Lang, type: string): string {
  const k = ACTIVITY_TYPE_KEYS[type];
  return k ? t(lang, k) : type;
}

function activityStatusLabel(lang: Lang, status: string): string {
  const k = ACTIVITY_STATUS_KEYS[status];
  return k ? t(lang, k) : status;
}

function dateLocale(lang: Lang): string {
  return lang === "en" ? "en-US" : "zh-CN";
}

interface PageProps {
  params:  Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/* ── 极轻量 metadata 查询（仅 select，无 include，不阻塞首字节）── */

const getActivityMeta = cache(async (key: string) => {
  const id = await resolveActivityId(key);
  if (!id) return null;
  if (isMockDataEnabled()) {
    const a = mockActivityByKey(id);
    return a ? { id: a.id, title: a.title, summary: a.summary, status: a.status, coverImage: a.coverImage } : null;
  }
  return prisma.activity.findUnique({
    where: { id },
    select: { id: true, title: true, summary: true, status: true, coverImage: true },
  });
});

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id: key } = await params;
  const lang = await getLang();
  const a = await getActivityMeta(key);
  if (!a || a.status === "DRAFT") return { title: t(lang, "activityDetail.metaNotFound") };
  return {
    ...shareMetadata({ kind: "activity", title: a.title, summary: shareDescription(a.summary), path: `/activities/${a.id}`, image: a.coverImage }),
    title: t(lang, "activityDetail.metaTitle", { title: a.title }),
  };
}

/* ── 主页面数据查询（React.cache + cachedQuery，含全部 include）── */

const talkInclude = {
  orderBy: { sortOrder: "asc" as const },
  include: {
    user: {
      select: {
        id: true,
        name: true,
        image: true,
        member: { select: { id: true, displayName: true } },
      },
    },
  },
};

const getActivity = cache(async (id: string) => {
  if (isMockDataEnabled()) {
    return mockActivityByKey(id);
  }
  try {
    return await cachedQuery(
      `activity:detail:${id}`,
      () =>
        prisma.activity.findUnique({
          where:  { id },
          include: {
            proposals:   { where: { status: ProposalStatus.APPROVED }, include: { user: { select: { id: true, name: true, image: true, member: { select: { id: true, displayName: true } } } } } },
            talks:       talkInclude,
            jamTeams: {
              include: {
                members: { include: { user: { select: { id: true, name: true, image: true } } } },
                _count: { select: { members: true } },
              },
            },
            jamJudges: { include: { user: { select: { id: true, name: true, image: true } } } },
            courseParticipants: {
              orderBy: { sortOrder: "asc" },
              include: { member: { select: { id: true, displayName: true, avatar: true, user: { select: { image: true } } } } },
            },
            courseAttachments: { orderBy: { sortOrder: "asc" } },
            courseClasses: {
              orderBy: { sortOrder: "asc" },
              include: {
                tags: { include: { tag: true } },
                lessons: { orderBy: { sortOrder: "asc" } },
                showcase: { orderBy: { sortOrder: "asc" }, include: { project: { select: { slug: true, status: true } } } },
              },
            },
            jamSubmissions: {
              select: {
                id: true,
                title: true,
                projectId: true,
                teamId: true,
                team: { select: { name: true } },
                scores: { select: { totalScore: true } },
              },
            },
          },
        }),
      120,
    );
  } catch {
    // 仅本地：DB 不可达时降级，勿提交
    return mockActivityByKey(id);
  }
});

/* ── 同步 Shell：首字节 < 50ms ── */

export default async function ActivityDetailPage({ params }: PageProps) {
  const lang = await getLang();
  return (
    <Suspense fallback={<LogoLoading text={t(lang, "activityDetail.loading")} compact />}>
      <ActivityDetailContent params={params} />
    </Suspense>
  );
}

/* ── 异步数据组件（在 Suspense 内执行，流式加载）── */

async function ActivityDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lang = await getLang();
  const { id: key } = await params;
  const id = await resolveActivityId(key);
  if (!id) notFound();
  const now = new Date();

  const rawActivity = await getActivity(id);

  if (!rawActivity) notFound();

  // 草稿仅管理员可见
  if (rawActivity.status === "DRAFT") {
    const role = session?.user?.role;
    if (role !== "ADMIN") notFound();
  }

  const courseMeetingVisibility = isCourseActivity(rawActivity.type)
    ? await getCourseMeetingVisibility().catch(() => "HIDDEN" as const)
    : "PUBLIC" as const;
  const canViewMeetingLinks = !isCourseActivity(rawActivity.type) || canViewCourseMeetingLinks(courseMeetingVisibility, session?.user || null);
  // Server-component props also appear in the RSC payload. Strip protected URLs
  // before passing the activity to any component, including cards and dialogs.
  const activity = redactCourseMeetingLinks(rawActivity, canViewMeetingLinks);

  const phase = activityPhase(activity, now);
  const isOngoing   = phase === "ongoing";
  const isUpcoming  = phase === "upcoming";
  const isPast       = phase === "past";
  const shareData = activityShareData(activity, lang);
  const isAdmin = session?.user?.role === "ADMIN";
  // 管理员需要能在议程为空时直接打开管理面板，预先编排任何类型的活动。
  const hasTalkSection = hasActivityTalkSection(activity) || isAdmin;

  // 仅本地：mock / DB 不可达时跳过，勿提交
  const userProposal =
    hasTalkSection && activity.type !== "ENGINE_COURSE" && session?.user && !isMockDataEnabled()
      ? await prisma.meetingProposal
          .findFirst({
            where: { activityId: id, userId: session.user.id },
          })
          .catch(() => null)
      : null;

  const showcase = activity.type === "GENERAL" ? await getActivityShowcase(id, activity.slug) : null;
  if (showcase?.enabled) {
    return <>
      <ActivityShowcasePage activity={activity} config={showcase} isAdmin={session?.user?.role === "ADMIN"} />
      {hasTalkSection && <div className="mx-auto max-w-4xl px-4 py-8"><ActivityTalkSection activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} userProposal={userProposal} lang={lang} /></div>}
    </>;
  }

  if (activity.type === "ENGINE_COURSE") {
    const course = activity as any;
    const engineActivity = {
      id: course.id, title: course.title, summary: course.summary, description: course.description,
      coverImage: course.coverImage, courseCoverFocusX: course.courseCoverFocusX ?? 50, courseCoverFocusY: course.courseCoverFocusY ?? 50,
      startTime: course.startTime, endTime: course.endTime, timePending: course.timePending, courseHasClock: course.courseHasClock,
      meetingUrl: course.meetingUrl,
      courseParticipants: (course.courseParticipants || []).map((person: any) => ({
        role: person.role, externalName: person.externalName,
        member: person.member ? { id: person.member.id, displayName: person.member.displayName, avatar: person.member.avatar, user: person.member.user ? { image: person.member.user.image } : null } : null,
      })),
      courseAttachments: (course.courseAttachments || []).map((file: any) => ({ id: file.id, name: file.name, url: file.url, mimeType: file.mimeType, sizeBytes: file.sizeBytes })),
      courseClasses: (course.courseClasses || []).map((item: any) => ({
        id: item.id, scheduleImage: item.scheduleImage, name: item.name, description: item.description, coverImage: item.coverImage, coverFocusX: item.coverFocusX, coverFocusY: item.coverFocusY,
        tags: (item.tags || []).map((row: any) => ({ tag: { id: row.tag.id, name: row.tag.name, slug: row.tag.slug, color: row.tag.color, group: row.tag.group } })),
        lessons: (item.lessons || []).map((lesson: any) => ({ id: lesson.id, instructorName: lesson.instructorName, topic: lesson.topic, title: lesson.title, date: lesson.date, startMinute: lesson.startMinute, endMinute: lesson.endMinute, meetingUrl: lesson.meetingUrl, videoUrl: lesson.videoUrl })),
        showcase: (item.showcase || []).map((work: any) => ({ id: work.id, authorName: work.authorName, title: work.title, imageUrl: work.imageUrl, project: work.project ? { slug: work.project.slug, status: work.project.status } : null })),
      })),
    };
    return <EngineCoursePage activity={engineActivity} canViewMeetingLinks={canViewMeetingLinks} isAdmin={isAdmin} lang={lang} shareData={activity.status !== "DRAFT" ? shareData : null} />;
  }

  const mainColumn = (
    <>
      {/* ── 封面图 ──────────────────────────────────── */}
      <div className="mb-6 rounded-xl overflow-hidden relative aspect-video bg-brand-surface">
        <Image
          src={activity.coverImage || DEFAULT_COVER}
          alt={activity.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 896px"
          priority
        />
        <ActivityTypeCorner type={activity.type} label={activityTypeLabel(lang, activity.type)} />
      </div>

      {/* ── 标题区 ──────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activity.status === "PUBLISHED" ? "bg-green-100 text-green-700" :
            activity.status === "DRAFT"      ? "bg-gray-100 text-gray-600" :
                                                       "bg-yellow-100 text-yellow-700"
          }`}>{activityStatusLabel(lang, activity.status)}</span>
          {isOngoing && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t(lang, "activity.ongoing")}</span>}
          {isUpcoming && <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFF3E0] text-brand-orange">{t(lang, "activity.upcoming")}</span>}
          {isPast    && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t(lang, "activity.past")}</span>}
        </div>

        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-bold text-brand-navy">{activity.title}</h1>
          {activity.status !== "DRAFT" && <ShareButton data={shareData} />}
        </div>

        <p className="text-sm text-brand-text-secondary">
          📅 {formatActivitySchedule(activity.startTime, activity.endTime, lang, activity.timePending, activity.courseHasClock)}
          {activity.location ? ` · 📍 ${activity.location}` : ""}
          {canViewMeetingLinks && activity.meetingUrl ? ` · ${t(lang, "activity.online")}` : ""}
        </p>

        {activity.summary && (
            <p className="text-base text-brand-text-body">
              <RichContent text={activity.summary} />
            </p>
        )}
      </div>

      {/* ── 详细描述 ────────────────────────────────── */}
      {activity.description && (
        <div className="prose max-w-none mb-4 text-brand-text-heading">
          <RichContent text={activity.description} />
        </div>
      )}

      {/* ── 线上链接 ────────────────────────────────── */}
      {canViewMeetingLinks && activity.meetingUrl && (
        <div className="mb-6 p-4 rounded-xl border bg-[#F0F8FF] border-brand-border-subtle">
          <span className="text-sm font-medium text-brand-navy">{t(lang, "activityDetail.onlineLink")}</span>
          <a href={activity.meetingUrl} target="_blank" rel="noreferrer" className="text-sm ml-1 hover:underline text-brand-blue">{activity.meetingUrl}</a>
        </div>
      )}

      {activity.type === "COURSE"     && <CourseSection  activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} isPast={isPast} lang={lang} />}
      {activity.type === "COMPETITION" && <CompetitionSection activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} isPast={isPast} lang={lang} />}
      {activity.type === "GENERAL"    && <GeneralSection activity={activity} lang={lang} />}
    </>
  );

  const talkColumn = hasTalkSection ? (
    <ActivityTalkSection
      activity={activity}
      session={session}
      isOngoing={isOngoing}
      isUpcoming={isUpcoming}
      userProposal={userProposal}
      lang={lang}
    />
  ) : null;

  // 有议程/报名时：宽屏左主右窄；窄屏单列叠放
  if (hasTalkSection) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:items-start">
          <div className="min-w-0">{mainColumn}</div>
          <aside className="min-w-0 xl:sticky xl:top-24">
            {talkColumn}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      {mainColumn}
    </div>
  );
}

function speakerMeta(entity: any, lang: Lang, preferSpeakerField = false) {
  const user = entity.user;
  const name = preferSpeakerField
    ? entity.speaker || user?.member?.displayName || user?.name || t(lang, "activityDetail.speakerFallback")
    : user?.member?.displayName || user?.name || t(lang, "activityDetail.speakerFallback");
  const memberId = user?.member?.id as string | undefined;
  const userId = (entity.userId || user?.id) as string | undefined;
  const href = memberId ? `/members/${memberId}` : userId ? `/profile?id=${userId}` : null;
  return { name, href, image: (user?.image as string | undefined) || null };
}

// ── 例会 ───────────────────────────────────────────────────
async function ActivityTalkSection({
  activity, session, isOngoing, isUpcoming, userProposal, lang,
}: { activity: any; session: any; isOngoing: boolean; isUpcoming: boolean; userProposal: any; lang: Lang }) {
  const talks = activity.talks || [];
  const proposals = activity.proposals || [];
  const isAdmin = session?.user?.role === "ADMIN";

  // 管理员把某条已通过申请整理成结构化条目后，标题会对上；按标题去重，避免同一分享显示两遍
  const talkTitles = new Set(
    talks.map((tk: any) => String(tk.title || "").trim().toLowerCase()).filter(Boolean),
  );
  const approvedProposals = proposals.filter(
    (p: any) => !talkTitles.has(String(p.title || "").trim().toLowerCase()),
  );

  // 仅本地：管理员待审列表在 DB 不可达时跳过，勿提交
  let pendingProposals: any[] = [];
  if (isAdmin && !isMockDataEnabled()) {
    pendingProposals = await prisma.meetingProposal
      .findMany({
        where: { activityId: activity.id, status: ProposalStatus.PENDING },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, image: true } } },
      })
      .catch(() => []);
  }

  const hasAgendaItems = talks.length > 0 || approvedProposals.length > 0;

  return (
    <div id="meeting-agenda" className="scroll-mt-28 space-y-6">
      {/* ── 管理员审核待处理的申请 ──────────────── */}
      {isAdmin && pendingProposals.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-brand-orange">{t(lang, "activityDetail.pendingProposals")}</h2>
          <div className="space-y-3">
            {pendingProposals.map((p: any) => (
              <ReviewProposalForm
                key={p.id}
                proposalId={p.id}
                title={p.title}
                userName={p.user.name}
                createdAt={p.createdAt.toLocaleDateString(dateLocale(lang))}
                description={p.description}
                imageUrl={p.imageUrl}
              />
            ))}
          </div>
        </section>
      )}

      {(isAdmin || hasAgendaItems) && (
        <AgendaManagePanel
          activityId={activity.id}
          isAdmin={isAdmin}
          title={t(lang, "activityDetail.agenda")}
          unlistedProposals={approvedProposals.map((p: any) => ({
            id: p.id,
            title: p.title,
            speaker:
              p.user?.member?.displayName ||
              p.user?.name ||
              t(lang, "activityDetail.speakerFallback"),
            proposalType: p.proposalType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
          }))}
          initialTalks={talks.map((tk: any) => ({
            id: tk.id,
            speaker: tk.speaker,
            title: tk.title,
            talkType: tk.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
            bvId: tk.bvId || "",
            userId: tk.userId || null,
            image: tk.user?.image || null,
            linkedLabel: tk.userId
              ? tk.user?.member
                ? t(lang, "meetingTalks.linkedMember", { name: tk.user.member.displayName })
                : t(lang, "meetingTalks.linkedUser", { name: tk.user?.name || tk.userId })
              : null,
          }))}
        >
          {hasAgendaItems ? (
          <ol className="rounded-xl border border-brand-border-subtle bg-card divide-y divide-brand-border-subtle">
            {talks.map((talk: any) => {
              const speaker = speakerMeta(talk, lang, true);
              const type = talk.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE";
              return (
                <li key={talk.id} className="group flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 transition-colors hover:bg-brand-surface/60 focus-within:bg-brand-surface/60">
                  <AgendaTypeTag
                    type={type}
                    label={agendaTypeLabel(type, t(lang, "activityDetail.proposalShare"), t(lang, "activityDetail.proposalShowcase"))}
                  />
                  <p className="min-w-0 flex-1 text-sm font-medium text-brand-navy md:line-clamp-1 md:group-hover:line-clamp-none md:group-focus-within:line-clamp-none">{talk.title}</p>
                  {talk.bvId ? <BilibiliTvLink bvId={talk.bvId} /> : null}
                  <AgendaSpeaker
                    name={speaker.name}
                    href={speaker.href}
                    image={speaker.image}
                    byLabel={t(lang, "meeting.by")}
                  />
                </li>
              );
            })}
            {approvedProposals.map((p: any) => {
              const speaker = speakerMeta(p, lang);
              const type = p.proposalType === "SHOWCASE" ? "SHOWCASE" : "SHARE";
              return (
                <li key={p.id} className="group rounded-lg px-3.5 py-2.5 transition-colors hover:bg-brand-surface/60 focus-within:bg-brand-surface/60">
                  <div className="flex items-center gap-2.5">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : null}
                    <AgendaTypeTag
                      type={type}
                      label={agendaTypeLabel(type, t(lang, "activityDetail.proposalShare"), t(lang, "activityDetail.proposalShowcase"))}
                    />
                    <p className="min-w-0 flex-1 text-sm font-medium text-brand-navy md:line-clamp-1 md:group-hover:line-clamp-none md:group-focus-within:line-clamp-none">{p.title}</p>
                    <AgendaSpeaker
                      name={speaker.name}
                      href={speaker.href}
                      image={speaker.image}
                      byLabel={t(lang, "meeting.by")}
                    />
                    {isAdmin && <DeleteProposalButton proposalId={p.id} />}
                  </div>
                  {p.description && (
                    <p className="mt-2 ml-[3.25rem] whitespace-pre-wrap text-sm leading-6 text-brand-text-secondary md:max-h-0 md:overflow-hidden md:opacity-0 md:transition-[max-height,opacity] md:duration-300 md:group-hover:max-h-96 md:group-hover:opacity-100 md:group-focus-within:max-h-96 md:group-focus-within:opacity-100">{p.description}</p>
                  )}
                </li>
              );
            })}
          </ol>
          ) : null}
        </AgendaManagePanel>
      )}

      {(isOngoing || isUpcoming) && canSubmitActivityTalk(activity) && (
        <section id="meeting-signup" className="scroll-mt-28 bg-card rounded-xl border px-3.5 py-3 border-brand-border-subtle">
          {userProposal ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-brand-navy">{t(lang, "activityDetail.signUpShare")}</h3>
                <AgendaTypeTag
                  type={userProposal.proposalType}
                  label={agendaTypeLabel(
                    userProposal.proposalType,
                    t(lang, "activityDetail.proposalShare"),
                    t(lang, "activityDetail.proposalShowcase"),
                  )}
                />
                <span className={`ml-auto shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                  userProposal.status === "APPROVED" ? "agenda-chip-share" :
                  userProposal.status === "REJECTED" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                  "agenda-chip-showcase"
                }`}>
                  {userProposal.status === "APPROVED" ? t(lang, "activityDetail.statusApproved") : userProposal.status === "REJECTED" ? t(lang, "activityDetail.statusRejected") : t(lang, "activityDetail.statusPendingReview")}
                </span>
              </div>
              <p className="text-sm font-medium text-brand-navy">{userProposal.title}</p>
              {userProposal.description && <p className="text-xs text-brand-text-secondary">{userProposal.description}</p>}
              {userProposal.status === "REJECTED" && userProposal.adminNote && (
                <p className="text-xs text-red-600 dark:text-red-400">{t(lang, "activityDetail.adminNote", { note: userProposal.adminNote })}</p>
              )}
            </div>
          ) : session?.user ? (
            <SubmitProposalForm activityId={activity.id} />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-brand-navy">{t(lang, "activityDetail.signUpShare")}</h3>
              <Link href={`/auth/login?callbackUrl=${encodeURIComponent(`/activities/${activity.id}#meeting-signup`)}`} className="btn-primary shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold">{lang === "en" ? "Sign in" : "登录后报名"}</Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── 公开课（队伍制）─────────────────────────────────────────────
async function CourseSection({
  activity, session, isOngoing, isUpcoming, isPast, lang,
}: { activity: any; session: any; isOngoing: boolean; isUpcoming: boolean; isPast: boolean; lang: Lang }) {
  const activityId = activity.id;
  const userId = session?.user?.id;
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

  const myTeam = activity.jamTeams?.find((t: any) =>
    t.members.some((m: any) => m.userId === userId)
  ) || null;

  const isJudge = activity.jamJudges?.some((j: any) => j.userId === userId);

  let myInvitations: any[] = [];
  // 仅本地：DB 不可达时跳过邀请查询，勿提交
  if (userId && !myTeam && !isMockDataEnabled()) {
    myInvitations = await prisma.jamTeamInvitation
      .findMany({
        where: { inviteeId: userId, status: "PENDING", team: { activityId } },
        include: { team: true, inviter: { select: { name: true } } },
      })
      .catch(() => []);
  }

  const jamJudges = activity.jamJudges || [];
  const jamTeams = activity.jamTeams || [];

  return (
    <div className="space-y-6" id="jam">
      {/* ── 阶段状态 & 课题 ──────────────────── */}
      <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy">{t(lang, "activityDetail.courseTitle")}</h2>
            <p className="text-sm mt-1 text-brand-text-secondary">
              {isUpcoming && t(lang, "activityDetail.courseUpcoming")}
              {isOngoing && t(lang, "activityDetail.courseOngoing")}
              {isPast && t(lang, "activityDetail.coursePast")}
            </p>
          </div>
          {isAdmin && (
            <Link
              href={`/activities/${activityId}/course/judging`}
              className="text-xs px-3 py-1.5 rounded-lg border border-brand-border-subtle text-brand-text-body"
            >{t(lang, "activityDetail.manageJudging")}</Link>
          )}
        </div>

        {activity.theme && (
          <div className="mt-4 p-4 rounded-lg bg-[#FFFDF7] border border-[#FFF3E0]">
            <p className="text-sm font-semibold text-brand-orange">{t(lang, "activityDetail.topicLabel")}</p>
            <p className="text-sm mt-1 whitespace-pre-wrap text-brand-text-body">{activity.theme}</p>
          </div>
        )}
      </div>

      <CourseMaterials
        lang={lang}
        instructors={(activity.courseParticipants || [])
          .filter((item: any) => item.role === "INSTRUCTOR")
          .map((item: any) => ({
            id: item.member?.id || null,
            displayName: item.member?.displayName || item.externalName || "",
            avatar: item.member?.avatar || item.member?.user?.image || null,
          }))}
        students={(activity.courseParticipants || [])
          .filter((item: any) => item.role === "STUDENT")
          .map((item: any) => ({
            id: item.member?.id || null,
            displayName: item.member?.displayName || item.externalName || "",
            avatar: item.member?.avatar || item.member?.user?.image || null,
          }))}
        attachments={(activity.courseAttachments || []).map((file: any) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        }))}
      />

      {/* ── 我的队伍 ──────────────────────────── */}
      {myTeam ? (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-navy">{t(lang, "activityDetail.myTeam", { name: myTeam.name })}</h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams/${myTeam.id}`}
                className="text-xs px-3 py-1.5 rounded-lg text-white bg-brand-blue"
              >{t(lang, "activityDetail.manageTeam")}</Link>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {myTeam.members.map((m: any) => (
              <span key={m.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#F0F6FA] text-brand-navy">
                <UserAvatar src={m.user.image} name={m.user.name} size={24} />
                {m.user.name}
                {m.role === "LEADER" && <span className="text-brand-orange">👑</span>}
              </span>
            ))}
          </div>

          {/* 讲题设置（队长+进行中/未开始） */}
          {(isUpcoming || isOngoing) && myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) && (
            <div className="p-3 rounded-lg mb-3 bg-[#F0F6FA]">
              <p className="text-xs font-medium mb-2 text-brand-navy">{t(lang, "activityDetail.teamTopic")}</p>
              <EditTopicForm teamId={myTeam.id} activityId={activityId} currentTopic={myTeam.topic} />
            </div>
          )}
          {myTeam.topic && !myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) && (
            <div className="p-3 rounded-lg mb-3 bg-[#F0F6FA]">
              <p className="text-xs text-brand-navy">{t(lang, "activityDetail.topicInline")}<span className="font-medium">{myTeam.topic}</span></p>
            </div>
          )}

          {/* 退出/解散 */}
          {(isUpcoming || isOngoing) && (
            <div className="flex gap-2">
              {myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) ? (
                <DisbandTeamButton teamId={myTeam.id} activityId={activityId} />
              ) : (
                <LeaveTeamButton teamId={myTeam.id} activityId={activityId} />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.formTeamRegister")}</h3>
          
          {myInvitations.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-brand-orange">{t(lang, "activityDetail.teamInvitations")}</p>
              {myInvitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F0F6FA]">
                  <div>
                    <span className="text-sm font-medium text-brand-navy">{inv.team.name}</span>
                    <span className="text-xs ml-2 text-brand-text-muted">{t(lang, "activityDetail.invitationFrom", { name: inv.inviter.name })}</span>
                  </div>
                  <InvitationButtons invitationId={inv.id} activityId={activityId} />
                </div>
              ))}
            </div>
          )}

          {userId && !myTeam && (isUpcoming || isOngoing) && (
            <div className="flex gap-3 flex-wrap">
              <Link
                href={`/activities/${activityId}/game-jam/teams`}
                className="text-sm px-4 py-2 rounded-lg text-white bg-brand-blue"
              >{t(lang, "activityDetail.viewTeams")}</Link>
              <CreateTeamForm activityId={activityId} />
            </div>
          )}
        </div>
      )}

      {/* ── 所有队伍 ───────────────────────────── */}
      {jamTeams.length > 0 && (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-navy">
              {t(lang, "activityDetail.joinedTeams", { n: jamTeams.length })}
            </h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams`}
              className="text-xs hover:underline text-brand-blue"
            >{t(lang, "activityDetail.viewAll")}</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {jamTeams.map((team: any) => (
              <Link
                key={team.id}
                href={`/activities/${activityId}/game-jam/teams/${team.id}`}
                className={`p-3 rounded-lg hover:bg-gray-50 transition-colors border-2 ${
                  myTeam?.id === team.id ? "border-brand-blue" : "border-brand-border-subtle"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm truncate text-brand-navy">{team.name}</span>
                  {myTeam?.id === team.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full text-white shrink-0 ml-1 bg-brand-blue text-[10px]">{t(lang, "activityDetail.mine")}</span>
                  )}
                </div>
                {team.topic && (
                  <p className="text-xs truncate mb-1 text-brand-orange">📝 {team.topic}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                  <span>👑 {team.members.find((m: any) => m.role === "LEADER")?.user?.name || "?"}</span>
                  <span>· {t(lang, "activityDetail.memberCountInline", { n: team._count.members })}</span>
                </div>
                <div className="flex mt-2 gap-1">
                  {team.members.slice(0, 5).map((m: any) => (
                    <UserAvatar key={m.id} src={m.user.image} name={m.user.name} size={24} />
                  ))}
                  {team._count.members > 5 && (
                    <span className="text-xs self-center text-brand-text-muted">+{team._count.members - 5}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 评委列表 ─────────────────────────── */}
      {jamJudges.length > 0 && (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.judges")}</h3>
          <div className="flex flex-wrap gap-2">
            {jamJudges.map((j: any) => (
              <span key={j.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-[#F0F6FA] text-brand-navy">
                <UserAvatar src={j.user.image} name={j.user.name} size={24} /> {j.user.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 评审入口 ──────────────────────────── */}
      {isJudge && isPast && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/course/judging`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold bg-gradient-to-br from-brand-blue to-[#55AADD]"
          >{t(lang, "activityDetail.enterJudging")}</Link>
        </div>
      )}

      {/* ── 结果页入口 ──────────────────────────── */}
      {activity.status === "ARCHIVED" && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/results`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold bg-gradient-to-br from-brand-orange to-[#FFB347]"
          >{t(lang, "activityDetail.viewScoreResults")}</Link>
        </div>
      )}
    </div>
  );
}

// ── Game Jam / 比赛 ───────────────────────────────────────
async function CompetitionSection({
  activity, session, isOngoing, isUpcoming, isPast, lang,
}: {
  activity: any; session: any;
  isOngoing: boolean; isUpcoming: boolean; isPast: boolean; lang: Lang;
}) {
  const activityId = activity.id;
  const userId = session?.user?.id;
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";
  const now = new Date();
  const themeRevealed = activity.themeRevealedAt ? now >= activity.themeRevealedAt : isOngoing || isPast;

  const myTeam = activity.jamTeams?.find((t: any) =>
    t.members.some((m: any) => m.userId === userId)
  ) || null;

  const isJudge = activity.jamJudges?.some((j: any) => j.userId === userId);

  let myInvitations: any[] = [];
  // 仅本地：DB 不可达时跳过邀请查询，勿提交
  if (userId && !myTeam && !isMockDataEnabled()) {
    myInvitations = await prisma.jamTeamInvitation
      .findMany({
        where: { inviteeId: userId, status: "PENDING", team: { activityId } },
        include: { team: true, inviter: { select: { name: true } } },
      })
      .catch(() => []);
  }

  const jamSubmissions = activity.jamSubmissions || [];
  const jamJudges = activity.jamJudges || [];
  const jamTeams = activity.jamTeams || [];

  return (
    <div className="space-y-6" id="jam">
      {/* ── 阶段状态 & 题目 ──────────────────── */}
      <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy"><TrophyIcon size={18} className="mr-1.5 align-[-0.18em]" />Game Jam</h2>
            <p className="text-sm mt-1 text-brand-text-secondary">
              {isUpcoming && t(lang, "activityDetail.jamUpcoming")}
              {isOngoing && t(lang, "activityDetail.jamOngoing")}
              {isPast && t(lang, "activityDetail.jamPast")}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link
                href={`/activities/${activityId}/game-jam/judging`}
                className="text-xs px-3 py-1.5 rounded-lg border border-brand-border-subtle text-brand-text-body"
              >
                {t(lang, "activityDetail.manageJudging")}
              </Link>
            )}
          </div>
        </div>

        {/* 题目 */}
        {activity.theme && themeRevealed && (
          <div className="mt-4 p-4 rounded-lg bg-[#FFFDF7] border border-[#FFF3E0]">
            <p className="text-sm font-semibold text-brand-orange">{t(lang, "activityDetail.jamTheme")}</p>
            <p className="text-sm mt-1 whitespace-pre-wrap text-brand-text-body">{activity.theme}</p>
          </div>
        )}
      </div>

      {/* ── 我的队伍 ──────────────────────────── */}
      {myTeam ? (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-navy">{t(lang, "activityDetail.myTeam", { name: myTeam.name })}</h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams/${myTeam.id}`}
              className="text-xs px-3 py-1.5 rounded-lg text-white bg-brand-blue"
            >
              {t(lang, "activityDetail.manageTeam")}
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {myTeam.members.map((m: any) => (
              <span key={m.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#F0F6FA] text-brand-navy">
                <UserAvatar src={m.user.image} name={m.user.name} size={24} />
                {m.user.name}
                {m.role === "LEADER" && <span className="text-brand-orange">👑</span>}
              </span>
            ))}
            {myTeam._count.members < 5 && (
              <span className="text-xs px-2 py-1 rounded-full text-brand-text-muted border border-dashed border-brand-border-subtle">
                {t(lang, "activityDetail.emptySlot")}
              </span>
            )}
          </div>

          {/* 提交作品 & 解散 */}
          {(isUpcoming || isOngoing) && (
            <div className="mt-4 flex gap-2">
              {myTeam.members.some((m: any) => m.role === "LEADER" && m.userId === userId) ? (
                <DisbandTeamButton teamId={myTeam.id} activityId={activityId} />
              ) : (
                <LeaveTeamButton teamId={myTeam.id} activityId={activityId} />
              )}
              {isOngoing && (
                <Link
                  href={`/activities/${activityId}/game-jam/submit`}
                  className="text-xs px-3 py-1.5 rounded-lg text-white bg-brand-navy"
                >
                  {jamSubmissions.some((s: any) => s.teamId === myTeam.id) ? t(lang, "activityDetail.editWork") : t(lang, "form.submitWork")}
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.formTeam")}</h3>

          {/* 待处理邀请 */}
          {myInvitations.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-brand-orange">{t(lang, "activityDetail.teamInvitations")}</p>
              {myInvitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F0F6FA]">
                  <div>
                    <span className="text-sm font-medium text-brand-navy">{inv.team.name}</span>
                    <span className="text-xs ml-2 text-brand-text-muted">{t(lang, "activityDetail.invitationFrom", { name: inv.inviter.name })}</span>
                  </div>
                  <InvitationButtons invitationId={inv.id} activityId={activityId} />
                </div>
              ))}
            </div>
          )}

          {userId && !myTeam && (isUpcoming || isOngoing) && (
            <div className="flex gap-3 flex-wrap">
              <Link
                href={`/activities/${activityId}/game-jam/teams`}
                className="text-sm px-4 py-2 rounded-lg text-white bg-brand-blue"
              >
                {t(lang, "activityDetail.viewTeams")}
              </Link>
              <CreateTeamForm activityId={activityId} />
            </div>
          )}
        </div>
      )}

      {/* ── 所有参赛队伍 ───────────────────────── */}
      {jamTeams.length > 0 && (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-navy">
              {t(lang, "activityDetail.joinedTeams", { n: jamTeams.length })}
            </h3>
            <Link
              href={`/activities/${activityId}/game-jam/teams`}
              className="text-xs hover:underline text-brand-blue"
            >
              {t(lang, "activityDetail.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {jamTeams.map((team: any) => (
              <Link
                key={team.id}
                href={`/activities/${activityId}/game-jam/teams/${team.id}`}
                className={`p-3 rounded-lg hover:bg-gray-50 transition-colors border-2 ${
                  myTeam?.id === team.id ? "border-brand-blue" : "border-brand-border-subtle"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm truncate text-brand-navy">{team.name}</span>
                  {myTeam?.id === team.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0 ml-1 bg-brand-blue">{t(lang, "activityDetail.mine")}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                  <span>👑 {team.members.find((m: any) => m.role === "LEADER")?.user?.name || "?"}</span>
                  <span>· {t(lang, "activityDetail.memberCountInline", { n: team._count.members })}</span>
                </div>
                <div className="flex mt-2 gap-1">
                  {team.members.slice(0, 5).map((m: any) => (
                    <UserAvatar key={m.id} src={m.user.image} name={m.user.name} size={24} />
                  ))}
                  {team._count.members > 5 && (
                    <span className="text-xs self-center text-brand-text-muted">+{team._count.members - 5}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 评委列表 ─────────────────────────── */}
      {jamJudges.length > 0 && (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.judges")}</h3>
          <div className="flex flex-wrap gap-2">
            {jamJudges.map((j: any) => (
              <span key={j.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-[#F0F6FA] text-brand-navy">
                <UserAvatar src={j.user.image} name={j.user.name} size={24} /> {j.user.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 参赛作品 ───────────────────────────── */}
      {(isPast || isAdmin || isJudge) && jamSubmissions.length > 0 && (
        <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.jamEntries", { n: jamSubmissions.length })}</h3>
          <div className="grid gap-3">
            {jamSubmissions.map((sub: any) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-brand-border-subtle"
              >
                <Link
                  href={`/activities/${activityId}/game-jam/judging`}
                  className="flex-1 min-w-0"
                >
                  <span className="text-sm font-medium text-brand-navy">{sub.title}</span>
                  <span className="text-xs ml-2 text-brand-text-muted">— {sub.team?.name || t(lang, "activityDetail.unknownTeam")}</span>
                </Link>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {sub.projectId ? (
                    <Link
                      href={`/works/${sub.projectId}`}
                      target="_blank"
                      className="text-xs hover:underline text-brand-blue"
                    >
                      {t(lang, "activityDetail.workPage")}
                    </Link>
                  ) : (
                    <SubmitToWorksButton
                      activityId={activityId}
                      submissionId={sub.id}
                      title={sub.title}
                    />
                  )}
                  <div className="text-right min-w-[60px]">
                    {sub.scores.length > 0 ? (
                      <span className="text-sm font-semibold text-brand-orange">
                        {t(lang, "activityDetail.scorePoints", { n: Math.round(sub.scores.reduce((a: number, b: any) => a + b.totalScore, 0) / sub.scores.length) })}
                      </span>
                    ) : (
                      <span className="text-xs text-brand-text-muted">{t(lang, "activityDetail.pendingScore")}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 结果页入口 ──────────────────────────── */}
      {activity.status === "ARCHIVED" && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/results`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold bg-gradient-to-br from-brand-orange to-[#FFB347]"
          >{t(lang, "activityDetail.viewJamResults")}</Link>
        </div>
      )}

      {/* ── 评委入口 ────────────────────────────── */}
      {isJudge && isPast && (
        <div className="text-center">
          <Link
            href={`/activities/${activityId}/game-jam/judging`}
            className="inline-block text-sm px-6 py-3 rounded-lg text-white font-semibold bg-gradient-to-br from-brand-blue to-[#55AADD]"
          >{t(lang, "activityDetail.enterJudging")}</Link>
        </div>
      )}
    </div>
  );
}

// ── 大事件 ─────────────────────────────────────────────
function GeneralSection({ activity, lang }: { activity: any; lang: Lang }) {
  return (
    <div className="bg-card rounded-xl border p-6 border-brand-border-subtle">
      <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.generalTitle")}</h3>
      <p className="text-sm text-brand-text-body">
        {t(lang, "activityDetail.generalDesc")}
      </p>
    </div>
  );
}
