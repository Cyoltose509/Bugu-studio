"use client";

/**
 * 活动月历视图：itch.io jam 日历风格 —— 月历格子上铺甘特条。
 * 多天活动渲染为跨格连续条（按周分段），单日活动为单格条。
 * 客户端状态即时切月，0 延迟流畅响应，并与 URL 同步。
 * 日期一律按北京时间（activityCalendar）计算。
 */
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "@/components/ui/SiteImage";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";
import PlusIcon from "@/components/ui/PlusIcon";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import { activityCalendar, activityPhase, formatActivitySchedule } from "@/lib/activities/datetime";
import { recoTagLabel } from "@/lib/activities/recommendation";
import { localizeActivityTitle } from "@/lib/activities/title";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export type CalendarActivityItem = {
  id: string;
  title: string;
  type: string;
  summary?: string | null;
  status?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  coverImage?: string | null;
  recoTag?: string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  timePending?: boolean | null;
  courseHasClock?: boolean | null;
};

export type CalendarActivity = CalendarActivityItem & {
  startTime: Date | string;
  endTime: Date | string | null;
};

export type PendingActivity = CalendarActivityItem;

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

const STATUS_LABEL: Record<"ongoing" | "upcoming" | "past", { cn: string; en: string }> = {
  ongoing: { cn: "进行中", en: "Ongoing" },
  upcoming: { cn: "即将开始", en: "Upcoming" },
  past: { cn: "已结束", en: "Ended" },
};

function activityTypeLabel(lang: Lang, type: string): string {
  const k = ACTIVITY_TYPE_KEYS[type];
  return k ? t(lang, k) : type;
}

function PopupCountdown({ startTime, lang }: { startTime: Date; lang: Lang }) {
  const diff = startTime.getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-brand-orange">
      {days > 0
        ? t(lang, "activities.daysLater").replace("{n}", String(days))
        : t(lang, "activities.hoursLater").replace("{n}", String(hours))}
    </span>
  );
}



/** 活动类型原色（实色十六进制），用于单日活动格子全格原色染色与色块卡片 */
export const BAR_COLOR: Record<string, string> = {
  MEETING: "#3B82C4",
  COURSE: "#3D9B8F",
  ENGINE_COURSE: "#236EAE",
  COMPETITION: "#E38043",
  GENERAL: "#6D5B9A",
  RECOMMENDATION: "#C2447C",
};

