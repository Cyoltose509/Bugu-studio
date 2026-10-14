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
import { ActivityStatus, ProposalType, ProposalStatus } from "@prisma/client";
import SubmitProposalForm from "@/components/activities/meeting/SubmitProposalForm";
import DeleteProposalButton from "@/components/activities/meeting/DeleteProposalButton";
import { RichContent } from "@/components/ui/RichContent";
import TrophyIcon from "@/components/icons/TrophyIcon";
import ReviewProposalForm from "@/components/activities/meeting/ReviewProposalForm";
import BilibiliTvLink from "@/components/activities/meeting/BilibiliTvLink";
import { DisbandTeamButton } from "@/components/activities/teams/DisbandTeamButton";
import { LeaveTeamButton } from "@/components/activities/teams/LeaveTeamButton";
import { InvitationButtons } from "@/components/activities/teams/InvitationButtons";
import { CreateTeamForm } from "@/components/activities/teams/CreateTeamForm";
import EditTopicForm from "@/components/activities/course/EditTopicForm";
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

// 活动类型 / 状态 → 双语标签
const ACTIVITY_TYPE_KEYS: Record<string, DictKey> = {
  MEETING:    "activity.type.MEETING",
  COURSE:     "activity.type.COURSE",
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
    return a ? { title: a.title, summary: a.summary, status: a.status } : null;
  }
  return prisma.activity.findUnique({
    where: { id },
    select: { title: true, summary: true, status: true },
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
    title: t(lang, "activityDetail.metaTitle", { title: a.title }),
    description: (a as any).summary || a.title,
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

  const activity = await getActivity(id);

  if (!activity) notFound();

  // 草稿仅管理员可见
  if (activity.status === "DRAFT") {
    const role = session?.user?.role;
    if (role !== "ADMIN") notFound();
  }

  const showcase = activity.type === "GENERAL" ? await getActivityShowcase(id, activity.slug) : null;
  if (showcase?.enabled) {
    return <ActivityShowcasePage activity={activity} config={showcase} isAdmin={session?.user?.role === "ADMIN"} />;
  }

  const isOngoing   = now >= activity.startTime && now <= activity.endTime;
  const isUpcoming  = now < activity.startTime;
  const isPast       = now > activity.endTime;

  // 仅本地：mock / DB 不可达时跳过，勿提交
  const userProposal =
    activity.type === "MEETING" && session?.user && !isMockDataEnabled()
      ? await prisma.meetingProposal
          .findFirst({
            where: { activityId: id, userId: session.user.id },
          })
          .catch(() => null)
      : null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
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
      </div>

      {/* ── 标题区 ──────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface text-brand-blue">
            {activityTypeLabel(lang, activity.type)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activity.status === "PUBLISHED" ? "bg-green-100 text-green-700" :
            activity.status === "DRAFT"      ? "bg-gray-100 text-gray-600" :
                                                       "bg-yellow-100 text-yellow-700"
          }`}>{activityStatusLabel(lang, activity.status)}</span>
          {isOngoing && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t(lang, "activity.ongoing")}</span>}
          {isUpcoming && <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFF3E0] text-brand-orange">{t(lang, "activity.upcoming")}</span>}
          {isPast    && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t(lang, "activity.past")}</span>}
        </div>

        <h1 className="text-3xl font-bold text-brand-navy">{activity.title}</h1>

        <p className="text-sm text-brand-text-secondary">
          📅 {activity.startTime.toLocaleString(dateLocale(lang))} ~ {activity.endTime.toLocaleString(dateLocale(lang))}
          {activity.location ? ` · 📍 ${activity.location}` : ""}
          {activity.meetingUrl ? ` · ${t(lang, "activity.online")}` : ""}
          {activity.registrationOpen ? ` · ${t(lang, "activityDetail.registrationOpen")}` : ""}
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
      {activity.meetingUrl && (
        <div className="mb-6 p-4 rounded-xl border bg-[#F0F8FF] border-brand-border-subtle">
          <span className="text-sm font-medium text-brand-navy">{t(lang, "activityDetail.onlineLink")}</span>
          <a href={activity.meetingUrl} target="_blank" rel="noreferrer" className="text-sm ml-1 hover:underline text-brand-blue">{activity.meetingUrl}</a>
        </div>
      )}

      {/* ── 根据类型渲染 ──────────────────────────── */}
      {activity.type === "MEETING"    && <MeetingSection activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} userProposal={userProposal} lang={lang} />}
      {activity.type === "COURSE"     && <CourseSection  activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} isPast={isPast} lang={lang} />}
      {activity.type === "COMPETITION" && <CompetitionSection activity={activity} session={session} isOngoing={isOngoing} isUpcoming={isUpcoming} isPast={isPast} lang={lang} />}
      {activity.type === "GENERAL"    && <GeneralSection activity={activity} lang={lang} />}
    </div>
  );
}

// ── 例会主讲人：有成员档案 → /members；仅站内用户 → /profile?id=；否则纯文本 ──
function TalkSpeaker({ talk, lang }: { talk: any; lang: Lang }) {
  const name =
    talk.speaker ||
    talk.user?.member?.displayName ||
    talk.user?.name ||
    t(lang, "activityDetail.speakerFallback");
  const memberId = talk.user?.member?.id as string | undefined;
  const userId = (talk.userId || talk.user?.id) as string | undefined;

  if (memberId) {
    return (
      <Link href={`/members/${memberId}`} className="text-brand-navy/80 hover:underline">
        {name}
      </Link>
    );
  }
  if (userId) {
    return (
      <Link href={`/profile?id=${userId}`} className="text-brand-navy/80 hover:underline">
        {name}
      </Link>
    );
  }
  return <span className="text-brand-navy/80">{name}</span>;
}

