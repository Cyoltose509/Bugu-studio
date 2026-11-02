/**
 * 活动月历视图：把活动排布在月历格子上。
 * 纯服务端渲染；月份切换走 searchParams（?view=calendar&month=YYYY-MM）。
 * 日期一律按北京时间（activityCalendar）分桶，多天活动覆盖每一天。
 */
import Link from "next/link";
import { activityCalendar } from "@/lib/activities/datetime";
import { localizeActivityTitle } from "@/lib/activities/title";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export type CalendarActivity = {
  id: string;
  title: string;
  type: string;
  startTime: Date | string;
  endTime: Date | string | null;
};

export type PendingActivity = {
  id: string;
  title: string;
  type: string;
};

/** 与封面角标同色系：浅底 + 深字 + 左侧色条 */
const CHIP_TONE: Record<string, string> = {
  MEETING: "bg-[#3B82C4]/10 text-[#2E6BA3] border-l-[#3B82C4] dark:bg-[#3B82C4]/20 dark:text-[#8FC0EA]",
  COURSE: "bg-[#3D9B8F]/10 text-[#2C7A70] border-l-[#3D9B8F] dark:bg-[#3D9B8F]/20 dark:text-[#7FCCC2]",
  ENGINE_COURSE: "bg-[#236EAE]/10 text-[#1D5C93] border-l-[#236EAE] dark:bg-[#236EAE]/20 dark:text-[#7FAFDC]",
  COMPETITION: "bg-[#E38043]/10 text-[#B85F23] border-l-[#E38043] dark:bg-[#E38043]/20 dark:text-[#F0A977]",
  GENERAL: "bg-[#6D5B9A]/10 text-[#57477C] border-l-[#6D5B9A] dark:bg-[#6D5B9A]/20 dark:text-[#B3A6D4]",
  RECOMMENDATION: "bg-[#C2447C]/10 text-[#9C3461] border-l-[#C2447C] dark:bg-[#C2447C]/20 dark:text-[#E58AAE]",
};

const WEEKDAYS: Record<Lang, string[]> = {
  cn: ["一", "二", "三", "四", "五", "六", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function dayKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 北京时间日历日 → 自1970起的"日"序号，用于跨天区间的逐日展开 */
function daySerial(y: number, m: number, d: number) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function serialToKey(serial: number) {
  const dt = new Date(serial * 86400000);
  return dayKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export default function ActivityCalendar({
  activities,
  pending,
  year,
  month,
  lang,
}: {
  activities: CalendarActivity[];
  pending: PendingActivity[];
  year: number;
  month: number; // 1-12
  lang: Lang;
}) {
  // 活动按"覆盖的每个北京时间日历日"进桶
  const byDay = new Map<string, CalendarActivity[]>();
  for (const a of activities) {
    const s = activityCalendar(a.startTime);
    const e = a.endTime ? activityCalendar(a.endTime) : s;
    const from = daySerial(s.year, s.month, s.day);
    const to = Math.max(from, daySerial(e.year, e.month, e.day));
    for (let serial = from; serial <= to && serial - from < 62; serial++) {
      const key = serialToKey(serial);
      const list = byDay.get(key);
      if (list) list.push(a);
      else byDay.set(key, [a]);
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  // 月历格子：周一开头，固定 6 行
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 周一=0
  const cells: { key: string; day: number; inMonth: boolean }[] = [];
  // 以当月第一周的周一作为格 0，用日序号推 42 格，天然覆盖跨月
  const firstSerial = daySerial(year, month, 1) - firstWeekday;
  for (let i = 0; i < 42; i++) {
    const dt = new Date((firstSerial + i) * 86400000);
    const cy = dt.getUTCFullYear();
    const cm = dt.getUTCMonth() + 1;
    const cd = dt.getUTCDate();
    cells.push({ key: dayKey(cy, cm, cd), day: cd, inMonth: cm === month });
  }

  const nowCn = activityCalendar(new Date());
  const todayKey = dayKey(nowCn.year, nowCn.month, nowCn.day);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthParam = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const monthTitle =
    lang === "en"
      ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date(Date.UTC(year, month - 1, 1)))
      : `${year}年${month}月`;

  const navBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-border-subtle text-brand-text-secondary hover:border-brand-blue/40 hover:text-brand-blue transition-colors";

  return (
    <div>
      {/* 月份导航 */}
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/activities?view=calendar&month=${monthParam(prevMonth.y, prevMonth.m)}`} className={navBtn} aria-label={lang === "en" ? "Previous month" : "上一月"}>‹</Link>
        <h2 className="min-w-[8.5rem] text-center text-xl font-semibold text-brand-navy">{monthTitle}</h2>
        <Link href={`/activities?view=calendar&month=${monthParam(nextMonth.y, nextMonth.m)}`} className={navBtn} aria-label={lang === "en" ? "Next month" : "下一月"}>›</Link>
        <Link href="/activities?view=calendar" className="ml-1 rounded-lg border border-brand-border-subtle px-3 py-1.5 text-sm text-brand-text-secondary hover:border-brand-blue/40 hover:text-brand-blue transition-colors">
          {t(lang, "activities.today")}
        </Link>
      </div>

      {/* 星期表头（周一开头） */}
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS[lang].map((w) => (
          <div key={w} className="pb-1.5 text-center text-xs font-medium text-brand-text-muted">{w}</div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const items = byDay.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          return (
            <div
              key={cell.key}
              className={`min-h-[5.5rem] rounded-lg border p-1.5 ${
                cell.inMonth
                  ? "border-brand-border-subtle bg-card"
                  : "border-transparent bg-brand-surface/40"
              } ${isToday ? "ring-2 ring-brand-blue/60" : ""}`}
            >
              <div
                className={`mb-1 text-right text-xs leading-none ${
                  isToday
                    ? "font-bold text-brand-blue"
                    : cell.inMonth
                      ? "text-brand-text-secondary"
                      : "text-brand-text-muted/60"
                }`}
              >
                {cell.day}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    href={`/activities/${a.id}`}
                    title={localizeActivityTitle(a.title, lang)}
                    className={`block truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] leading-tight hover:opacity-80 ${CHIP_TONE[a.type] || "bg-brand-surface text-brand-text-body border-l-brand-navy"}`}
                  >
                    {localizeActivityTitle(a.title, lang)}
                  </Link>
                ))}
                {items.length > 3 && (
                  <div className="px-1 text-[10px] text-brand-text-muted">
                    {t(lang, "activities.moreItems", { n: items.length - 3 })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 待定活动：没有日期排不上月历，单列一块 */}
      {pending.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-brand-navy">{t(lang, "activities.pendingActivities")}</h3>
          <div className="flex flex-wrap gap-2">
            {pending.map((a) => (
              <Link
                key={a.id}
                href={`/activities/${a.id}`}
                className={`rounded-full border-l-2 px-3 py-1 text-xs hover:opacity-80 ${CHIP_TONE[a.type] || "bg-brand-surface text-brand-text-body border-l-brand-navy"}`}
              >
                {localizeActivityTitle(a.title, lang)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