/** 甘特条：实心底 + 白字，与封面角标同色系 */
export const BAR_TONE: Record<string, string> = {
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
  year: initialYear,
  month: initialMonth,
  lang,
  isAdmin,
}: {
  activities: CalendarActivity[];
  pending: PendingActivity[];
  year: number;
  month: number; // 1-12
  lang: Lang;
  isAdmin?: boolean;
}) {
  // 客户端维护当前查看的年月，切换月份瞬间响应
  const [cur, setCur] = useState(() => ({ year: initialYear, month: initialMonth }));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // 鼠标拖拽滚动状态
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    setCur({ year: initialYear, month: initialMonth });
  }, [initialYear, initialMonth]);

  // 当切换月份时，重置手动高亮
  useEffect(() => {
    setHighlightedId(null);
  }, [cur.year, cur.month]);

  const year = cur.year;
  const month = cur.month;

  const goToMonth = (nextYear: number, nextMonth: number) => {
    setCur({ year: nextYear, month: nextMonth });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "calendar");
      url.searchParams.set("month", `${nextYear}-${String(nextMonth).padStart(2, "0")}`);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const goToToday = () => {
    const nowCn = activityCalendar(new Date());
    goToMonth(nowCn.year, nowCn.month);
  };

  // 全量活动队列（按开始时间先后排序，涵盖以往、当前、未来）
  const allQueue = useMemo(() => {
    return [...activities].sort((a, b) => {
      const ta = new Date(a.startTime).getTime();
      const tb = new Date(b.startTime).getTime();
      return ta - tb;
    });
  }, [activities]);

  // 确定“本月1号那个”目标活动：用于左栏竖向正中自动连续丝滑定位
  const targetActivityId = useMemo(() => {
    if (allQueue.length === 0) return null;
    const targetSerial = daySerial(year, month, 1);
    // 优先寻找 >= 当月1号 的第一个活动
    let candidate = allQueue.find((item) => {
      const s = activityCalendar(item.startTime);
      return daySerial(s.year, s.month, s.day) >= targetSerial;
    });
    // 若所有活动都在当月1号前，则聚焦最后一个；否则聚焦首个
    if (!candidate) candidate = allQueue[allQueue.length - 1];
    return candidate?.id ?? null;
  }, [allQueue, year, month]);

  const scrollToActivity = (id: string) => {
    setHighlightedId(id);
    const targetEl = cardRefs.current.get(id);
    const container = scrollContainerRef.current;
    if (targetEl && container) {
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollToY =
        container.scrollTop +
        (targetRect.top - containerRect.top) -
        container.clientHeight / 2 +
        targetRect.height / 2;
      container.scrollTo({ top: Math.max(0, scrollToY), behavior: "smooth" });
    }
  };

  // 切换月份或初始化时，左栏自动连续丝滑居中定位到本月1号卡片
  useEffect(() => {
    if (!targetActivityId) return;
    const timer = setTimeout(() => {
      const targetEl = cardRefs.current.get(targetActivityId);
      const container = scrollContainerRef.current;
      if (targetEl && container) {
        const targetRect = targetEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollToY =
          container.scrollTop +
          (targetRect.top - containerRect.top) -
          container.clientHeight / 2 +
          targetRect.height / 2;
        container.scrollTo({ top: Math.max(0, scrollToY), behavior: "smooth" });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [targetActivityId]);

  // 鼠标拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startYRef.current = e.pageY;
    startScrollTopRef.current = scrollContainerRef.current?.scrollTop || 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    const dy = e.pageY - startYRef.current;
    if (Math.abs(dy) > 3) hasDraggedRef.current = true;
    scrollContainerRef.current.scrollTop = startScrollTopRef.current - dy;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // 纯客户端高效运算月历网格
  const { weeks, todayKey } = useMemo(() => {
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

    // 单日活动（from === to）对所在日期格染色；同一日有多个单日活动时，优先让例会（MEETING）负责染色
    const singleDayTintBySerial = new Map<number, string>();
    for (const r of ranges) {
      if (r.from !== r.to) continue;
      const prev = singleDayTintBySerial.get(r.from);
      if (!prev || (prev !== "MEETING" && r.a.type === "MEETING")) {
        singleDayTintBySerial.set(r.from, r.a.type);
      }
    }

    // 月历格子：周一开头，固定 6 周；以当月第一周的周一作为格 0
    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 周一=0
    const firstSerial = daySerial(year, month, 1) - firstWeekday;

    const weeksList: {
      days: { key: string; day: number; inMonth: boolean; tintType: string | null }[];
      segs: Segment[];
      overflow: number;
    }[] = [];

    for (let w = 0; w < 6; w++) {
      const wkStart = firstSerial + w * 7;
      const days: { key: string; day: number; inMonth: boolean; tintType: string | null }[] = [];
      for (let i = 0; i < 7; i++) {
        const serial = wkStart + i;
        const dt = new Date(serial * 86400000);
        const cm = dt.getUTCMonth() + 1;
        days.push({
          key: dayKey(dt.getUTCFullYear(), cm, dt.getUTCDate()),
          day: dt.getUTCDate(),
          inMonth: cm === month,
          tintType: singleDayTintBySerial.get(serial) ?? null,
        });
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
      weeksList.push({ days, segs: segs.filter((s) => s.lane < MAX_LANES), overflow });
    }

    const nowCn = activityCalendar(new Date());
    return {
      weeks: weeksList,
      todayKey: dayKey(nowCn.year, nowCn.month, nowCn.day),
    };
  }, [activities, year, month]);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthTitle =
    lang === "en"
      ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date(Date.UTC(year, month - 1, 1)))
      : `${year}年${month}月`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] xl:grid-cols-[230px_1fr] gap-3 sm:gap-4 items-stretch flex-1 min-h-0">
      {/* 窄左栏：纵向活动队列（无标题无垫底，全部空间给队列，长宽比保留但压缩宽度以呈现更多活动） */}
      <div className="flex flex-col h-[380px] sm:h-[440px] lg:h-full min-w-0 min-h-0">
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative flex-1 overflow-y-auto overscroll-contain space-y-2 py-0.5 pr-1 select-none agenda-scroll cursor-grab active:cursor-grabbing min-h-0"
        >
          {allQueue.length === 0 ? (
            <p className="text-xs text-brand-text-muted text-center py-8">
              {lang === "en" ? "No activities" : "暂无活动"}
            </p>
          ) : (
            allQueue.map((act) => {
              const isSelected = act.id === (highlightedId || targetActivityId);
              const displayTitle = localizeActivityTitle(act.title, lang);
              const scheduleText = formatActivitySchedule(
                act.startTime,
                act.endTime,
                lang,
                !!act.timePending,
                !!act.courseHasClock
              );
              const cardBg = BAR_COLOR[act.type] || "#25547A";
              const phase = activityPhase(act);
              const isPast = phase === "past";
              const startDate = !act.timePending && act.startTime ? new Date(act.startTime) : null;
              const hasCover = !!act.coverImage;

              const fadedClass = isPast && !isSelected
                ? "opacity-55 saturate-[0.55] hover:opacity-100 hover:saturate-100"
                : "opacity-100 saturate-100";

              return (
                <Link
                  key={act.id}
                  href={`/activities/${act.id}`}
                  ref={(el) => {
                    if (el) cardRefs.current.set(act.id, el);
                    else cardRefs.current.delete(act.id);
                  }}
                  onClick={(e) => {
                    if (hasDraggedRef.current) e.preventDefault();
                  }}
                  style={{ backgroundColor: cardBg }}
                  className={`group block rounded-xl overflow-hidden text-white transition-all duration-200 shadow-2xs hover:shadow-md hover:brightness-105 hover:scale-[1.015] active:scale-[0.99] ${fadedClass} ${
                    isSelected ? "ring-2 ring-brand-blue ring-offset-2 ring-offset-background shadow-md opacity-100 saturate-100" : ""
                  }`}
                  title={`${displayTitle} · ${scheduleText}`}
                >
                  {/* 有封面则展示 16:9 高清封面 */}
                  {hasCover && (
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/20 shrink-0">
                      <Image
                        src={act.coverImage!}
                        alt={displayTitle}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 1024px) 100vw, 240px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
                      {/* 活动类别小徽标 */}
                      <div className="absolute top-1.5 left-1.5 z-10">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                          {activityTypeLabel(lang, act.type)}
                        </span>
                      </div>
                      {/* 状态徽标 / 倒计时 */}
                      <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-1">
                        {phase === "ongoing" && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white bg-green-500/85 backdrop-blur-sm shadow-xs">
                            {STATUS_LABEL.ongoing[lang]}
                          </span>
                        )}
                        {phase === "past" && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white bg-black/55 backdrop-blur-sm">
                            {STATUS_LABEL.past[lang]}
                          </span>
                        )}
                        {phase === "upcoming" && startDate && (
                          <PopupCountdown startTime={startDate} lang={lang} />
                        )}
                      </div>
                      {act.meetingUrl && act.type !== "COURSE" && act.type !== "ENGINE_COURSE" && act.type !== "RECOMMENDATION" && (
                        <div className="absolute bottom-1.5 right-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                          {t(lang, "activity.online")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 信息区域（卡片整体染色，文字比例协调紧凑） */}
                  <div className={`p-2 sm:p-2.5 text-white flex flex-col justify-between flex-1 ${hasCover ? "min-h-[3.6rem]" : "min-h-[5.25rem]"}`}>
                    {!hasCover && (
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                          {activityTypeLabel(lang, act.type)}
                        </span>
                        {phase === "ongoing" && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white bg-green-500/85 backdrop-blur-sm shadow-xs">
                            {STATUS_LABEL.ongoing[lang]}
                          </span>
                        )}
                        {phase === "past" && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white bg-black/35 backdrop-blur-sm">
                            {STATUS_LABEL.past[lang]}
                          </span>
                        )}
                        {phase === "upcoming" && startDate && (
                          <PopupCountdown startTime={startDate} lang={lang} />
                        )}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-xs leading-snug line-clamp-1 group-hover:underline">
                        {displayTitle}
                      </h4>
                      <p className="mt-0.5 text-[10px] sm:text-[11px] text-white/90 leading-tight line-clamp-1">
                        {scheduleText}
                      </p>
                    </div>
                    {act.summary && (
                      <p className="mt-0.5 text-[10px] text-white/75 line-clamp-1">
                        {act.summary}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* 右侧：月历主体（占满全高） */}
      <div className="flex flex-col h-full min-w-0 min-h-0">
        {/* 右侧顶栏：左对齐“社团活动”，中间月份导航，右侧控制按钮 */}
        <div className="shrink-0 mb-2 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* 左对齐：社团活动标题 */}
          <h1 className="text-xl sm:text-2xl font-bold text-brand-navy leading-none shrink-0">
            {t(lang, "page.activities.title")}
          </h1>

          {/* 中间：月份导航与“今”按钮 */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => goToMonth(prevMonth.y, prevMonth.m)}
              className="inline-flex h-7 w-7 items-center justify-center bg-transparent border-none text-brand-navy hover:text-brand-blue transition-colors cursor-pointer select-none text-lg sm:text-xl font-bold leading-none p-0"
              aria-label={lang === "en" ? "Previous month" : "上一月"}
            >
              ‹
            </button>
            <h2 className="min-w-[6.5rem] sm:min-w-[7.5rem] text-center text-base sm:text-lg font-semibold text-brand-navy select-none leading-none">
              {monthTitle}
            </h2>
            <button
              type="button"
              onClick={() => goToMonth(nextMonth.y, nextMonth.m)}
              className="inline-flex h-7 w-7 items-center justify-center bg-transparent border-none text-brand-navy hover:text-brand-blue transition-colors cursor-pointer select-none text-lg sm:text-xl font-bold leading-none p-0"
              aria-label={lang === "en" ? "Next month" : "下一月"}
            >
              ›
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-0.5 inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-brand-blue text-white shadow-xs hover:brightness-110 active:scale-95 transition-all text-xs font-bold leading-none cursor-pointer"
              title={t(lang, "activities.today")}
              aria-label={t(lang, "activities.today")}
            >
              今
            </button>
          </div>

          {/* 右对齐：网格视图切换 + 管理员创建按钮 */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/activities"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg border border-brand-border-subtle bg-card text-brand-text-secondary hover:border-brand-blue/40 hover:text-brand-blue transition-colors flex items-center justify-center shrink-0"
              title={t(lang, "activities.gridView")}
              aria-label={t(lang, "activities.gridView")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </Link>
            {isAdmin && (
              <Link
                href="/admin/activities/create"
                className="btn-primary brand-add-control !w-8 !h-8 sm:!w-8.5 sm:!h-8.5 shrink-0"
                title={t(lang, "activities.create")}
                aria-label={t(lang, "activities.create")}
              >
                <PlusIcon size={18} />
              </Link>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col rounded-xl border border-brand-border-subtle bg-card shadow-xs overflow-hidden min-h-0">
          {/* 星期表头（周一开头） */}
          <div className="grid grid-cols-7 shrink-0 border-b border-brand-border-subtle bg-brand-surface/50">
            {WEEKDAYS[lang].map((w) => (
              <div key={w} className="py-1.5 text-center text-[11px] sm:text-xs font-medium text-brand-text-muted">
                {w}
              </div>
            ))}
          </div>

          {/* 六周：等比撑满剩余高度 */}
          <div className="flex-1 grid grid-rows-6 min-h-0">
            {weeks.map((week, wi) => {
              const isLastWeek = wi === weeks.length - 1;
              return (
                <div key={wi} className={`relative hover:z-30 focus-within:z-30 min-h-0 flex flex-col justify-between ${wi > 0 ? "border-t border-brand-border-subtle" : ""}`}>
                  {/* 日期格（仅竖分隔线 + 日期数字） */}
                  <div className={`absolute inset-0 grid grid-cols-7 ${isLastWeek ? "rounded-b-xl overflow-hidden" : ""}`}>
                  {week.days.map((cell, ci) => {
                    const isToday = cell.key === todayKey;
                    const isTinted = !!cell.tintType;
                    const style = isTinted
                      ? { backgroundColor: BAR_COLOR[cell.tintType!] || "#25547A" }
                      : undefined;
                    const fallbackClass = !isTinted && !cell.inMonth ? "bg-brand-surface/30" : "";
                    return (
                      <div
                        key={cell.key}
                        style={style}
                        className={`relative px-1 pt-1 text-right transition-colors ${
                          ci > 0 ? "border-l border-brand-border-subtle/70" : ""
                        } ${fallbackClass}`}
                      >
                        <span
                          className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-[11px] leading-none ${
                            isToday
                              ? isTinted
                                ? "bg-white font-bold text-brand-navy shadow-xs"
                                : "bg-brand-blue font-bold text-white shadow-xs"
                              : isTinted
                                ? "font-semibold text-white/95"
                                : cell.inMonth
                                  ? "text-brand-text-secondary"
                                  : "text-brand-text-muted/40"
                          }`}
                        >
                          {cell.day}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 甘特条层：7 列网格，单机联动左侧列表滚动到该活动 */}
                <div className="relative grid grid-cols-7 gap-y-0.5 sm:gap-y-1 px-1 pb-1 pt-5 sm:pt-6 min-h-[3.35rem] sm:min-h-[3.75rem]">
                  {week.segs.map((s) => {
                    const isSingleDay = s.span === 1 && !s.contBefore && !s.contAfter;
                    return (
                      <div
                        key={`${s.a.id}-${s.colStart}`}
                        style={{ gridColumn: `${s.colStart} / span ${s.span}`, gridRow: s.lane + 1 }}
                        className="group/bar relative hover:z-20 focus-within:z-20"
                      >
                        <button
                          type="button"
                          onClick={() => scrollToActivity(s.a.id)}
                          title={localizeActivityTitle(s.a.title, lang)}
                          aria-label={localizeActivityTitle(s.a.title, lang)}
                          className={`w-full flex h-[1.125rem] sm:h-[1.25rem] items-center overflow-hidden text-[10px] sm:text-[11px] font-semibold leading-none text-white hover:brightness-110 active:scale-[0.99] transition cursor-pointer text-left ${
                            isSingleDay
                              ? "bg-transparent hover:opacity-90 pl-2 sm:pl-2.5 pr-1"
                              : `px-1.5 ${BAR_TONE[s.a.type] || "bg-brand-navy"} ${
                                  s.contBefore ? "rounded-l-none -ml-1 pl-1" : "rounded-l-full"
                                } ${s.contAfter ? "rounded-r-none -mr-1 pr-1" : "rounded-r-full"}`
                          }`}
                        >
                          <span className="min-w-0 truncate">{localizeActivityTitle(s.a.title, lang)}</span>
                        </button>
                      </div>
                    );
                  })}
                  {week.overflow > 0 && (
                    <div
                      style={{ gridColumn: "1 / span 7", gridRow: MAX_LANES + 1 }}
                      className="px-1 text-[9px] sm:text-[10px] leading-3 text-brand-text-muted"
                    >
                      {t(lang, "activities.moreItems", { n: week.overflow })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* 待定活动：没有日期排不上月历，紧凑横条展示，单击滚动至该活动 */}
        {pending.length > 0 && (
          <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-semibold text-brand-navy shrink-0 mr-1">{t(lang, "activities.pendingActivities")}:</span>
            {pending.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => scrollToActivity(a.id)}
                title={localizeActivityTitle(a.title, lang)}
                className={`inline-block rounded-full border-l-2 px-2.5 py-0.5 text-[11px] hover:opacity-80 transition cursor-pointer ${
                  CHIP_TONE[a.type] || "bg-brand-surface text-brand-text-body border-l-brand-navy"
                }`}
              >
                {localizeActivityTitle(a.title, lang)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
