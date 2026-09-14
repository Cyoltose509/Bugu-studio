"use client";

/**
 * 作品无限滚动网格
 *
 * 排序/筛选变化时：立刻用 /api/works 客户端重拉（可取消），
 * 不再傻等整页 RSC refresh，所以手感会快很多。
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectCard, { ProjectCardProject } from "@/components/projects/ProjectCard";
import WorkCardSkeleton from "./WorkCardSkeleton";

interface Props {
  initialItems: ProjectCardProject[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  filters: {
    types?: string;
    year?: string;
    tag?: string;
    q?: string;
    sort?: string;
  };
  total: number;
}

function filtersKey(f: {
  types?: string | null;
  year?: string | null;
  tag?: string | null;
  q?: string | null;
  sort?: string | null;
}) {
  return [
    f.types || "",
    f.year || "",
    f.tag || "",
    f.q || "",
    f.sort || "date",
  ].join("|");
}

export default function WorksInfiniteGrid({
  initialItems,
  initialNextCursor,
  initialHasMore,
  filters: seedFilters,
  total: seedTotal,
}: Props) {
  const sp = useSearchParams();
  const urlFilters = useMemo(
    () => ({
      types: sp.get("types") || undefined,
      year: sp.get("year") || undefined,
      tag: sp.get("tag") || undefined,
      q: sp.get("q") || undefined,
      sort: sp.get("sort") || undefined,
    }),
    [sp],
  );
  const urlKey = filtersKey(urlFilters);

  const [items, setItems] = useState<ProjectCardProject[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(seedTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [clickingId, setClickingId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const router = useRouter();

  const loadingMoreRef = useRef(false);
  const cursorRef = useRef(cursor);
  const clickingRef = useRef(false);
  const loadedKeyRef = useRef(filtersKey(seedFilters));
  const filtersRef = useRef(urlFilters);
  filtersRef.current = urlFilters;

  const handleCardClick = useCallback(
    (id: string, slug: string) => {
      clickingRef.current = true;
      setClickingId(id);
      router.push(`/works/${slug}`);
    },
    [router],
  );

  // URL 筛选/排序变了 → 立刻重拉第一页（AbortController 防连点）
  useEffect(() => {
    if (urlKey === loadedKeyRef.current) return;

    const ac = new AbortController();
    const f = urlFilters;

    (async () => {
      setReloading(true);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      try {
        const params = new URLSearchParams();
        if (f.types) params.set("types", f.types);
        if (f.year) params.set("year", f.year);
        if (f.tag) params.set("tag", f.tag);
        if (f.q) params.set("q", f.q);
        if (f.sort) params.set("sort", f.sort);
        params.set("total", "1");

        const res = await fetch(`/api/works?${params}`, {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("reload failed");
        const data = await res.json();

        setItems(data.items);
        cursorRef.current = data.nextCursor;
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        if (typeof data.total === "number") setTotal(data.total);
        loadedKeyRef.current = urlKey;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // 失败时仍标记已尝试，避免死循环狂请求
        loadedKeyRef.current = urlKey;
      } finally {
        if (!ac.signal.aborted) setReloading(false);
      }
    })();

    return () => ac.abort();
  }, [urlKey, urlFilters]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || reloading || clickingRef.current) return;
    if (!hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const f = filtersRef.current;
      const params = new URLSearchParams();
      if (cursorRef.current) params.set("cursor", cursorRef.current);
      if (f.types) params.set("types", f.types);
      if (f.year) params.set("year", f.year);
      if (f.tag) params.set("tag", f.tag);
      if (f.q) params.set("q", f.q);
      if (f.sort) params.set("sort", f.sort);

      const res = await fetch(`/api/works?${params}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setItems((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = data.items.filter(
          (p: ProjectCardProject) => !existingIds.has(p.id),
        );
        return [...prev, ...newItems];
      });
      cursorRef.current = data.nextCursor;
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // 静默失败
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      if (observerRef.current && sentinelRef.current) {
        observerRef.current.unobserve(sentinelRef.current);
        observerRef.current.observe(sentinelRef.current);
      }
    }
  }, [hasMore, reloading]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || reloading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [reloading, hasMore]);

  if (reloading) {
    return (
      <>
        <div className="text-sm mb-4 text-brand-text-muted animate-pulse">
          正在更新列表…
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-stretch">
          {Array.from({ length: 8 }).map((_, i) => (
            <WorkCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-brand-text-muted">
        <p className="text-base mb-2">没有找到匹配的作品</p>
        <p className="text-sm mb-4">试试换个筛选条件，或清除筛选后再看</p>
        <button
          type="button"
          onClick={() => {
            router.push("/works");
          }}
          className="text-sm px-4 py-2 rounded-lg border border-brand-border-subtle text-brand-blue hover:bg-brand-surface transition-colors"
        >
          清除筛选
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-sm mb-4 text-brand-text-muted">
        已加载 {items.length} / {total} 件作品
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-stretch">
        {items.map((p, idx) => (
          <ProjectCard
            key={p.id}
            project={p}
            idx={idx}
            clicking={clickingId === p.id}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      <div className="mt-6">
        {hasMore && <div ref={sentinelRef} className="h-1" />}
        {loadingMore && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-stretch">
            {Array.from({ length: 4 }).map((_, i) => (
              <WorkCardSkeleton key={i} />
            ))}
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="text-center py-8 text-sm flex flex-col items-center gap-3 text-[#bbb] dark:text-[#556]">
            <span>— 已到底部，共 {total} 件作品 —</span>
          </div>
        )}
      </div>
    </>
  );
}
