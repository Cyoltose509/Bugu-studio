/**
 * 首页 - 近期活动区块
 * 显示最多 3 个进行中/即将开始的活动
 */

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { ActivityStatus } from "@prisma/client";
import { isMockDataEnabled, mockHomeActivities } from "@/lib/mock/frontend-data";
import {t, type DictKey} from "@/lib/i18n/dict";
import type {Lang} from "@/lib/i18n/config";

import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

const ACTIVITY_TYPE_KEY: Record<string, DictKey> = {
  MEETING: "activity.type.MEETING",
  COURSE: "activity.type.COURSE",
  COMPETITION: "activity.type.COMPETITION",
  GENERAL: "activity.type.GENERAL",
};

async function getHomeActivities() {
  if (isMockDataEnabled()) {
    return mockHomeActivities(3);
  }
  const now = new Date();
  try {
    return await cachedQuery(
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
  } catch {
    return [];
  }
}

export default async function HomeActivities({lang = "cn"}: { lang?: Lang }) {
  const activities = await getHomeActivities();
  if (activities.length === 0) return null;

  const now = new Date();
  const dateLocale = lang === "en" ? "en-US" : "zh-CN";

  const typeLabel = (type: string) => t(lang, ACTIVITY_TYPE_KEY[type] ?? "activity.type.GENERAL");

  return (
    <section className="py-16 container mx-auto px-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-brand-navy">{t(lang, "home.recentActivities")}</h2>
        <Link href="/activities" className="text-sm hover:underline text-brand-blue">
          {t(lang, "home.viewAll")} →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activities.map(a => {
          const isOngoing = now >= a.startTime && now <= a.endTime;
          const coverSrc = a.coverImage || DEFAULT_COVER;
          return (
            <Link key={a.id} href={`/activities/${a.id}`} className="group block">
              <div className="bg-card rounded-xl border border-brand-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-all">
                {/* 封面 */}
                <div className="relative aspect-video overflow-hidden bg-brand-surface">
                  <Image src={coverSrc} alt={a.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, 33vw" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                      {typeLabel(a.type)}
                    </span>
                    {isOngoing && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/80 text-white backdrop-blur-sm">{t(lang, "activity.ongoing")}</span>}
                  </div>
                  {a.meetingUrl && (
                    <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/30 text-white backdrop-blur-sm">{t(lang, "activity.online")}</div>
                  )}
                </div>
                {/* 信息 */}
                <div className="p-4 space-y-1.5">
                  <h3 className="font-semibold group-hover:text-brand-blue transition-colors line-clamp-1 text-brand-text-heading">
                    {a.title}
                  </h3>
                  <p className="text-xs text-brand-text-muted">
                    {a.startTime.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                    {" ~ "}
                    {a.endTime.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
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