// ── 议程分享人：头像 + 名字，关联站内账号。有成员档案 → /members；仅站内用户 → /profile?id= ──
function ProposalSpeaker({ proposal, lang }: { proposal: any; lang: Lang }) {
  const user = proposal.user;
  const name =
    user?.member?.displayName ||
    user?.name ||
    t(lang, "activityDetail.speakerFallback");
  const memberId = user?.member?.id as string | undefined;
  const userId = (proposal.userId || user?.id) as string | undefined;

  const inner = (
    <>
      <UserAvatar src={user?.image} name={name} size={24} />
      <span className="text-xs font-medium text-brand-text-heading truncate max-w-[9rem]">{name}</span>
    </>
  );

  const href = memberId ? `/members/${memberId}` : userId ? `/profile?id=${userId}` : null;

  if (href) {
    return (
      <Link
        href={href}
        title={name}
        className="flex items-center gap-1.5 shrink-0 rounded-full pl-2 pr-2.5 py-1 -my-1 hover:bg-brand-surface transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return <span className="flex items-center gap-1.5 shrink-0 pl-2 pr-2.5 py-1 -my-1">{inner}</span>;
}

// ── 例会 ───────────────────────────────────────────────────
async function MeetingSection({
  activity, session, isOngoing, isUpcoming, userProposal, lang,
}: { activity: any; session: any; isOngoing: boolean; isUpcoming: boolean; userProposal: any; lang: Lang }) {
  const talks = activity.talks || [];
  const proposals = activity.proposals || [];
  const isAdmin = (session?.user?.role as string) === "ADMIN" || (session?.user?.role as string) === "SUPER_ADMIN";

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

  return (
    <div className="space-y-6">
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
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 结构化分享条目（主讲 + 标题 + BV）── */}
      {talks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.thisSessionTalks")}</h2>
          <ol className="space-y-2">
            {talks.map((talk: any, i: number) => (
              <li
                key={talk.id}
                className="bg-card rounded-xl border border-brand-border-subtle px-4 py-3 flex items-center gap-3"
              >
                <span className="w-7 h-7 rounded-full bg-brand-surface text-brand-blue text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-text-heading truncate">{talk.title}</p>
                  <p className="text-sm text-brand-text-secondary mt-0.5">
                    <TalkSpeaker talk={talk} lang={lang} />
                    {talk.bvId ? (
                      <span className="text-brand-text-muted"> · {talk.bvId}</span>
                    ) : null}
                  </p>
                </div>
                {talk.bvId ? <BilibiliTvLink bvId={talk.bvId} /> : (
                  <span className="text-xs text-brand-text-muted shrink-0 px-2">{t(lang, "activityDetail.awaitingUpload")}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── 已通过审核的报名分享（始终公开，不再被结构化条目挤掉）── */}
      {approvedProposals.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.agenda")}</h2>
          <div className="space-y-3">
            {approvedProposals.map((p: any) => (
              <div key={p.id} className="bg-card rounded-xl border p-4 border-brand-border-subtle">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-text-heading">{p.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-brand-surface text-brand-blue">
                        {p.proposalType === "SHARE" ? t(lang, "activityDetail.proposalShare") : t(lang, "activityDetail.proposalShowcase")}
                      </span>
                    </div>
                    {p.description && <p className="text-sm mt-1 text-brand-text-body">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ProposalSpeaker proposal={p} lang={lang} />
                    {isAdmin && (
                      <DeleteProposalButton proposalId={p.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(isOngoing || isUpcoming) && (
        <section className="bg-card rounded-xl border p-6 border-brand-border-subtle">
          <h3 className="font-semibold mb-3 text-brand-navy">{t(lang, "activityDetail.signUpShare")}</h3>
          {userProposal ? (
            /* 已提交申请 — 显示状态 */
            <div className="rounded-lg p-4 bg-[#F0F6FA]">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-brand-text-heading">{userProposal.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  userProposal.status === "APPROVED" ? "bg-brand-surface text-green-800" :
                  userProposal.status === "REJECTED" ? "bg-red-50 text-red-700" :
                  "bg-[#FFF8E1] text-[#F57F17]"
                }`}>
                  {userProposal.status === "APPROVED" ? t(lang, "activityDetail.statusApproved") : userProposal.status === "REJECTED" ? t(lang, "activityDetail.statusRejected") : t(lang, "activityDetail.statusPendingReview")}
                </span>
              </div>
              {userProposal.description && <p className="text-xs text-brand-text-secondary">{userProposal.description}</p>}
              {userProposal.status === "REJECTED" && userProposal.adminNote && (
                <p className="text-xs mt-1 text-red-700">{t(lang, "activityDetail.adminNote", { note: userProposal.adminNote })}</p>
              )}
            </div>
          ) : (
            /* 未提交 — 显示表单 */
            <>
              <p className="text-xs mb-3 text-brand-text-secondary">{t(lang, "activityDetail.proposalHint")}</p>
              <SubmitProposalForm activityId={activity.id} />
            </>
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

// ── 普通活动 ─────────────────────────────────────────────
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
