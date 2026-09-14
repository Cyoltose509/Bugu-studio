"use client";

import FilterNavLink from "./FilterNavLink";
import type { ActiveFilterChip } from "./FilterSidebarClient";

/** 已选筛选条件胶囊：点 × 清除对应条件 */
export default function ActiveFilterChips({
  chips,
  className = "",
}: {
  chips: ActiveFilterChip[];
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
      {chips.map((chip) => (
        <FilterNavLink
          key={chip.key}
          href={chip.clearHref}
          active
          title={`清除「${chip.label}」`}
          className="inline-flex items-center gap-1 shrink-0 max-w-[10rem] pl-2.5 pr-1.5 py-1 rounded-full text-xs bg-brand-navy/10 text-brand-navy border border-brand-navy/15 hover:bg-brand-navy/15 transition-colors"
        >
          <span className="truncate">{chip.label}</span>
          <span
            className="inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] bg-brand-navy/15 shrink-0"
            aria-hidden
          >
            ×
          </span>
        </FilterNavLink>
      ))}
    </div>
  );
}
