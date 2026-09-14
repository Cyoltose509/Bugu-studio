"use client";

/**
 * 作品库工具栏：搜索 + 排序 + 桌面已选胶囊
 *
 * 排序用乐观 UI：一点就高亮，只改 URL，列表由 WorksInfiniteGrid 客户端拉 API，
 * 不再 router.refresh() 卡整页。
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ActiveFilterChips from "./ActiveFilterChips";
import FilterNavLink from "./FilterNavLink";
import type { ActiveFilterChip } from "./FilterSidebarClient";

const SORT_OPTIONS = [
  { value: "date", label: "时间" },
  { value: "name", label: "名称" },
  { value: "likes", label: "喜欢" },
];

export default function WorksToolbar({
  currentQ,
  chips = [],
  clearAllHref,
}: {
  currentQ?: string;
  chips?: ActiveFilterChip[];
  clearAllHref?: string;
}) {
  const router = useRouter();
  const rawParams = useSearchParams();

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
      // 只改 URL：列表组件监听 searchParams 后自己拉 API，比整页 refresh 快一截
      router.replace(qs ? `/works?${qs}` : "/works", { scroll: false });
    },
    [router],
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
            title={searchOpen ? "关闭搜索" : "搜索"}
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
              placeholder="搜索作品名称或简介..."
              className="bg-card border rounded-lg px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent border-brand-border-subtle text-brand-text-heading w-[220px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto" role="group" aria-label="排序方式">
          <span className="text-xs mr-1 shrink-0 text-brand-text-muted">排序:</span>
          {SORT_OPTIONS.map((s) => {
            const isActive = displaySort === s.value;
            const isPending = optimisticSort === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => changeSort(s.value)}
                aria-pressed={isActive}
                className={`relative px-2.5 py-1 rounded text-xs transition-all active:scale-95 ${
                  isActive
                    ? "bg-brand-orange text-white shadow-sm"
                    : "bg-transparent text-brand-text-muted border border-brand-border-subtle hover:border-brand-orange/40 hover:text-brand-orange"
                } ${isPending && isActive ? "ring-2 ring-brand-orange/40 ring-offset-1" : ""}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="hidden lg:flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0 text-brand-text-muted">已选</span>
          <ActiveFilterChips chips={chips} className="flex-wrap" />
          {clearAllHref && (
            <FilterNavLink
              href={clearAllHref}
              active={false}
              className="text-xs shrink-0 text-brand-text-muted hover:text-brand-blue transition-colors"
            >
              清除全部
            </FilterNavLink>
          )}
        </div>
      )}
    </div>
  );
}
