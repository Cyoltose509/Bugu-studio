"use client";

import { useState, useCallback } from "react";

interface Props {
  total: number;
  children: React.ReactNode;
}

export default function FilterSidebarClient({ total, children }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <>
      {/* 移动端折叠按钮 + 统计信息 */}
      <div className="lg:hidden flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors active:scale-95 border-brand-border-subtle ${open ? "bg-brand-surface text-brand-blue" : "bg-card text-brand-text-body"}`}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          筛选 ({total} 件作品)
        </button>
        <span className="text-xs text-brand-text-muted">
          共 {total} 件作品
        </span>
      </div>

      {/* 移动端可折叠筛选面板 */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          open ? "max-h-[2000px] opacity-100 mb-6" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 bg-card rounded-xl border shadow-sm border-brand-border-subtle">
          {children}
        </div>
      </div>

      {/* 桌面端保持侧边栏 */}
      <aside className="hidden lg:block lg:w-56 shrink-0">{children}</aside>
    </>
  );
}
