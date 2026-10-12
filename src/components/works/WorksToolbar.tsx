"use client";

/**
 * 作品库工具栏：搜索 + 排序 + 桌面已选胶囊
 *
 * 排序用乐观 UI：一点就高亮，只改 URL，列表由 WorksInfiniteGrid 客户端拉 API，
 * 不再 router.refresh() 卡整页。
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ActiveFilterChips from "./ActiveFilterChips";
import FilterNavLink from "./FilterNavLink";
import { buildActiveChips, buildUrl } from "@/lib/works/filters";
import { useLang } from "@/lib/i18n/LangProvider";
import { t, type DictKey } from "@/lib/i18n/dict";

const SORT_LABEL_KEY: Record<string, DictKey> = {
  date: "works.sort.date",
  name: "works.sort.name",
  likes: "works.sort.likes",
};
const SORT_VALUES = ["date", "name", "likes"] as const;

export default function WorksToolbar({
  tagNames = {},
}: {
  /** slug → 标签名，用来把 URL 里的 tag 显示成中文名 */
  tagNames?: Record<string, string>;
}) {
  const { lang } = useLang();
  const rawParams = useSearchParams();

  // 筛选只改 URL、不触发 RSC，所以已选胶囊必须按当前 URL 实时算，
  // 否则点完筛选胶囊不会变
  const currentParams = useMemo(
    () => Object.fromEntries(rawParams.entries()),
    [rawParams],
  );
  const chips = useMemo(
    () => buildActiveChips(currentParams, tagNames, lang),
    [currentParams, tagNames, lang],
  );
  const clearAllHref = chips.length
    ? buildUrl(currentParams, {
        types: void 0,
        year: void 0,
        tag: void 0,
        q: void 0,
      })
    : undefined;

  const currentQ = currentParams.q;

  const urlSort = rawParams.get("sort") || "date";
  const [optimisticSort, setOptimisticSort] = useState<string | null>(null);
  const displaySort = optimisticSort ?? urlSort;

  const [searchOpen, setSearchOpen] = useState(!!currentQ);
  const [searchValue, setSearchValue] = useState(currentQ || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOptimisticSort(null);
  }, [urlSort]);

  useEffect(() => {
    setSearchValue(currentQ || "");
    setSearchOpen(!!currentQ);
  }, [currentQ]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const navigateWorks = useCallback(
    (params: URLSearchParams) => {
      params.delete("page");
      const qs = params.toString();
      const url = qs ? `/works?${qs}` : "/works";
      if (window.location.pathname + window.location.search === url) return;
      // 原生 History API：只改 URL，不触发 RSC 导航。
      // 列表组件监听 searchParams 后自己拉 /api/works，省掉整页服务端重渲染
      window.history.replaceState(null, "", url);
    },
    [],
  );

  const toggleSearch = useCallback(() => {
    if (searchOpen && searchValue) {
      setSearchValue("");
      setSearchOpen(false);
      const params = new URLSearchParams(rawParams.toString());
      params.delete("q");
      navigateWorks(params);
    } else {
      setSearchOpen(!searchOpen);
    }
  }, [searchOpen, searchValue, rawParams, navigateWorks]);

  const onSearchInput = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(rawParams.toString());
        if (value.trim()) {
          params.set("q", value.trim());
        } else {
          params.delete("q");
        }
        navigateWorks(params);
      }, 280);
    },
    [rawParams, navigateWorks],
  );

  const changeSort = useCallback(
    (sort: string) => {
      if (sort === displaySort) return;
      setOptimisticSort(sort);
      const params = new URLSearchParams(rawParams.toString());
      if (sort !== "date") {
        params.set("sort", sort);
      } else {
        params.delete("sort");
      }
      navigateWorks(params);
    },
    [displaySort, rawParams, navigateWorks],
  );

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleSearch}
            className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors shrink-0 active:scale-95 border-brand-border-subtle ${searchOpen ? "bg-brand-surface text-brand-blue" : "bg-card text-brand-text-muted"}`}
            title={searchOpen ? t(lang, "works.closeSearch") : t(lang, "works.search")}
          >
            {searchOpen ? "✕" : "🔍"}
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${searchOpen ? "max-w-[220px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0"}`}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchValue("");
                  setSearchOpen(false);
                  const params = new URLSearchParams(rawParams.toString());
                  params.delete("q");
                  navigateWorks(params);
                }
              }}
              placeholder={t(lang, "works.searchPlaceholder")}
              className="bg-card border rounded-lg px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading w-[220px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto" role="group" aria-label={t(lang, "works.sort.aria")}>
          <span className="text-xs mr-1 shrink-0 text-brand-text-muted">{t(lang, "works.sort.label")}</span>
          {SORT_VALUES.map((value) => {
            const isActive = displaySort === value;
            const isPending = optimisticSort === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => changeSort(value)}
                aria-pressed={isActive}
                className={`relative px-2.5 py-1 rounded text-xs transition-all active:scale-95 ${
                  isActive
                    ? "bg-brand-orange text-white shadow-sm"
                    : "bg-transparent text-brand-text-muted border border-brand-border-subtle hover:border-brand-orange/40 hover:text-brand-orange"
                } ${isPending && isActive ? "ring-2 ring-brand-orange/40 ring-offset-1" : ""}`}
              >
                {t(lang, SORT_LABEL_KEY[value])}
              </button>
            );
          })}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="hidden lg:flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0 text-brand-text-muted">{t(lang, "works.selected")}</span>
          <ActiveFilterChips chips={chips} className="flex-wrap" />
          {clearAllHref && (
            <FilterNavLink
              href={clearAllHref}
              active={false}
              className="text-xs shrink-0 text-brand-text-muted hover:text-brand-blue transition-colors"
            >
              {t(lang, "works.clearAll")}
            </FilterNavLink>
          )}
        </div>
      )}
    </div>
  );
}
