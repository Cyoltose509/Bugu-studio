"use client";

import { useEffect, useState } from "react";
import ClockPicker from "./ClockPicker";

export interface AutoScheduleRange {
  /** YYYY-MM-DDTHH:mm */
  start: string;
  /** YYYY-MM-DDTHH:mm */
  end: string;
}

/** 日期部分（input[type=date] 只认这个） */
function datePart(value: string) {
  return value.slice(0, 10);
}

/** 时间部分 HH:mm，没设则为空 */
function clockPart(value: string) {
  return value.length >= 16 ? value.slice(11, 16) : "";
}

function formatRange(range: AutoScheduleRange) {
  const [y, m, d] = range.start.slice(0, 10).split("-").map(Number);
  return `${y}年${m}月${d}日 ${range.start.slice(11, 16)}–${range.end.slice(11, 16)}`;
}

/**
 * 活动时间：自动推算（仅例会）/ 指定日期 / 待定。
 *
 * 指定日期时，日期框右侧带方形时钟按钮，可选到时分；日期本身只提交到 date input，
 * 完整值（含时分）走同名的 hidden input，避免 input[type=date] 把时间吃掉。
 *
 * 传入 onAutoSchedule 才出现「自动推算」：取上一场例会 +2 周的 14:30–17:30，
 * 填入后锁定；点开始/结束日期框会保留已填日期、退回「指定日期」供修改。
 */
export default function ActivityTimeChoice({
  pending,
  onPendingChange,
  start,
  end,
  onStartChange,
  onEndChange,
  fieldClass,
  labelClass,
  onAutoSchedule,
}: {
  pending: boolean;
  onPendingChange: (next: boolean) => void;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  fieldClass: string;
  labelClass: string;
  /** 传入时显示「自动推算」；返回 null 表示没有可参考的例会 */
  onAutoSchedule?: () => Promise<AutoScheduleRange | null>;
}) {
  const [auto, setAuto] = useState(false);
  const [autoRange, setAutoRange] = useState<AutoScheduleRange | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState("");

  // 切换活动类型后不再提供自动推算，退回指定日期
  useEffect(() => {
    if (!onAutoSchedule) {
      setAuto(false);
      setAutoError("");
    }
  }, [onAutoSchedule]);

  const isPending = pending && !auto;

  const choice = (active: boolean) =>
    `w-full px-3 py-2 rounded-lg text-sm border transition-all ${
      active
        ? "border-brand-blue bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue font-medium"
        : "border-brand-border-subtle text-brand-text-secondary bg-card hover:border-brand-blue/40"
    }`;

  async function chooseAuto() {
    if (!onAutoSchedule || autoLoading) return;
    setAutoLoading(true);
    setAutoError("");
    try {
      const range = await onAutoSchedule();
      if (!range) {
        setAutoError("还没有可参考的例会，请手动指定日期");
        return;
      }
      setAutoRange(range);
      setAuto(true);
      onPendingChange(false);
      onStartChange(range.start);
      onEndChange(range.end);
    } catch {
      setAutoError("自动推算失败，请手动指定日期");
    } finally {
      setAutoLoading(false);
    }
  }

  function handleDate(next: string, current: string, onChange: (v: string) => void) {
    const clock = clockPart(current);
    onChange(clock ? `${next}T${clock}` : next);
  }

  function handleClock(next: string, current: string, onChange: (v: string) => void) {
    const date = datePart(current);
    onChange(next ? `${date}T${next}` : date);
  }

  const dateField = `${fieldClass} rounded-r-none flex-1 min-w-0`;

  return (
    <div className="space-y-3">
      <div>
        <p className={labelClass}>时间</p>
        <div className={`grid gap-2 ${onAutoSchedule ? "grid-cols-3" : "grid-cols-2"}`}>
          {onAutoSchedule && (
            <button
              type="button"
              onClick={chooseAuto}
              disabled={autoLoading}
              aria-pressed={auto}
              className={`${choice(auto)} disabled:opacity-60`}
            >
              {autoLoading ? "推算中…" : "自动推算"}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setAuto(false); onPendingChange(false); }}
            aria-pressed={!isPending && !auto}
            className={choice(!isPending && !auto)}
          >
            指定日期
          </button>
          <button
            type="button"
            onClick={() => { setAuto(false); onPendingChange(true); }}
            aria-pressed={isPending}
            className={choice(isPending)}
          >
            待定
          </button>
        </div>
        {isPending && <input type="hidden" name="timePending" value="on" />}
        {isPending && (
          <p className="text-xs mt-2 text-brand-text-muted">不填具体日期。前台按即将开始展示，并排在最新一档。</p>
        )}
        {auto && autoRange && (
          <p className="text-xs mt-2 text-brand-blue">
            按上一场例会 + 2 周推算：{formatRange(autoRange)}。已锁定，点日期框可改为手动指定。
          </p>
        )}
        {autoError && <p className="text-xs mt-2 text-[var(--ui-text-red)]">{autoError}</p>}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 ${isPending ? "opacity-50" : ""}`}>
        <div>
          <label className={labelClass} htmlFor="startTime">
            开始日期{isPending ? "" : " *"}
            {clockPart(start) && (
              <span className="ml-1.5 font-normal text-brand-blue">{clockPart(start)}</span>
            )}
          </label>
          <div className="flex items-stretch" onClick={() => { if (auto) setAuto(false); }}>
            <input
              id="startTime"
              type="date"
              required={!isPending}
              disabled={isPending}
              value={datePart(start)}
              onChange={(e) => handleDate(e.target.value, start, onStartChange)}
              className={`${dateField} ${auto ? "pointer-events-none text-brand-text-muted" : ""}`}
            />
            <ClockPicker
              value={clockPart(start)}
              onChange={(next) => handleClock(next, start, onStartChange)}
              disabled={isPending || auto}
              label="设置开始时间"
            />
          </div>
          {/* 完整值（可能带时分）走 hidden，date input 只负责日历 */}
          <input type="hidden" name="startTime" value={start} />
        </div>

        <div>
          <label className={labelClass} htmlFor="endTime">
            结束日期{isPending ? "" : " *"}
            {clockPart(end) && (
              <span className="ml-1.5 font-normal text-brand-blue">{clockPart(end)}</span>
            )}
          </label>
          <div className="flex items-stretch" onClick={() => { if (auto) setAuto(false); }}>
            <input
              id="endTime"
              type="date"
              required={!isPending}
              disabled={isPending}
              value={datePart(end)}
              onChange={(e) => handleDate(e.target.value, end, onEndChange)}
              className={`${dateField} ${auto ? "pointer-events-none text-brand-text-muted" : ""}`}
            />
            <ClockPicker
              value={clockPart(end)}
              onChange={(next) => handleClock(next, end, onEndChange)}
              disabled={isPending || auto}
              label="设置结束时间"
            />
          </div>
          <input type="hidden" name="endTime" value={end} />
        </div>
      </div>
    </div>
  );
}
