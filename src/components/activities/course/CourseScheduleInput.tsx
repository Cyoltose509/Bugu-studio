"use client";

import { useEffect, useId, useRef, useState } from "react";

const field = "w-full min-w-0 rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading outline-none focus:ring-2 focus:ring-brand-blue/30";
const smallButton = "flex h-8 w-8 items-center justify-center rounded-lg text-brand-blue transition hover:bg-brand-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30";
const pad = (n: number) => String(n).padStart(2, "0");
const dateValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Course fields use the same brand surfaces and selection colors as the other editor menus. */
export default function CourseScheduleInput({ label, value, onChange, kind }: {
  label: string; value: string; onChange: (value: string) => void; kind: "date" | "time";
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [clock, setClock] = useState("");
  const [error, setError] = useState("");
  const timeColumns = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || kind !== "time") return;
    timeColumns.current?.querySelectorAll<HTMLElement>("[data-selected=true]").forEach((item) => {
      const column = item.parentElement;
      if (column) column.scrollTop = Math.max(0, item.offsetTop - column.offsetTop - column.clientHeight / 2 + item.clientHeight / 2);
    });
  }, [open, kind]);
  function toggle() {
    if (!open) {
      const parsed = value && kind === "date" ? new Date(`${value}T12:00:00`) : new Date();
      setMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      setClock(value || "19:00");
      setError("");
    }
    setOpen(!open);
  }
  function choose(next: string) { onChange(next); setOpen(false); trigger.current?.focus(); }
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1));
  function changePart(part: number, next: string) {
    const pieces = /^\d{2}:\d{2}$/.test(clock) ? clock.split(":") : ["19", "00"];
    pieces[part] = next;
    setClock(pieces.join(":")); setError("");
  }
  return <div className={`relative min-w-0 ${kind === "date" ? "col-span-2 sm:col-span-1" : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <label id={`${id}-label`} className="mb-1 block text-xs font-medium text-brand-text-muted">{label}</label>
    <button ref={trigger} type="button" aria-labelledby={`${id}-label`} aria-expanded={open} aria-controls={id} onClick={toggle} className={`${field} flex items-center justify-between gap-2 text-left`}><span className={value ? "" : "text-brand-text-muted"}>{value || (kind === "date" ? "选择日期" : "可选")}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0 text-brand-blue" aria-hidden="true">{kind === "date" ? <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}</svg></button>
    {open && <div id={id} role="group" aria-label={`${label}选择`} className={`absolute top-full z-50 mt-2 rounded-xl border border-brand-blue/20 bg-card p-3 shadow-xl shadow-brand-blue/10 ${kind === "date" ? "left-0 w-[min(280px,80vw)]" : "w-[min(240px,75vw)] " + (label.includes("结束") ? "right-0" : "left-0")}`}>
      {kind === "date" ? <>
        <div className="mb-2 flex items-center justify-between"><button type="button" aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className={smallButton}>‹</button><span className="text-sm font-semibold text-brand-navy">{month.getFullYear()} 年 {month.getMonth() + 1} 月</span><button type="button" aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className={smallButton}>›</button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day} className="py-1 text-brand-text-muted">{day}</span>)}{days.map((day) => { const key = dateValue(day); return <button type="button" key={key} aria-label={key} aria-pressed={value === key} onClick={() => choose(key)} className={`aspect-square rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${value === key ? "bg-brand-orange text-white" : day.getMonth() !== month.getMonth() ? "text-brand-text-muted opacity-40 hover:bg-brand-blue/10" : "text-brand-text-body hover:bg-brand-blue/10 hover:text-brand-blue"} ${key === dateValue(new Date()) && value !== key ? "ring-1 ring-inset ring-brand-blue/40" : ""}`}>{day.getDate()}</button>; })}</div>
        <div className="mt-2 flex justify-between border-t border-brand-border-subtle pt-2"><button type="button" onClick={() => choose("")} className="rounded-lg px-2 py-1 text-xs text-brand-text-muted hover:bg-brand-blue/5">清空</button><button type="button" onClick={() => choose(dateValue(new Date()))} className="rounded-lg bg-brand-blue/10 px-3 py-1 text-xs text-brand-blue">今天</button></div>
      </> : <>
        <input autoFocus aria-label="输入时分" value={clock} onChange={(event) => { setClock(event.target.value); setError(""); }} placeholder="19:00" maxLength={5} className={`${field} text-center tabular-nums`} />
        <div ref={timeColumns} className="mt-2 grid grid-cols-2 gap-2">{[Array.from({ length: 24 }, (_, i) => pad(i)), Array.from({ length: 60 }, (_, i) => pad(i))].map((items, part) => <div key={part}><p className="mb-1 text-center text-xs text-brand-text-muted">{part === 0 ? "时" : "分"}</p><div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto rounded-lg bg-brand-blue/5 p-1">{items.map((item) => <button type="button" key={item} data-selected={clock.split(":")[part] === item} aria-label={`${item}${part === 0 ? "时" : "分"}`} onClick={() => changePart(part, item)} className={`rounded-md py-1.5 text-xs tabular-nums transition ${clock.split(":")[part] === item ? "bg-brand-blue/15 font-semibold text-brand-blue" : "text-brand-text-body hover:bg-brand-blue/10"}`}>{item}</button>)}</div></div>)}</div>
        {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-3 flex justify-between"><button type="button" onClick={() => choose("")} className="rounded-lg px-2 py-1.5 text-xs text-brand-text-muted hover:bg-brand-blue/5">清空</button><button type="button" onClick={() => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) choose(clock); else setError("请输入有效时间，如 19:00"); }} className="btn-primary rounded-lg px-3 py-1.5 text-xs">确定</button></div>
      </>}
    </div>}
  </div>;
}
