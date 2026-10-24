/**
 * 前台 - 活动首页
 * 卡片网格布局，类似 /works 风格
 */
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ActivityType, ActivityStatus } from "@prisma/client";
import { isMockDataEnabled, mockActivitiesBuckets } from "@/lib/mock/frontend-data";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import { auth } from "@/lib/auth/auth";
import { activityNewestFirstOrder, formatActivityDay, formatActivitySchedule } from "@/lib/activities/datetime";
import { redactCourseMeetingLinks } from "@/lib/activities/course-meeting-visibility";
import { localizeActivityTitle } from "@/lib/activities/title";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "page.activities.title") };
}
export const dynamic = "force-dynamic";

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

// 活动类型 / 状态 → 双语标签
const ACTIVITY_TYPE_KEYS: Record<string, "activity.type.MEETING" | "activity.type.COURSE" | "activity.type.ENGINE_COURSE" | "activity.type.COMPETITION" | "activity.type.GENERAL"> = {
  MEETING:     "activity.type.MEETING",
  COURSE:      "activity.type.COURSE",
  ENGINE_COURSE: "activity.type.ENGINE_COURSE",
  COMPETITION: "activity.type.COMPETITION",
  GENERAL:     "activity.type.GENERAL",
};
const STATUS_LABEL: Record<string, { cn: string; en: string }> = {
  ongoing:  { cn: "进行中", en: "Ongoing" },
  upcoming: { cn: "即将开始", en: "Upcoming" },
  past:     { cn: "已结束", en: "Ended" },
};
function activityTypeLabel(lang: Lang, type: string): string {
  const k = ACTIVITY_TYPE_KEYS[type];
  return k ? t(lang, k) : type;
}

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

