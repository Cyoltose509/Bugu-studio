/**
 * 活动月历视图：itch.io jam 日历风格 —— 月历格子上铺甘特条。
 * 多天活动渲染为跨格连续条（按周分段），单日活动为单格条。
 * 纯服务端渲染；月份切换走 searchParams（?view=calendar&month=YYYY-MM）。
 * 日期一律按北京时间（activityCalendar）计算。
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

/** 甘特条：实心底 + 白字，与封面角标同色系 */
const BAR_TONE: Record<string, string> = {
  MEETING: "bg-[#3B82C4]",
  COURSE: "bg-[#3D9B8F]",
  ENGINE_COURSE: "bg-[#236EAE]",
  COMPETITION: "bg-[#E38043]",
  GENERAL: "bg-[#6D5B9A]",
  RECOMMENDATION: "bg-[#C2447C]",
};

/** 待定活动色签：浅底 + 深字 + 左侧色条 */
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

/** 每周最多铺 3 层甘特条，超出的折叠为「+N 更多」 */
const MAX_LANES = 3;

function dayKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 北京时间日历日 → 自1970起的"日"序号，用于跨天区间的逐日展开 */
function daySerial(y: number, m: number, d: number) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

type Segment = {
  a: CalendarActivity;
  colStart: number; // 1-7，gridColumn 起点
  span: number;     // 跨越格数
  contBefore: boolean; // 本周之前就开始了 → 左端不圆角
  contAfter: boolean;  // 本周之后还没完 → 右端不圆角
  lane: number;        // 泳道序号（0 起）
};

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
  // 每个活动的"日序号"区间；先按开始早、跨度长排序，泳道分配更整齐
  const ranges = activities
    .map((a) => {
      const s = activityCalendar(a.startTime);
      const e = a.endTime ? activityCalendar(a.endTime) : s;
      const from = daySerial(s.year, s.month, s.day);
      const to = Math.max(from, Math.min(from + 61, daySerial(e.year, e.month, e.day)));
      return { a, from, to };
    })
    .sort((x, y) => x.from - y.from || (y.to - y.from) - (x.to - x.from));

  // 月历格子：周一开头，固定 6 周；以当月第一周的周一作为格 0
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 周一=0
  const firstSerial = daySerial(year, month, 1) - firstWeekday;

  const weeks: { days: { key: string; day: number; inMonth: boolean }[]; segs: Segment[]; overflow: number }[] = [];
  for (let w = 0; w < 6; w++) {
    const wkStart = firstSerial + w * 7;
    const days: { key: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date((wkStart + i) * 86400000);
      const cm = dt.getUTCMonth() + 1;
      days.push({ key: dayKey(dt.getUTCFullYear(), cm, dt.getUTCDate()), day: dt.getUTCDate(), inMonth: cm === month });
    }
    // 甘特条按周切段 + 泳道分配（贪心：放进第一条空得下的泳道）
    const laneEnds: number[] = [];
    const segs: Segment[] = [];
    for (const r of ranges) {
      const segStart = Math.max(r.from, wkStart);
      const segEnd = Math.min(r.to, wkStart + 6);
      if (segStart > segEnd) continue;
      let lane = laneEnds.findIndex((end) => end < segStart);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(segEnd);
      } else {
        laneEnds[lane] = segEnd;
      }
      segs.push({
        a: r.a,
        colStart: segStart - wkStart + 1,
        span: segEnd - segStart + 1,
        contBefore: r.from < wkStart,
        contAfter: r.to > wkStart + 6,
        lane,
      });
    }
    const overflow = segs.filter((s) => s.lane >= MAX_LANES).length;
    weeks.push({ days, segs: segs.filter((s) => s.lane < MAX_LANES), overflow });
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

      <div className="overflow-hidden rounded-xl border border-brand-border-subtle">
        {/* 星期表头（周一开头） */}
        <div className="grid grid-cols-7 border-b border-brand-border-subtle bg-brand-surface/50">
          {WEEKDAYS[lang].map((w) => (
            <div key={w} className="py-2 text-center text-xs font-medium text-brand-text-muted">{w}</div>
          ))}
        </div>

        {/* 六周：每周一层，底层是日期格，上层铺甘特条 */}
        {weeks.map((week, wi) => (
          <div key={wi} className={`relative ${wi > 0 ? "border-t border-brand-border-subtle" : ""}`}>
            {/* 日期格（仅竖分隔线 + 日期数字） */}
            <div className="absolute inset-0 grid grid-cols-7">
              {week.days.map((cell, ci) => {
                const isToday = cell.key === todayKey;
                return (
                  <div
                    key={cell.key}
                    className={`px-1.5 pt-1.5 text-right ${ci > 0 ? "border-l border-brand-border-subtle/70" : ""} ${cell.inMonth ? "" : "bg-brand-surface/30"}`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs leading-none ${
                        isToday
                          ? "bg-brand-blue font-bold text-white"
                          : cell.inMonth
                            ? "text-brand-text-secondary"
                            : "text-brand-text-muted/50"
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 甘特条层：7 列网格，gridRow = 泳道 */}
            <div className="relative grid grid-cols-7 gap-y-1 px-1 pb-2 pt-8 min-h-[5rem]">
              {week.segs.map((s) => (
                <Link
                  key={`${s.a.id}-${s.colStart}`}
                  href={`/activities/${s.a.id}`}
                  title={localizeActivityTitle(s.a.title, lang)}
                  style={{ gridColumn: `${s.colStart} / span ${s.span}`, gridRow: s.lane + 1 }}
                  className={`flex h-5 items-center overflow-hidden px-2 text-[11px] font-medium leading-none text-white hover:brightness-110 transition ${
                    BAR_TONE[s.a.type] || "bg-brand-navy"
                  } ${s.contBefore ? "rounded-l-none -ml-1 pl-1" : "rounded-l-full"} ${s.contAfter ? "rounded-r-none -mr-1 pr-1" : "rounded-r-full"}`}
                >
                  <span className="min-w-0 truncate">{localizeActivityTitle(s.a.title, lang)}</span>
                </Link>
              ))}
              {week.overflow > 0 && (
                <div
                  style={{ gridColumn: "1 / span 7", gridRow: MAX_LANES + 1 }}
                  className="px-1 text-[10px] leading-4 text-brand-text-muted"
                >
                  {t(lang, "activities.moreItems", { n: week.overflow })}
                </div>
              )}
            </div>
          </div>
        ))}
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
