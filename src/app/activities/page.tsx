/**
 * 前台 - 活动首页
 * 卡片网格布局，类似 /works 风格
 */
import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ActivityType, ActivityStatus } from "@prisma/client";

export const metadata: Metadata = { title: "活动 - 布谷工作室" };
export const dynamic = "force-dynamic";

const DEFAULT_COVER = "/images/default_pic.png";

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
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#E38043" }}>
      {days}天后开始
    </span>
  );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#E38043" }}>
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
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all"
        style={{ borderColor: "#D0DEE8" }}>

        {/* 封面图 */}
        <div className="relative aspect-video overflow-hidden" style={{ background: "#E6F0F8" }}>
          <img
            src={coverSrc}
            alt={a.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        <div className="p-4 space-y-1.5">
          {/* 标题 */}
          <h3 className="font-semibold group-hover:text-[#3388BB] transition-colors line-clamp-1" style={{ color: "#333" }}>
            {a.title}
          </h3>

          {/* 时间 */}
          <p className="text-xs" style={{ color: "#999" }}>
            {a.startTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
            {" ~ "}
            {a.endTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
            {a.location ? ` · ${a.location}` : ""}
          </p>

          {/* 一句话简介 */}
          {a.summary && (
            <p className="text-xs line-clamp-1" style={{ color: "#777" }}>{a.summary}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── 区间标题 ──────────────────────────────────────────────
function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: "#25547A" }}>
      <span>{emoji}</span> {title}
    </h2>
  );
}

export default async function ActivitiesPage() {
  const now = new Date();

  const [ongoing, upcoming, past] = await cachedQuery(
    "activities:home",
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
        // 已结束（最近 12 条）
        prisma.activity.findMany({
          where:  { status: ActivityStatus.PUBLISHED, endTime: { lt: now } },
          orderBy: { endTime: "desc" },
          take: 12,
        }),
      ]),
    60
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-fade-in space-y-12">
      <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>活动</h1>

      {/* ── 进行中 ──────────────────────────────────────── */}
      {ongoing.length > 0 && (
        <section>
          <SectionTitle emoji="📣" title="进行中" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ongoing.map(a => (
              <ActivityCard key={a.id} a={a} badge="进行中" />
            ))}
          </div>
        </section>
      )}

      {/* ── 即将开始 ────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section>
          <SectionTitle emoji="⏰" title="即将开始" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcoming.map(a => (
              <ActivityCard key={a.id} a={a} countdown={<Countdown startTime={a.startTime} />} />
            ))}
          </div>
        </section>
      )}

      {/* ── 已结束 ──────────────────────────────────────── */}
      {past.length > 0 && (
        <section>
          <SectionTitle emoji="📦" title="已结束" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {past.map(a => (
              <ActivityCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {/* 空状态 */}
      {ongoing.length === 0 && upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">暂无活动</p>
          <p className="text-sm mt-1">管理员可以在后台创建活动</p>
        </div>
      )}
    </div>
  );
}
