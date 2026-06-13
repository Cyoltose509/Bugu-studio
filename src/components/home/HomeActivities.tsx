/**
 * 首页 - 近期活动区块
 * 显示最多 3 个进行中/即将开始的活动
 */

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ActivityType, ActivityStatus } from "@prisma/client";

const DEFAULT_COVER = "/images/default_pic.png";

const TYPE_LABELS: Record<string, string> = {
  MEETING:    "例会",
  COURSE:     "公开课",
  COMPETITION: "比赛",
  GENERAL:    "普通活动",
};

async function getHomeActivities() {
  const now = new Date();
  return cachedQuery(
    "home:activities",
    () =>
      prisma.activity.findMany({
        where: {
          status: ActivityStatus.PUBLISHED,
          OR: [{ endTime: { gte: now } }, { startTime: { gte: now } }],
        },
        orderBy: [{ startTime: "asc" }],
        take: 3,
      }),
    300,
  );
}

export default async function HomeActivities() {
  const activities = await getHomeActivities();
  if (activities.length === 0) return null;

  const now = new Date();

  return (
    <section className="py-16 container mx-auto px-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold" style={{ color: "#25547A" }}>近期活动</h2>
        <Link href="/activities" className="text-sm hover:underline" style={{ color: "#3388BB" }}>
          查看全部 →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activities.map(a => {
          const isOngoing = now >= a.startTime && now <= a.endTime;
          const coverSrc = a.coverImage || DEFAULT_COVER;
          return (
            <Link key={a.id} href={`/activities/${a.id}`} className="group block">
              <div className="bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all" style={{ borderColor: "#D0DEE8" }}>
                {/* 封面 */}
                <div className="relative aspect-video overflow-hidden" style={{ background: "#E6F0F8" }}>
                  <Image src={coverSrc} alt={a.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, 33vw" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                      {TYPE_LABELS[a.type] || a.type}
                    </span>
                    {isOngoing && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/80 text-white backdrop-blur-sm">进行中</span>}
                  </div>
                  {a.meetingUrl && (
                    <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/30 text-white backdrop-blur-sm">🔗 线上</div>
                  )}
                </div>
                {/* 信息 */}
                <div className="p-4 space-y-1.5">
                  <h3 className="font-semibold group-hover:text-[#3388BB] transition-colors line-clamp-1" style={{ color: "#333" }}>
                    {a.title}
                  </h3>
                  <p className="text-xs" style={{ color: "#999" }}>
                    {a.startTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                    {" ~ "}
                    {a.endTime.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
