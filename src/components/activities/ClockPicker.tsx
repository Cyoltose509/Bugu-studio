"use client";

import { useEffect, useRef, useState } from "react";
import ClockIcon from "@/components/icons/ClockIcon";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
/** 5 分钟一档，够用又不用滚太久 */
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const DEFAULT_CLOCK = "14:30";

/**
 * 方形时钟按钮 + 时/分选择面板。
 *
 * - `value` 形如 "14:30"；空字符串表示还没设置时间。
 * - 选中小时或分钟立即回写，面板保持打开可继续调；点「完成」或面板外收起。
 * - `disabled` 时整块变灰且不响应点击（事件穿透给外层，用于自动推算锁定态切回手动）。
 */
export default function ClockPicker({
  value,
  onChange,
  disabled = false,
  label = "选择时间",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 点到面板外面就收起，避免占着页面
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const hasValue = Boolean(value);
  const [hh, mm] = (value || DEFAULT_CLOCK).split(":");

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        aria-label={hasValue ? `${label}（当前 ${value}）` : label}
        aria-expanded={open}
        title={hasValue ? `${label}：${value}` : label}
        className={`w-11 h-full min-h-[2.625rem] rounded-r-lg border border-l-0 border-brand-border-subtle bg-card flex items-center justify-center transition-colors ${
          hasValue ? "text-brand-blue" : "text-brand-text-muted"
        } ${disabled ? "opacity-50 pointer-events-none" : "hover:text-brand-blue hover:bg-brand-blue/5 cursor-pointer"}`}
      >
        <ClockIcon size={16} />
      </button>

      {open && !disabled && (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-brand-border-subtle bg-card p-2 shadow-lg animate-fade-in">
          <div className="flex gap-1">
            <div className="h-40 flex-1 overflow-y-auto overscroll-contain">
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onChange(`${h}:${mm || "00"}`)}
                  className={`w-full rounded px-2 py-1 text-sm tabular-nums transition-colors ${
                    hasValue && h === hh ? "bg-brand-blue text-white" : "text-brand-text-body hover:bg-brand-blue/10"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="h-40 flex-1 overflow-y-auto overscroll-contain">
              {MINUTES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange(`${hh || "00"}:${m}`)}
                  className={`w-full rounded px-2 py-1 text-sm tabular-nums transition-colors ${
                    hasValue && m === mm ? "bg-brand-blue text-white" : "text-brand-text-body hover:bg-brand-blue/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-brand-border-subtle pt-2">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="rounded px-2 py-1 text-xs text-brand-text-muted transition-colors hover:text-[var(--ui-text-red)]"
            >
              清除
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/10"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
