"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function FilterSection({
  title,
  defaultOpen = true,
  /** URL 上有这个参数时强制展开，避免收起后看不到当前条件 */
  activeParam,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  activeParam?: string;
  children: React.ReactNode;
}) {
  const sp = useSearchParams();
  const hasActive = Boolean(activeParam && sp.get(activeParam));
  const [open, setOpen] = useState(defaultOpen || hasActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 mb-2 text-sm font-semibold text-brand-text-body"
      >
        <span>{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-brand-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? children : null}
    </div>
  );
}