// ── 卡片组件 ──────────────────────────────────────────────
function ActivityCard({ a, lang, badge, countdown }: {
  a: any; lang: Lang; badge?: "ongoing" | "upcoming" | "past"; countdown?: React.ReactNode;
}) {
  const coverSrc = a.coverImage || DEFAULT_COVER;
  const displayTitle = localizeActivityTitle(a.title, lang);

  return (
    <Link href={`/activities/${a.id}`} className="group h-full">
      <div className="bg-card rounded-xl border border-brand-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col">

        {/* 封面图 */}
        <div className="relative aspect-video overflow-hidden bg-brand-surface shrink-0">
          <Image
            src={coverSrc}
            alt={displayTitle}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <ActivityTypeCorner type={a.type} label={activityTypeLabel(lang, a.type)} />
          {(badge || countdown) && (
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
              {badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full text-white backdrop-blur-sm ${
                  badge === "past" ? "bg-black/50" : "bg-green-500/80"
                }`}>{STATUS_LABEL[badge][lang]}</span>
              )}
              {countdown}
            </div>
          )}
          {a.meetingUrl && a.type !== "COURSE" && a.type !== "ENGINE_COURSE" && (
            <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/30 text-white backdrop-blur-sm">
              {t(lang, "activity.online")}
            </div>
          )}
        </div>

        {/* 信息区：固定三行，避免有/无简介、地点长短导致卡片高低不一 */}
        <div className="p-3 flex flex-col gap-1 flex-1 min-h-[4.75rem]">
          <h3 className="text-sm font-semibold group-hover:text-brand-blue transition-colors line-clamp-1 text-brand-text-heading">
            {displayTitle}
          </h3>
          <p className="text-xs text-brand-text-muted line-clamp-1">
            {formatActivitySchedule(a.startTime, a.endTime, lang, a.timePending, a.courseHasClock)}
            {a.location ? ` · ${a.location}` : ""}
          </p>
          <p className="text-xs line-clamp-1 text-brand-text-secondary min-h-[1rem]">
            {a.summary || "\u00A0"}
          </p>
        </div>
      </div>
    </Link>
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
function UpcomingItem({ a, lang }: { a: any; lang: Lang }) {
  const thumbSrc = a.coverImage || DEFAULT_COVER;
  const displayTitle = localizeActivityTitle(a.title, lang);
  return (
      <Link href={`/activities/${a.id}`} className="group block">
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-brand-border-subtle bg-brand-surface shadow-sm">
          <Image src={thumbSrc} alt={displayTitle} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" sizes="(max-width: 1280px) 50vw, 360px" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <ActivityTypeCorner type={a.type} label={activityTypeLabel(lang, a.type)} />
          <div className="absolute right-3 top-3">
            {!a.timePending && a.startTime ? <Countdown startTime={a.startTime} lang={lang} /> : (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">{lang === "en" ? "TBD" : "待定"}</span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="min-w-0">
              <h3 className="text-base font-semibold line-clamp-2">{displayTitle}</h3>
              <p className="mt-1 text-xs text-white/80">
                {a.timePending || !a.startTime ? (lang === "en" ? "TBD" : "待定") : formatActivityDay(a.startTime, lang)}
              </p>
            </div>
            {a.summary ? <p className="mt-2 text-xs leading-relaxed text-white/80 line-clamp-2">{a.summary}</p> : null}
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

export default async function ActivitiesPage() {
  const now = new Date();
  const lang = await getLang();
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const raw = isMockDataEnabled()
    ? mockActivitiesBuckets()
    : await cachedQuery(
    "activities:list:v2",
    () =>
      Promise.all([
        // 进行中，开始时间从新到旧
        prisma.activity.findMany({
          where:  { status: ActivityStatus.PUBLISHED, timePending: false, startTime: { lte: now }, endTime: { gte: now } },
          orderBy: { startTime: "desc" },
          take: 6,
        }),
        // 即将开始：待定是最新一档，其余从新到旧
        prisma.activity.findMany({
          where:  {
            status: ActivityStatus.PUBLISHED,
            OR: [{ timePending: true }, { startTime: { gt: now } }],
          },
          orderBy: activityNewestFirstOrder,
          take: 6,
        }),
        // 已结束 / 归档（最近 12 条，从新到旧）
        prisma.activity.findMany({
          where: {
            OR: [
              { status: ActivityStatus.PUBLISHED, timePending: false, endTime: { lt: now } },
              { status: ActivityStatus.ARCHIVED },
            ],
          },
          orderBy: { endTime: "desc" },
          take: 12,
        }),
      ]),
    60,
  ).catch(() => mockActivitiesBuckets());
  const [ongoing, upcoming, past] = Array.isArray(raw) ? raw : [[], [], []];
  // 每个子元素也做守卫，防止缓存返回异常数据
  const stripCourseUrl = (activity: any) => redactCourseMeetingLinks(activity, false);
  const safeOngoing  = Array.isArray(ongoing)  ? ongoing.map(stripCourseUrl)  : [];
  const safeUpcoming = Array.isArray(upcoming) ? upcoming.map(stripCourseUrl) : [];
  const safePast     = Array.isArray(past)     ? past.map(stripCourseUrl)     : [];
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
  const hasAny = !!(hero || safePast.length || safeOngoing.length || safeUpcoming.length);
  const otherOngoing =
      hero && heroStatus === "ongoing"
          ? safeOngoing.filter((a) => a.id !== hero.id)
          : safeOngoing;

  return (
      <div className="container mx-auto px-4 py-10 animate-fade-in">

        {/* 页面头 */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-brand-navy">{t(lang, "page.activities.title")}</h1>
            <p className="mt-2 text-brand-text-secondary">{t(lang, "activities.intro")}</p>
          </div>
          {isAdmin && (
            <Link
              href="/admin/activities/create"
              className="btn-primary shrink-0 w-11 h-11 rounded-xl text-[1.75rem] font-light leading-none flex items-center justify-center"
              title={t(lang, "activities.create")}
              aria-label={t(lang, "activities.create")}
            >
              +
            </Link>
          )}
        </div>

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
              {upcomingList.length > 0 ? (
              <div className="grid lg:grid-cols-5 gap-10">
                <div className="lg:col-span-3">
                  <HeroCard a={hero} lang={lang} status={heroStatus} />
                </div>
                <div className="lg:col-span-2">
                  <div className="space-y-3">
                    {upcomingList.slice(0, 5).map(a => (
                      <UpcomingItem key={a.id} a={a} lang={lang} />
                    ))}
                  </div>
                </div>
              </div>
              ) : (
                <div className="max-w-4xl">
                  <HeroCard a={hero} lang={lang} status={heroStatus} />
                </div>
              )}
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

      </div>  );
}
