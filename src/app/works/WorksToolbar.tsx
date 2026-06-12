"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "date", label: "时间" },
  { value: "name", label: "名称" },
  { value: "likes", label: "喜欢" },
];

export default function WorksToolbar({ currentQ }: { currentQ?: string }) {
  const router = useRouter();
  const rawParams = useSearchParams();

  const [searchOpen, setSearchOpen] = useState(!!currentQ);
  const [searchValue, setSearchValue] = useState(currentQ || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开搜索时自动聚焦
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // 切换搜索框开关
  const toggleSearch = useCallback(() => {
    if (searchOpen && searchValue) {
      setSearchValue("");
      setSearchOpen(false);
      const params = new URLSearchParams(rawParams.toString());
      params.delete("q");
      router.replace(`/works?${params.toString()}`);
    } else {
      setSearchOpen(!searchOpen);
    }
  }, [searchOpen, searchValue, rawParams, router]);

  // 输入时防抖搜索
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
        params.set("page", "1");
        router.replace(`/works?${params.toString()}`);
      }, 400);
    },
    [rawParams, router]
  );

  // 切换排序
  const changeSort = useCallback(
    (sort: string) => {
      const params = new URLSearchParams(rawParams.toString());
      if (sort !== "date") {
        params.set("sort", sort);
      } else {
        params.delete("sort");
      }
      params.set("page", "1");
      router.replace(`/works?${params.toString()}`);
    },
    [rawParams, router]
  );

  const currentSort = rawParams.get("sort") || "date";

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {/* 搜索区域 */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={toggleSearch}
          className="w-9 h-9 flex items-center justify-center rounded-lg border transition-colors shrink-0"
          style={{
            borderColor: "#D0DEE8",
            background: searchOpen ? "#E6F0F8" : "#fff",
            color: searchOpen ? "#3388BB" : "#999",
          }}
          title={searchOpen ? "关闭搜索" : "搜索"}
        >
          {searchOpen ? "✕" : "🔍"}
        </button>
        <div
          className="overflow-hidden transition-all duration-300"
          style={{
            maxWidth: searchOpen ? "220px" : "0px",
            opacity: searchOpen ? 1 : 0,
            marginLeft: searchOpen ? "0.5rem" : "0",
          }}
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
                router.replace(`/works?${params.toString()}`);
              }
            }}
            placeholder="搜索作品名称或简介..."
            className="bg-white border rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
            style={{ borderColor: "#D0DEE8", color: "#333", width: "220px" }}
          />
        </div>
      </div>

      {/* 排序 */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs mr-1 shrink-0" style={{ color: "#999" }}>排序:</span>
        {SORT_OPTIONS.map((s) => {
          const isActive = currentSort === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => changeSort(s.value)}
              className="px-2 py-1 rounded text-xs transition-colors"
              style={{
                background: isActive ? "#E38043" : "transparent",
                color: isActive ? "#fff" : "#999",
                border: isActive ? "none" : "1px solid #D0DEE8",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
