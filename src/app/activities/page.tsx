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
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "page.activities.title") };
}
export const dynamic = "force-dynamic";

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

// 活动类型 / 状态 → 双语标签
const ACTIVITY_TYPE_KEYS: Record<string, "activity.type.MEETING" | "activity.type.COURSE" | "activity.type.COMPETITION" | "activity.type.GENERAL"> = {
  MEETING:     "activity.type.MEETING",
  COURSE:      "activity.type.COURSE",
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
function dateLocale(lang: Lang): string {
  return lang === "en" ? "en-US" : "zh-CN";
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
  const locale = dateLocale(lang);

  return (
    <Link href={`/activities/${a.id}`} className="group">
      <div className="bg-card rounded-xl border border-brand-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-all">

        {/* 封面图 */}
        <div className="relative aspect-video overflow-hidden bg-brand-surface">
          <Image
            src={coverSrc}
            alt={a.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {/* 类型标签 + 状态 */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
              {activityTypeLabel(lang, a.type)}
            </span>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/80 text-white backdrop-blur-sm">{STATUS_LABEL[badge][lang]}</span>
            )}
          </div>
          {countdown && (
            <div className="absolute top-2 right-2">{countdown}</div>
          )}
          {a.meetingUrl && (
            <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/30 text-white backdrop-blur-sm">
              {t(lang, "activity.online")}
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="p-3 space-y-1">
          {/* 标题 */}
          <h3 className="text-sm font-semibold group-hover:text-brand-blue transition-colors line-clamp-1 text-brand-text-heading">
            {a.title}
          </h3>

          {/* 时间 */}
          <p className="text-xs text-brand-text-muted">
            {a.startTime.toLocaleDateString(locale, { month: "short", day: "numeric" })}
            {" ~ "}
            {a.endTime.toLocaleDateString(locale, { month: "short", day: "numeric" })}
            {a.location ? ` · ${a.location}` : ""}
          </p>

          {/* 一句话简介 */}
          {a.summary && (
            <p className="text-xs line-clamp-1 text-brand-text-secondary">{a.summary}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function HeroCard({ a, lang, status }: { a: any; lang: Lang; status: "ongoing" | "upcoming" | "past" }) {
  const coverSrc = a.coverImage || DEFAULT_COVER;
  const statusBadge = status === "ongoing"
    ? { label: STATUS_LABEL.ongoing[lang], cls: "bg-green-500/80" }
    : status === "upcoming"
    ? { label: STATUS_LABEL.upcoming[lang], cls: "bg-orange-400/80" }
    : { label: STATUS_LABEL.past[lang], cls: "bg-gray-400/80" };
  const locale = dateLocale(lang);

  return (
      <Link href={`/activities/${a.id}`} className="group block">
        <div
            className="overflow-hidden rounded-2xl border border-brand-border-subtle bg-card"
        >
          <div className="relative aspect-[16/9] overflow-hidden">
            <Image
                src={coverSrc}
                alt={a.title}
                fill
                className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 896px"
                priority
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            {/* 状态角标 — 右上 */}
            <div className="absolute top-4 right-4">
              <span className={`text-xs px-3 py-1 rounded-full text-white backdrop-blur-sm ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="mb-2">
              <span className="text-xs px-2 py-1 rounded-full bg-white/20 backdrop-blur">
                {activityTypeLabel(lang, a.type)}
              </span>
              </div>

              <h2 className="text-2xl font-bold mb-2">
                {a.title}
              </h2>

              <p className="text-sm opacity-90">
                {a.startTime.toLocaleDateString(locale)}
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
  const locale = dateLocale(lang);
  return (
      <Link href={`/activities/${a.id}`}>
        <div
            className="rounded-xl border border-brand-border-subtle p-3 hover:bg-slate-50 transition-colors flex gap-3"
        >
          {/* 缩略图 */}
          <div className="w-14 h-10 rounded-md overflow-hidden shrink-0 relative bg-brand-surface">
            <Image src={thumbSrc} alt="" fill className="object-cover" sizes="56px" />
          </div>

          <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-sm line-clamp-1 text-brand-text-heading">
                {a.title}
              </h3>
              <p className="text-xs mt-1 text-brand-text-muted">
                {a.startTime.toLocaleDateString(locale)}
              </p>
            </div>
            <Countdown startTime={a.startTime} lang={lang} />
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

  const raw = isMockDataEnabled()
    ? mockActivitiesBuckets()
    : await cachedQuery(
    "activities:list",
    () =>
      Promise.all([
        // 进行中
        prisma.activity.findMany({
          where:  { status: ActivityStatus.PUBLISHED, startTime: { lte: now }, endTime: { gte: now } },
          orderBy: { startTime: "asc" },
          take: 6,
        }),
        // 即将开始
        prisma.activity.findMany({
          where:  { status: ActivityStatus.PUBLISHED, startTime: { gt: now } },
          orderBy: { startTime: "asc" },
          take: 6,
        }),
        // 已结束 / 归档（最近 12 条）
        prisma.activity.findMany({
          where: {
            OR: [
              { status: ActivityStatus.PUBLISHED, endTime: { lt: now } },
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
  const safeOngoing  = Array.isArray(ongoing)  ? ongoing  : [];
  const safeUpcoming = Array.isArray(upcoming) ? upcoming : [];
  const safePast     = Array.isArray(past)     ? past     : [];
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
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-brand-navy">{t(lang, "page.activities.title")}</h1>
          <p className="mt-2 text-brand-text-secondary">{t(lang, "activities.intro")}</p>
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
                  <h2 className="text-lg font-semibold mb-3 text-brand-navy">{t(lang, "activities.upcoming")}</h2>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {safePast.map(a => (
                    <ActivityCard key={a.id} a={a} lang={lang} />
                ))}
              </div>
            </section>
        )}

      </div>  );
}
