"use client";

/**
 * 自动保存的状态提示与草稿恢复条。
 * 只做展示，状态由 useAutosave / useFormDraft 提供。
 */

import type { AutosaveStatus as Status } from "@/lib/hooks/use-autosave";

function timeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function AutosaveStatus({
  status,
  lastSavedAt,
  error,
  className = "",
}: {
  status: Status;
  lastSavedAt: Date | null;
  error?: string | null;
  className?: string;
}) {
  if (status === "idle" || status === "blocked") return null;

  const base = `inline-flex items-center gap-1.5 text-xs leading-none ${className}`;

  if (status === "waiting") {
    return (
      <span className={`${base} text-brand-text-muted`} aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
        未保存的更改
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span className={`${base} text-brand-text-muted`} aria-live="polite">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-blue" />
        自动保存中…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={`${base} text-red-600 dark:text-red-400`} title={error ?? undefined} aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        自动保存失败{error ? `：${error}` : "，稍后重试"}
      </span>
    );
  }

  return (
    <span className={`${base} text-brand-text-muted`} aria-live="polite">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ui-text-green)" }} />
      已自动保存{lastSavedAt ? ` ${timeLabel(lastSavedAt)}` : ""}
    </span>
  );
}

/** 「上次有未保存内容，要捡回来吗」的提示条 */
export function DraftNotice({
  at,
  onRestore,
  onDiscard,
  hint,
  className = "",
}: {
  at: number;
  onRestore: () => void;
  onDiscard: () => void;
  hint?: string;
  className?: string;
}) {
  const stamp = timeLabel(new Date(at));
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-xs text-brand-text-body ${className}`}
    >
      <span className="min-w-0 flex-1">
        {hint ?? `发现 ${stamp} 的本地草稿，内容还没提交过。`}
      </span>
      <button
        type="button"
        onClick={onRestore}
        className="rounded-md bg-brand-blue px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
      >
        恢复草稿
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="rounded-md border border-brand-border-subtle px-2.5 py-1 text-xs text-brand-text-secondary transition-colors hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
      >
        丢弃
      </button>
    </div>
  );
}
