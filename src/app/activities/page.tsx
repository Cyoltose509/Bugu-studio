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

export const metadata: Metadata = { title: "活动 - 布谷工作室" };
export const dynamic = "force-dynamic";

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

const TYPE_LABELS: Record<string, string> = {
  MEETING:    "例会",
  COURSE:     "公开课",
  COMPETITION: "比赛",
  GENERAL:    "普通活动",
};

// ── 倒计时 ──────────────────────────────────────────────────
function Countdown({ startTime }: { startTime: Date }) {
  const now = new Date();
  const diff = startTime.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange">
      {days}天后开始
    </span>
  );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange">
      {hours}小时后开始
    </span>
  );
}

// ── 卡片组件 ──────────────────────────────────────────────
function ActivityCard({ a, badge, countdown }: {
  a: any; badge?: string; countdown?: React.ReactNode;
}) {
  const coverSrc = a.coverImage || DEFAULT_COVER;

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
              {TYPE_LABELS[a.type] || a.type}
            </span>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/80 text-white backdrop-blur-sm">{badge}</span>
            )}
          </div>
          {countdown && (
            <div className="absolute top-2 right-2">{countdown}</div>
          )}
          {a.meetingUrl && (
            <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/30 text-white backdrop-blur-sm">
              🔗 线上
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
            {a.startTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
            {" ~ "}
            {a.endTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
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

function HeroCard({ a, status }: { a: any; status: "ongoing" | "upcoming" | "past" }) {
  const coverSrc = a.coverImage || DEFAULT_COVER;
  const statusBadge = status === "ongoing"
    ? { label: "进行中", cls: "bg-green-500/80" }
    : status === "upcoming"
    ? { label: "即将开始", cls: "bg-orange-400/80" }
    : { label: "已结束", cls: "bg-gray-400/80" };

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
                {TYPE_LABELS[a.type] || a.type}
              </span>
              </div>

              <h2 className="text-2xl font-bold mb-2">
                {a.title}
              </h2>

              <p className="text-sm opacity-90">
                {a.startTime.toLocaleDateString("zh-CN")}
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
function UpcomingItem({ a }: { a: any }) {
  const thumbSrc = a.coverImage || DEFAULT_COVER;
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
                {a.startTime.toLocaleDateString("zh-CN")}
              </p>
            </div>
            <Countdown startTime={a.startTime} />
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
          <h1 className="text-3xl font-bold text-brand-navy">社团活动</h1>
          <p className="mt-2 text-brand-text-secondary">布谷工作室的例会、公开课、比赛与各类活动</p>
        </div>

        {!hasAny && (
          <div className="rounded-xl border border-brand-border-subtle bg-card px-6 py-16 text-center">
            <p className="text-lg font-medium text-brand-navy">暂无公开活动</p>
            <p className="mt-2 text-sm text-brand-text-secondary">
              新的例会、公开课与比赛发布后会出现在这里。
            </p>
          </div>
        )}

        {hero && (
            <section className="mb-12">
              {upcomingList.length > 0 ? (
              <div className="grid lg:grid-cols-5 gap-10">
                <div className="lg:col-span-3">
                  <HeroCard a={hero} status={heroStatus} />
                </div>
                <div className="lg:col-span-2">
                  <h2 className="text-lg font-semibold mb-3 text-brand-navy">即将开始</h2>
                  <div className="space-y-3">
                    {upcomingList.slice(0, 5).map(a => (
                      <UpcomingItem key={a.id} a={a} />
                    ))}
                  </div>
                </div>
              </div>
              ) : (
                <div className="max-w-4xl">
                  <HeroCard a={hero} status={heroStatus} />
                </div>
              )}
            </section>
        )}

        {otherOngoing.length > 0 && (
          <section className="mb-12">
            <SectionTitle emoji="" title="进行中" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {otherOngoing.map((a) => (
                <ActivityCard key={a.id} a={a} badge="进行中" />
              ))}
            </div>
          </section>
        )}

        {safePast.length > 0 && (
            <section>
              <SectionTitle
                  emoji=""
                  title="活动档案"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {safePast.map(a => (
                    <ActivityCard key={a.id} a={a} />
                ))}
              </div>
            </section>
        )}

      </div>  );
}
