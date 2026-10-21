/**
 * 首页 - 近期活动区块
 * 进行中/即将开始在前，已结束的也展示并降调
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
import { activityNewestFirstOrder, activityPhase, formatActivitySchedule } from "@/lib/activities/datetime";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";
import { redactCourseMeetingLinks } from "@/lib/activities/course-meeting-visibility";

const DEFAULT_COVER = DEFAULT_ACTIVITY_COVER;

const ACTIVITY_TYPE_KEY: Record<string, DictKey> = {
  MEETING: "activity.type.MEETING",
  COURSE: "activity.type.COURSE",
  ENGINE_COURSE: "activity.type.ENGINE_COURSE",
  COMPETITION: "activity.type.COMPETITION",
  GENERAL: "activity.type.GENERAL",
};

async function getHomeActivities() {
  if (isMockDataEnabled()) {
    return mockHomeActivities(6);
  }
  const now = new Date();
  try {
    return await cachedQuery(
      "home:activities:v3",
      async () => {
        const [live, past] = await Promise.all([
          prisma.activity.findMany({
            where: {
              status: ActivityStatus.PUBLISHED,
              OR: [
                { timePending: true },
                { endTime: { gte: now } },
              ],
            },
            orderBy: activityNewestFirstOrder,
            take: 3,
          }),
          prisma.activity.findMany({
            where: {
              OR: [
                { status: ActivityStatus.PUBLISHED, timePending: false, endTime: { lt: now } },
                { status: ActivityStatus.ARCHIVED },
              ],
            },
            orderBy: { endTime: "desc" },
            take: 3,
          }),
        ]);
        return [...live, ...past];
      },
      300,
    );
  } catch {
    return [];
  }
}

export default async function HomeActivities({lang = "cn"}: { lang?: Lang }) {
  const activities = (await getHomeActivities()).map((activity) => redactCourseMeetingLinks(activity, false));
  if (activities.length === 0) return null;

  const now = new Date();

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
          const phase = activityPhase(a, now);
          const isOngoing = phase === "ongoing";
          const isPast = phase === "past";
          const coverSrc = a.coverImage || DEFAULT_COVER;
          return (
            <Link key={a.id} href={`/activities/${a.id}`} className="group block">
              <div className={`bg-card rounded-xl border border-brand-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-all ${isPast ? "opacity-55" : ""}`}>
                {/* 封面 */}
                <div className="relative aspect-video overflow-hidden bg-brand-surface">
                  <Image src={coverSrc} alt={a.title} fill className={`object-cover group-hover:scale-105 transition-transform duration-300 ${isPast ? "grayscale-[40%]" : ""}`} sizes="(max-width: 768px) 100vw, 33vw" />
                  <ActivityTypeCorner type={a.type} label={typeLabel(a.type)} />
                  {(isOngoing || isPast) && (
                    <div className="absolute top-2 right-2">
                      {isOngoing && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/80 text-white backdrop-blur-sm">{t(lang, "activity.ongoing")}</span>}
                      {isPast && <span className="text-xs px-2 py-0.5 rounded-full bg-black/50 text-white/90 backdrop-blur-sm">{t(lang, "activity.past")}</span>}
                    </div>
                  )}
                  {a.meetingUrl && a.type !== "COURSE" && a.type !== "ENGINE_COURSE" && (
                    <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/30 text-white backdrop-blur-sm">{t(lang, "activity.online")}</div>
                  )}
                </div>
                {/* 信息 */}
                <div className="p-4 space-y-1.5">
                  <h3 className="font-semibold group-hover:text-brand-blue transition-colors line-clamp-1 text-brand-text-heading">
                    {a.title}
                  </h3>
                  <p className="text-xs text-brand-text-muted">
                    {formatActivitySchedule(a.startTime, a.endTime, lang, a.timePending, a.courseHasClock)}
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
