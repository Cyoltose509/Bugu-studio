"use client";

/**
 * 作品库筛选侧栏（移动端底部抽屉 + 桌面固定栏）
 * 通过 context 把「关闭抽屉」传给筛选链接，点完筛选项自动收起。
 *
 * 已选条件胶囊：移动端放在抽屉内，桌面端放在主内容区工具栏下方。
 * 件数只在主区「已加载 x / y」展示，侧栏不再重复。
 *
 * 移动端说明：原来是一块 280px 的浮动面板贴在左上角，会盖住标题和两列卡片。
 * 改成右下角浮动入口 + 底部抽屉，入口不遮挡作品，抽屉只占下半屏；
 * 昼模式抽屉半透明（能透出下方作品，视觉更轻），暗色则偏实以压住深底。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  // 抽屉展开时锁住背景滚动，收起/卸载时还原
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc 关闭（外接键盘 / 平板带键盘的情况）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <CloseFilterContext.Provider value={close}>
      {/* 移动端：右下角浮动入口，不遮挡作品 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={t(lang, "works.filter.open")}
        className="lg:hidden fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-1.5 rounded-full pl-3.5 pr-4 py-2.5 text-sm font-medium shadow-lg transition-colors border border-brand-border-subtle bg-card/95 text-brand-text-heading active:scale-95 dark:bg-card/95 dark:shadow-black/40"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="10" y1="17" x2="14" y2="17" />
        </svg>
        {t(lang, "works.filter.label")}
        {activeChips.length > 0 && (
          <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-brand-orange px-1 text-[11px] leading-[18px] text-white text-center">
            {activeChips.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label={t(lang, "works.filter.label")}
        >
          {/* 点空白处收起；昼模式用浅色蒙层，暗色才压深，避免抽屉一开页面全黑 */}
          <button
            type="button"
            onClick={close}
            aria-label={t(lang, "works.filter.close")}
            className="absolute inset-0 cursor-default bg-brand-navy/15 dark:bg-black/50 animate-fade-in"
          />

          <div className="relative w-full max-h-[85dvh] flex flex-col rounded-t-2xl border-t border-brand-border-subtle shadow-2xl backdrop-blur-xl animate-fade-in bg-card/85 dark:bg-card/95 dark:shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-brand-navy">{t(lang, "works.filter.label")}</span>
                {activeChips.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange">
                    {activeChips.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {clearAllHref && (
                  <FilterNavLink href={clearAllHref} active={false} className="text-xs text-brand-blue hover:underline">
                    {t(lang, "works.clearAll")}
                  </FilterNavLink>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="text-brand-text-muted hover:text-brand-text-heading p-1 -mr-1"
                  title={t(lang, "works.filter.close")}
                  aria-label={t(lang, "works.filter.close")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5 shrink-0">
                <ActiveFilterChips chips={activeChips} className="flex-wrap" />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </div>
        </div>
      )}

      {/* 桌面端侧边栏 — 只放筛选项，已选胶囊在主区 */}
      <aside className="hidden lg:block lg:w-56 shrink-0 sticky top-24 self-start">
        {children}
      </aside>
    </CloseFilterContext.Provider>
  );
}
