/**
 * 前台 - 活动首页
 * 卡片网格布局，类似 /works 风格
 */
import { Metadata } from "next";
import Link from "next/link";
import Image from "@/components/ui/SiteImage";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ActivityType, ActivityStatus } from "@prisma/client";
import { isMockDataEnabled, mockActivitiesBuckets } from "@/lib/mock/frontend-data";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";
import ActivityCard, {
  activityTypeLabel,
  ACTIVITY_STATUS_LABEL,
} from "@/components/activities/ActivityCard";
import ActivityCalendar, { BAR_TONE } from "@/components/activities/ActivityCalendar";
import { AgendaTypeTag, AgendaSpeaker, agendaTypeLabel } from "@/components/activities/meeting/AgendaRow";
import PlusIcon from "@/components/ui/PlusIcon";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import { auth } from "@/lib/auth/auth";
import { activityNewestFirstOrder, activityCalendar, formatActivityDay, formatActivitySchedule } from "@/lib/activities/datetime";
import { redactCourseMeetingLinks } from "@/lib/activities/course-meeting-visibility";
import { localizeActivityTitle } from "@/lib/activities/title";
import { recoTagLabel } from "@/lib/activities/recommendation";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "page.activities.title") };
}
export const dynamic = "force-dynamic";

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

// 活动类型 / 状态 → 双语标签（与卡片一起抽到 components/activities/ActivityCard）
const STATUS_LABEL = ACTIVITY_STATUS_LABEL;

// 右侧栏议程条目（只取展示所需字段）
type SidebarSpeakerRow = {
  name: string;
  userId: string | null;
  user: { id: string; image: string | null; member: { id: string; displayName: string } | null } | null;
};
type SidebarTalk = {
  id: string;
  title: string;
  talkType: string;
  speaker: string;
  speakers: SidebarSpeakerRow[];
  user: SidebarSpeakerRow["user"];
};

// ── 倒计时 ──────────────────────────────────────────────────
function Countdown({ startTime, lang }: { startTime: Date; lang: Lang }) {
  const now = new Date();
  const diff = startTime.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange">
      {t(lang, "activities.daysLater").replace("{n}", String(days))}
    </span>
  );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange">
      {t(lang, "activities.hoursLater").replace("{n}", String(hours))}
    </span>
  );
}

