"use client";

/**
 * 作品库筛选侧栏（移动端抽屉 + 桌面固定栏）
 * 通过 context 把「关闭抽屉」传给筛选链接，点完筛选项自动收起。
 *
 * 已选条件胶囊：
 * - 移动端：筛选按钮右侧
 * - 桌面端：主内容区工具栏下方（见 WorksToolbar / ActiveFilterChips）
 * 件数只在主区「已加载 x / y」展示，侧栏不再重复。
 */
import { createContext, useCallback, useContext, useState } from "react";
import ActiveFilterChips from "./ActiveFilterChips";

const CloseFilterContext = createContext<(() => void) | null>(null);

export function useCloseWorksFilter() {
  return useContext(CloseFilterContext);
}

export type ActiveFilterChip = {
  key: string;
  label: string;
  /** 点胶囊清除该条件后的 URL */
  clearHref: string;
};

interface Props {
  activeChips?: ActiveFilterChip[];
  children: React.ReactNode;
}

export default function FilterSidebarClient({
  activeChips = [],
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <CloseFilterContext.Provider value={close}>
      {/* 移动端：筛选按钮 + 已选条件胶囊 */}
      <div className="lg:hidden flex items-center gap-2 mb-4 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors active:scale-95 shrink-0 border-brand-border-subtle ${
            open ? "bg-brand-surface text-brand-blue" : "bg-card text-brand-text-body"
          }`}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          筛选
        </button>

        <ActiveFilterChips
          chips={activeChips}
          className="overflow-x-auto scrollbar-none"
        />
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

      {/* 桌面端侧边栏 — 只放筛选项，已选胶囊在主区 */}
      <aside className="hidden lg:block lg:w-56 shrink-0 sticky top-24 self-start">
        {children}
      </aside>
    </CloseFilterContext.Provider>
  );
}
