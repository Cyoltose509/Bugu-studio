"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Size = "small" | "medium" | "large";

const LABELS: Record<Size, string> = {
  small: "▦ 紧凑",
  medium: "▧ 标准",
  large: "▨ 大图",
};

export default function GridSizeToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSize = (searchParams.get("size") || "medium") as Size;

  const setSize = useCallback((s: Size) => {
    const params = new URLSearchParams(searchParams.toString());
    if (s === "medium") params.delete("size");
    else params.set("size", s);
    window.history.pushState(null, "", `${pathname}?${params.toString()}`);
    window.location.reload();
  }, [pathname, searchParams]);

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs mr-1" style={{ color: "#999" }}>视图:</span>
      {(Object.keys(LABELS) as Size[]).map((s) => (
        <button
          key={s}
          onClick={() => setSize(s)}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{
            background: currentSize === s ? "#E38043" : "transparent",
            color: currentSize === s ? "#fff" : "#999",
            border: currentSize === s ? "none" : "1px solid #D0DEE8",
          }}
          type="button"
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
