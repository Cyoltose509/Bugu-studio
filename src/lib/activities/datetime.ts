/** 活动时间按北京时间的日历日处理，不跟 Vercel 的 UTC 走。 */

const SHANGHAI = "Asia/Shanghai";

export function parseActivityDateTime(value: string, bound: "start" | "end" = "start"): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(bound === "end" ? `${value}T23:59:59+08:00` : `${value}T00:00:00+08:00`);
  }
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ? `${value}+08:00` : value);
}

/** 编辑表单用的日期值：北京时间 YYYY-MM-DD。 */
export function formatActivityDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatActivityClock(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: SHANGHAI, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
}

export function activityCalendar(value: Date | string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function formatActivityDay(value: Date | string, lang: "cn" | "en" = "cn"): string {
  const { year, month, day } = activityCalendar(value);
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return lang === "en" ? `${dayText}/${monthText}/${year}` : `${year}/${monthText}/${dayText}`;
}

export function formatActivityDayRange(start: Date | string, end: Date | string, lang: "cn" | "en" = "cn"): string {
  const from = formatActivityDay(start, lang);
  const to = formatActivityDay(end, lang);
  return from === to ? from : `${from} ~ ${to}`;
}

export function isActivityTimePending(activity: { timePending?: boolean | null }): boolean {
  return !!activity.timePending;
}

/** 待定没有具体日期，按尚未开始的未来活动处理。已归档一律视为已结束。 */
export function activityPhase(
  activity: {
    timePending?: boolean | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
    status?: string | null;
  },
  now = new Date(),
): "upcoming" | "ongoing" | "past" {
  if (activity.status === "ARCHIVED") return "past";
  if (isActivityTimePending(activity) || !activity.startTime || !activity.endTime) return "upcoming";
  const t = now.getTime();
  const start = new Date(activity.startTime).getTime();
  const end = new Date(activity.endTime).getTime();
  if (t < start) return "upcoming";
  if (t > end) return "past";
  return "ongoing";
}

export function formatActivitySchedule(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  lang: "cn" | "en" = "cn",
  timePending = false,
  hasClock = false,
): string {
  if (timePending || !start || !end) return lang === "en" ? "TBD" : "待定";
  const days = formatActivityDayRange(start, end, lang);
  if (!hasClock) return days;
  const startClock = formatActivityClock(new Date(start));
  const endClock = formatActivityClock(new Date(end));
  return `${days} · ${startClock}${endClock === "23:59" ? "" : `–${endClock}`}`;
}

/** 待定是最新一档；有日期的按开始时间从新到旧。 */
export function compareActivitiesNewestFirst(
  a: { timePending?: boolean | null; startTime?: Date | string | null },
  b: { timePending?: boolean | null; startTime?: Date | string | null },
): number {
  const pending = (item: { timePending?: boolean | null; startTime?: Date | string | null }) =>
    !!item.timePending || !item.startTime;
  const ap = pending(a);
  const bp = pending(b);
  if (ap !== bp) return ap ? -1 : 1;
  if (ap || !a.startTime || !b.startTime) return 0;
  return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
}

/** Prisma 排序：待定在前，其余开始时间从新到旧。 */
export const activityNewestFirstOrder = [
  { timePending: "desc" as const },
  { startTime: "desc" as const },
];