function HeroCard({ a, lang, status }: { a: any; lang: Lang; status: "ongoing" | "upcoming" | "past" }) {
  const coverSrc = a.coverImage || DEFAULT_COVER;
  const displayTitle = localizeActivityTitle(a.title, lang);
  const statusBadge = status === "ongoing"
    ? { label: STATUS_LABEL.ongoing[lang], cls: "bg-green-500/80" }
    : status === "upcoming"
    ? { label: STATUS_LABEL.upcoming[lang], cls: "bg-orange-400/80" }
    : { label: STATUS_LABEL.past[lang], cls: "bg-gray-400/80" };
  return (
      <Link href={`/activities/${a.id}`} className="group block">
        <div
            className="overflow-hidden rounded-2xl border border-brand-border-subtle bg-card"
        >
          <div className="relative aspect-[16/9] overflow-hidden">
            <Image
                src={coverSrc}
                alt={displayTitle}
                fill
                className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 896px"
                priority
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            <ActivityTypeCorner type={a.type} label={activityTypeLabel(lang, a.type)} />
            <div className="absolute top-4 right-4">
              <span className={`text-xs px-3 py-1 rounded-full text-white backdrop-blur-sm ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">
                {displayTitle}
              </h2>

              <p className="text-sm opacity-90">
                {a.timePending || !a.startTime ? (lang === "en" ? "TBD" : "待定") : formatActivityDay(a.startTime, lang)}
                {a.location ? ` · ${a.location}` : ""}
              </p>

              {a.summary && (
                  <p className="mt-3 text-sm opacity-90 line-clamp-2">
                    {a.summary}
                  </p>
              )}
            </div>
          </div>
        </div>
      </Link>
  );
}
// ── 右侧栏议程：主推活动没有别的活动占位时，用它填这块空白 ──────────
const AGENDA_PREVIEW_MAX = 6;

/** 讲者展示信息（与详情页 speakerMeta 同规则：有成员页链成员页，否则链个人资料） */
function sidebarSpeakerList(talk: SidebarTalk, lang: Lang) {
  const meta = (name: string, userId: string | null, user: SidebarSpeakerRow["user"]) => {
    const memberId = user?.member?.id;
    const uid = userId ?? user?.id ?? null;
    return {
      name: name || t(lang, "activityDetail.speakerFallback"),
      href: memberId ? `/members/${memberId}` : uid ? `/profile?id=${uid}` : null,
      image: user?.image ?? null,
    };
  };

  if (talk.speakers?.length) return talk.speakers.map((s) => meta(s.name, s.userId, s.user));

  // 没有讲者表记录时退回 speaker 字段，按分隔符拆成多个名字
  const names = (talk.speaker || "").split(/[、,，/]/).map((n) => n.trim()).filter(Boolean);
  return names.map((name, index) => meta(name, null, names.length === 1 && index === 0 ? talk.user : null));
}

function SidebarAgenda({ items, lang, activityId }: {
  items: SidebarTalk[]; lang: Lang; activityId: string;
}) {
  const shown = items.slice(0, AGENDA_PREVIEW_MAX);
  const rest = items.length - shown.length;
  const href = `/activities/${activityId}#meeting-agenda`;

  return (
    <div id="sidebar-agenda" className="flex max-h-[22rem] min-h-0 flex-col lg:max-h-none lg:flex-1">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-navy">{t(lang, "activityDetail.agenda")}</h3>
        <span className="shrink-0 text-xs tabular-nums text-brand-text-muted">
          {t(lang, "activities.agendaItems", { n: items.length })}
        </span>
      </div>
      {/* 与活动详情页同一套时间轴：细线贯穿 + 实心节点，分享蓝、展示橙 */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ol className="relative py-1 pl-1.5">
          <span aria-hidden className="absolute bottom-2 left-[6px] top-2 w-px -translate-x-1/2 rounded bg-brand-border-subtle" />
          {shown.map((talk) => {
            const type = talk.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE";
            const speakers = sidebarSpeakerList(talk, lang);
            return (
              <li key={talk.id} className="relative pb-4 pl-6 last:pb-0">
                <span
                  aria-hidden
                  className={`absolute left-0 top-[7px] h-[11px] w-[11px] -translate-x-1/2 rounded-full ${type === "SHOWCASE" ? "bg-brand-orange" : "bg-brand-blue"}`}
                />
                <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                  <AgendaTypeTag
                    type={type}
                    label={agendaTypeLabel(type, t(lang, "activityDetail.proposalShare"), t(lang, "activityDetail.proposalShowcase"))}
                  />
                  <Link href={href} className="min-w-0 flex-1 line-clamp-2 text-sm font-medium text-brand-text-heading hover:text-brand-blue">
                    {talk.title}
                  </Link>
                </div>
                {speakers.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {speakers.map((speaker, index) => (
                      <AgendaSpeaker
                        key={`${speaker.href || speaker.name}-${index}`}
                        name={speaker.name}
                        href={speaker.href}
                        image={speaker.image}
                        byLabel={index === 0 ? t(lang, "meeting.by") : "&"}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {rest > 0 && (
        <Link href={href} className="mt-2 shrink-0 text-xs font-medium text-brand-blue hover:underline">
          +{rest} · {t(lang, "activityDetail.viewAll")}
        </Link>
      )}
    </div>
  );
}

/** 右侧栏的第二张活动卡：紧凑横排，底边与左侧主活动对齐 */
function SidebarActivityItem({ a, lang }: { a: any; lang: Lang }) {
  const displayTitle = localizeActivityTitle(a.title, lang);
  return (
    <Link href={`/activities/${a.id}`} className="group flex items-center gap-3 rounded-xl border border-brand-border-subtle bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-brand-surface">
        <Image
          src={a.coverImage || DEFAULT_COVER}
          alt={displayTitle}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="96px"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-brand-text-heading group-hover:text-brand-blue">{displayTitle}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-brand-text-muted">
          {a.timePending || !a.startTime ? (lang === "en" ? "TBD" : "待定") : formatActivityDay(a.startTime, lang)}
          {a.location ? ` · ${a.location}` : ""}
        </p>
        {!a.timePending && a.startTime && (
          <div className="mt-1"><Countdown startTime={a.startTime} lang={lang} /></div>
        )}
      </div>
    </Link>
  );
}

// ── 活动推荐卡片：紧凑横排卡，类别小标签 + 倒计时 ────────────
function RecoCard({ a, lang }: { a: any; lang: Lang }) {
  const coverSrc = a.coverImage || DEFAULT_COVER;
  const displayTitle = localizeActivityTitle(a.title, lang);
  const tagLabel = recoTagLabel(lang, a.recoTag);
  const now = Date.now();
  const isLive = !a.timePending && a.startTime && a.endTime &&
    new Date(a.startTime).getTime() <= now && new Date(a.endTime).getTime() >= now;
  return (
    <Link href={`/activities/${a.id}`} className="group snap-start shrink-0 w-[300px]">
      <div className="bg-card rounded-xl border border-brand-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="relative aspect-video overflow-hidden bg-brand-surface shrink-0">
          <Image
            src={coverSrc}
            alt={displayTitle}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="300px"
          />
          {tagLabel && (
            <span className="absolute top-2 left-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/45 text-white backdrop-blur-sm">
              {tagLabel}
            </span>
          )}
          <div className="absolute top-2 right-2">
            {isLive ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full text-white bg-green-500/80 backdrop-blur-sm">{STATUS_LABEL.ongoing[lang]}</span>
            ) : (
              !a.timePending && a.startTime && <Countdown startTime={new Date(a.startTime)} lang={lang} />
            )}
          </div>
        </div>
        {/* 信息区与活动档案卡片一致：标题 / 时间·地点 / 简介，三行固定高度 */}
        <div className="p-3 flex flex-col gap-1 flex-1 min-h-[4.75rem]">
          <h3 className="text-sm font-semibold group-hover:text-brand-blue transition-colors line-clamp-1 text-brand-text-heading">
            {displayTitle}
          </h3>
          <p className="text-xs text-brand-text-muted line-clamp-1">
            {formatActivitySchedule(a.startTime, a.endTime, lang, a.timePending, a.courseHasClock)}
            {a.location ? ` · ${a.location}` : ""}
          </p>
          <p className="text-xs line-clamp-1 text-brand-text-secondary min-h-[1rem]">
            {a.summary || " "}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ── 区间标题 ──────────────────────────────────────────────
function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-brand-navy">
      {emoji ? <span>{emoji}</span> : null} {title}
    </h2>
  );
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { view, month: monthParam } = await searchParams;
  const isCalendar = view === "calendar";
  const now = new Date();
  const lang = await getLang();
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  // 月历月份：?month=YYYY-MM，非法或缺省时取北京时间当前月
  const nowCn = activityCalendar(now);
  let calYear = nowCn.year;
  let calMonth = nowCn.month;
  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthParam ?? "");
  if (monthMatch) {
    calYear = Number(monthMatch[1]);
    calMonth = Number(monthMatch[2]);
  }

  const raw = isMockDataEnabled()
    ? mockActivitiesBuckets()
    : await cachedQuery(
    "activities:list:v3",
    () =>
      Promise.all([
        // 进行中，开始时间从新到旧（活动推荐不进常规桶）
        prisma.activity.findMany({
          where:  { status: ActivityStatus.PUBLISHED, type: { not: ActivityType.RECOMMENDATION }, timePending: false, startTime: { lte: now }, endTime: { gte: now } },
          orderBy: { startTime: "desc" },
          take: 6,
        }),
        // 即将开始：待定是最新一档，其余从新到旧
        prisma.activity.findMany({
          where:  {
            status: ActivityStatus.PUBLISHED,
            type: { not: ActivityType.RECOMMENDATION },
            OR: [{ timePending: true }, { startTime: { gt: now } }],
          },
          orderBy: activityNewestFirstOrder,
          take: 6,
        }),
        // 已结束 / 归档（最近 12 条，从新到旧；推荐类活动过期即隐，不进档案）
        prisma.activity.findMany({
          where: {
            type: { not: ActivityType.RECOMMENDATION },
            OR: [
              { status: ActivityStatus.PUBLISHED, timePending: false, endTime: { lt: now } },
              { status: ActivityStatus.ARCHIVED },
            ],
          },
          orderBy: { endTime: "desc" },
          take: 12,
        }),
        // 活动推荐：仅未结束的（待定视为有效），最新在前
        prisma.activity.findMany({
          where: {
            status: ActivityStatus.PUBLISHED,
            type: ActivityType.RECOMMENDATION,
            OR: [{ timePending: true }, { endTime: { gte: now } }],
          },
          orderBy: activityNewestFirstOrder,
          take: 12,
        }),
      ]),
    60,
  ).catch(() => mockActivitiesBuckets());
  const [ongoing, upcoming, past, recommendations] = Array.isArray(raw) ? raw : [[], [], [], []];
  // 每个子元素也做守卫，防止缓存返回异常数据
  const stripCourseUrl = (activity: any) => redactCourseMeetingLinks(activity, false);
  const safeOngoing  = Array.isArray(ongoing)  ? ongoing.map(stripCourseUrl)  : [];
  const safeUpcoming = Array.isArray(upcoming) ? upcoming.map(stripCourseUrl) : [];
  const safePast     = Array.isArray(past)     ? past.map(stripCourseUrl)     : [];
  const safeReco     = Array.isArray(recommendations) ? recommendations.map(stripCourseUrl) : [];
  const hero =
      safeOngoing[0] ??
      safeUpcoming[0] ??
      safePast[0] ??
      null;

  // 判断 hero 的状态
  const heroStatus: "ongoing" | "upcoming" | "past" =
    safeOngoing[0]?.id === hero?.id ? "ongoing"
    : safeUpcoming[0]?.id === hero?.id ? "upcoming"
    : "past";

  const upcomingList =
      hero && safeUpcoming[0]?.id === hero.id
          ? safeUpcoming.slice(1)
          : safeUpcoming;
  const hasAny = !!(hero || safePast.length || safeOngoing.length || safeUpcoming.length || safeReco.length);
  const otherOngoing =
      hero && heroStatus === "ongoing"
          ? safeOngoing.filter((a) => a.id !== hero.id)
          : safeOngoing;

  // 主推活动的议程：右侧栏空着时用它填内容（只有例会才有逐条议程）
  const heroTalks: SidebarTalk[] = !isCalendar && hero
    ? isMockDataEnabled()
      ? []
      : await cachedQuery(
          `activity:sidebar-talks:${hero.id}`,
          () =>
            prisma.meetingTalk.findMany({
              where: { activityId: hero.id },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                title: true,
                talkType: true,
                speaker: true,
                user: { select: { id: true, image: true, member: { select: { id: true, displayName: true } } } },
                speakers: {
                  orderBy: { sortOrder: "asc" },
                  select: {
                    name: true,
                    userId: true,
                    user: { select: { id: true, image: true, member: { select: { id: true, displayName: true } } } },
                  },
                },
              },
            }),
          60,
        ).catch(() => [] as SidebarTalk[])
    : [];

  // 右侧栏只放一张活动卡，剩下的「即将开始」下移到独立分区，避免信息丢失
  const sidebarActivity = hero ? upcomingList[0] ?? null : null;
  const restUpcoming = upcomingList.slice(sidebarActivity ? 1 : 0);

  // 月历视图：全部已发布/归档活动（含推荐类），取排期与悬浮卡片所需字段，按开始时间升序
  const calendarAllRaw: any[] = isCalendar
    ? isMockDataEnabled()
      ? (mockActivitiesBuckets().flat() as any[])
      : await cachedQuery(
          "activities:calendar:v2",
          () =>
            prisma.activity.findMany({
              where: { status: { in: [ActivityStatus.PUBLISHED, ActivityStatus.ARCHIVED] } },
              select: {
                id: true,
                title: true,
                summary: true,
                type: true,
                status: true,
                location: true,
                meetingUrl: true,
                coverImage: true,
                recoTag: true,
                startTime: true,
                endTime: true,
                timePending: true,
                courseHasClock: true,
              },
              orderBy: { startTime: "asc" },
              take: 500,
            }),
          60,
        ).catch(() => [] as any[])
    : [];
  const calendarAll = calendarAllRaw.map(stripCourseUrl);
  const calendarActivities = calendarAll.filter((a) => !a.timePending && a.startTime);
  const calendarPending = calendarAll.filter((a) => a.timePending || !a.startTime);

  return (
      <div
        data-calendar-page={isCalendar ? "true" : undefined}
        className={
          isCalendar
            ? "flex-1 flex flex-col max-w-[1720px] w-full mx-auto px-3 sm:px-5 pt-2 pb-2 sm:pt-3 sm:pb-3 min-h-0"
            : "container mx-auto px-4 py-10 animate-fade-in"
        }
      >

        {/* 页面头：非日历视图（网格档案）保留顶栏大标题
            标题与按钮同一行（竖屏也如此），简介另起一行，窄屏时缩小字号 */}
        {!isCalendar && (
          <div className="mb-8 shrink-0 sm:mb-10">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <h1 className="min-w-0 text-2xl font-bold leading-tight text-brand-navy sm:text-3xl">
                {t(lang, "page.activities.title")}
              </h1>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/activities?view=calendar"
                  className="w-11 h-11 rounded-xl border border-brand-border-subtle bg-card text-brand-text-secondary hover:border-brand-blue/40 hover:text-brand-blue transition-colors flex items-center justify-center shrink-0"
                  title={t(lang, "activities.calendarView")}
                  aria-label={t(lang, "activities.calendarView")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="17" rx="2.5" />
                    <path d="M3 9h18" />
                    <path d="M8 2v4M16 2v4" />
                  </svg>
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin/activities/create"
                    className="btn-primary brand-add-control shrink-0"
                    title={t(lang, "activities.create")}
                    aria-label={t(lang, "activities.create")}
                  >
                    <PlusIcon size={24} />
                  </Link>
                )}
              </div>
            </div>

            <p className="mt-2 text-sm text-brand-text-secondary sm:text-base">{t(lang, "activities.intro")}</p>
          </div>
        )}

        {isCalendar ? (
          <ActivityCalendar
            activities={calendarActivities}
            pending={calendarPending}
            year={calYear}
            month={calMonth}
            lang={lang}
            isAdmin={isAdmin}
          />
        ) : (
        <>
        {!hasAny && (
          <div className="rounded-xl border border-brand-border-subtle bg-card px-6 py-16 text-center">
            <p className="text-lg font-medium text-brand-navy">{t(lang, "activities.emptyTitle")}</p>
            <p className="mt-2 text-sm text-brand-text-secondary">
              {t(lang, "activities.emptyDesc")}
            </p>
          </div>
        )}

        {hero && (
            <section className="mb-12">
              {sidebarActivity || heroTalks.length > 0 ? (
              <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
                <div className="min-w-0 lg:col-span-3">
                  <HeroCard a={hero} lang={lang} status={heroStatus} />
                </div>
                {/* 右侧栏：上方议程弹性占位，下方活动卡贴住主活动底边 */}
                <div className="min-w-0 lg:col-span-2 lg:flex lg:h-full lg:flex-col lg:gap-4">
                  {heroTalks.length > 0 && (
                    <SidebarAgenda items={heroTalks} lang={lang} activityId={hero.id} />
                  )}
                  {sidebarActivity && (
                    <div className="mt-4 shrink-0 lg:mt-auto">
                      <SidebarActivityItem a={sidebarActivity} lang={lang} />
                    </div>
                  )}
                </div>
              </div>
              ) : (
                <div className="max-w-4xl">
                  <HeroCard a={hero} lang={lang} status={heroStatus} />
                </div>
              )}
            </section>
        )}

        {restUpcoming.length > 0 && (
          <section className="mb-12">
            <SectionTitle emoji="" title={t(lang, "activity.upcoming")} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
              {restUpcoming.map((a) => (
                <ActivityCard key={a.id} a={a} lang={lang} badge="upcoming" />
              ))}
            </div>
          </section>
        )}

        {otherOngoing.length > 0 && (
          <section className="mb-12">
            <SectionTitle emoji="" title={t(lang, "activity.ongoing")} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
              {otherOngoing.map((a) => (
                <ActivityCard key={a.id} a={a} lang={lang} badge="ongoing" />
              ))}
            </div>
          </section>
        )}

        {safeReco.length > 0 && (
          <section className="mb-12">
            <SectionTitle emoji="" title={t(lang, "activities.recommendations")} />
            {/* 一排横排卡片，超出横向滚动；负边距让滚动条贴齐容器 */}
            <div className="reco-scroll -mx-4 px-4 overflow-x-auto overscroll-x-contain pb-2">
              <div className="flex w-max snap-x snap-mandatory gap-4">
                {safeReco.map((a) => (
                  <RecoCard key={a.id} a={a} lang={lang} />
                ))}
              </div>
            </div>
          </section>
        )}

        {safePast.length > 0 && (
            <section>
              <SectionTitle
                  emoji=""
                  title={t(lang, "activities.archive")}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
                {safePast.map(a => (
                    <ActivityCard key={a.id} a={a} lang={lang} />
                ))}
              </div>
            </section>
        )}
        </>
        )}

      </div>  );
}
