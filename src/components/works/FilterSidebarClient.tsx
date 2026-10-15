"use client";

/**
 * 作品库筛选侧栏（移动端浮动栏目菜单 + 桌面固定栏）
 * 通过 context 把「关闭抽屉」传给筛选链接，点完筛选项自动收起。
 *
 * 已选条件胶囊：移动端放在浮动菜单内，桌面端放在主内容区工具栏下方。
 * 件数只在主区「已加载 x / y」展示，侧栏不再重复。
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ActiveFilterChips from "./ActiveFilterChips";
import FilterNavLink from "./FilterNavLink";
import { buildActiveChips, buildUrl } from "@/lib/works/filters";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

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
  /** slug → 标签名；已选胶囊改由客户端按 URL 实时算 */
  tagNames?: Record<string, string>;
  children: React.ReactNode;
}

export default function FilterSidebarClient({
  tagNames = {},
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const sp = useSearchParams();
  const { lang } = useLang();
  const activeChips = useMemo(
    () => buildActiveChips(Object.fromEntries(sp.entries()), tagNames, lang),
    [sp, tagNames, lang],
  );
  const clearAllHref = activeChips.length > 0
    ? buildUrl(Object.fromEntries(sp.entries()), { types: void 0, year: void 0, tag: void 0, q: void 0 })
    : undefined;

  return (
    <CloseFilterContext.Provider value={close}>
      {/* 移动端：仿历史页“栏目”入口，浮在页面上方，不占作品列表空间 */}
      <div className="lg:hidden sticky top-24 z-30 h-0 pointer-events-none">
        <aside
          className={`pointer-events-auto absolute left-0 top-0 shadow-lg backdrop-blur-md transition-[width,opacity] duration-200 ${
            open
              ? "w-[min(280px,calc(100vw-2rem))] rounded-xl border border-brand-border-subtle bg-card/95 p-4"
              : "w-9"
          }`}
        >
          {open ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-brand-navy">{t(lang, "works.filter.label")}</span>
                  {activeChips.length > 0 && <span className="text-[11px] text-brand-text-muted">{activeChips.length}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {clearAllHref && (
                    <FilterNavLink href={clearAllHref} active={false} className="text-xs text-brand-blue hover:underline">
                      {t(lang, "works.clearAll")}
                    </FilterNavLink>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="text-brand-text-muted hover:text-brand-text-heading text-xs p-0.5"
                    title={t(lang, "works.filter.close")}
                    aria-label={t(lang, "works.filter.close")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
              </div>
              {activeChips.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <ActiveFilterChips chips={activeChips} className="flex-wrap" />
                </div>
              )}
              <div className="max-h-[min(65vh,520px)] overflow-y-auto pr-1">
                {children}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={false}
              aria-label={t(lang, "works.filter.open")}
              title={t(lang, "works.filter.open")}
              className="relative w-9 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border border-brand-border-subtle bg-card/95 text-brand-text-muted hover:text-brand-text-heading shadow-md"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="text-[10px] leading-tight" style={{ writingMode: "vertical-rl" }}>{t(lang, "works.filter.label")}</span>
              {activeChips.length > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-brand-orange px-1 text-[9px] leading-4 text-white">{activeChips.length}</span>}
            </button>
          )}
        </aside>
      </div>

      {/* 桌面端侧边栏 — 只放筛选项，已选胶囊在主区 */}
      <aside className="hidden lg:block lg:w-56 shrink-0 sticky top-24 self-start">
        {children}
      </aside>
    </CloseFilterContext.Provider>
  );
}
