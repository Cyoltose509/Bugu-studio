/**
 * 活动卡片（封面 + 类型角标 + 标题 / 时间地点 / 简介三行）
 *
 * 活动首页和个人主页共用同一套外观，避免两处各写一份后逐渐走形。
 */
import Link from "next/link";
import Image from "@/components/ui/SiteImage";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import { formatActivitySchedule } from "@/lib/activities/datetime";
import { localizeActivityTitle } from "@/lib/activities/title";
import ActivityTypeCorner from "./ActivityTypeCorner";

/** 卡片只需要这些字段，调用方传 Prisma 整行也能直接过 */
export type ActivityCardData = {
  id: string;
  title: string;
  type: string;
  summary?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  coverImage?: string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  timePending?: boolean;
  courseHasClock?: boolean;
};

const ACTIVITY_TYPE_KEYS: Record<
  string,
  | "activity.type.MEETING"
  | "activity.type.COURSE"
  | "activity.type.ENGINE_COURSE"
  | "activity.type.COMPETITION"
  | "activity.type.GENERAL"
  | "activity.type.RECOMMENDATION"
> = {
  MEETING: "activity.type.MEETING",
  COURSE: "activity.type.COURSE",
  ENGINE_COURSE: "activity.type.ENGINE_COURSE",
  COMPETITION: "activity.type.COMPETITION",
  GENERAL: "activity.type.GENERAL",
  RECOMMENDATION: "activity.type.RECOMMENDATION",
};

export const ACTIVITY_STATUS_LABEL: Record<string, { cn: string; en: string }> = {
  ongoing: { cn: "进行中", en: "Ongoing" },
  upcoming: { cn: "即将开始", en: "Upcoming" },
  past: { cn: "已结束", en: "Ended" },
};

export function activityTypeLabel(lang: Lang, type: string): string {
  const k = ACTIVITY_TYPE_KEYS[type];
  return k ? t(lang, k) : type;
}

export default function ActivityCard({
  a,
  lang,
  badge,
  countdown,
}: {
  a: ActivityCardData;
  lang: Lang;
  badge?: "ongoing" | "upcoming" | "past";
  countdown?: React.ReactNode;
}) {
  const coverSrc = a.coverImage || DEFAULT_ACTIVITY_COVER;
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
                <span
                  className={`text-xs px-2 py-0.5 rounded-full text-white backdrop-blur-sm ${
                    badge === "past" ? "bg-black/50" : "bg-green-500/80"
                  }`}
                >
                  {ACTIVITY_STATUS_LABEL[badge][lang]}
                </span>
              )}
              {countdown}
            </div>
          )}
          {a.meetingUrl && a.type !== "COURSE" && a.type !== "ENGINE_COURSE" && a.type !== "RECOMMENDATION" && (
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
