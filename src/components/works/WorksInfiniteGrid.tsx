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
import { useLang } from "@/lib/i18n/LangProvider";
import { t, tpl } from "@/lib/i18n/dict";

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
  const { lang } = useLang();
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
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

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

  // 重试：把已加载标记清掉，effect 才会重新拉一次
  const handleRetry = useCallback(() => {
    loadedKeyRef.current = "";
    setRetryNonce((n) => n + 1);
  }, []);

  // URL 筛选/排序变了 → 立刻重拉第一页（AbortController 防连点 + 超时兜底）
  useEffect(() => {
    if (urlKey === loadedKeyRef.current) return;

    const ac = new AbortController();
    const f = urlFilters;
    // 数据库偶尔不可达，请求会长时间挂着；与其让骨架屏一直转，不如告诉用户
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, 10000);

    (async () => {
      setReloading(true);
      setReloadError(null);
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
        if (ac.signal.aborted && !timedOut) return;
        setReloadError(
          timedOut ? t(lang, "works.error.timeout") : t(lang, "works.error.fail"),
        );
        // 失败时仍标记已尝试，避免死循环狂请求
        loadedKeyRef.current = urlKey;
      } finally {
        clearTimeout(timer);
        if (!ac.signal.aborted || timedOut) setReloading(false);
      }
    })();

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [urlKey, urlFilters, retryNonce]);

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
          {t(lang, "works.loading")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-stretch">
          {Array.from({ length: 8 }).map((_, i) => (
            <WorkCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  if (reloadError) {
    return (
      <div className="text-center py-20 text-brand-text-muted">
        <p className="text-base mb-2">{reloadError}</p>
        <p className="text-sm mb-4">
          {t(lang, "works.error.stale")}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm px-4 py-2 rounded-lg border border-brand-border-subtle text-brand-blue hover:bg-brand-surface transition-colors"
          >
            {t(lang, "works.retry")}
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="text-sm px-4 py-2 rounded-lg text-brand-text-muted hover:text-brand-text transition-colors"
          >
            {t(lang, "works.refresh")}
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-brand-text-muted">
        <p className="text-base mb-2">{t(lang, "works.empty.title")}</p>
        <p className="text-sm mb-4">{t(lang, "works.empty.desc")}</p>
        <button
          type="button"
          onClick={() => {
            router.push("/works");
          }}
          className="text-sm px-4 py-2 rounded-lg border border-brand-border-subtle text-brand-blue hover:bg-brand-surface transition-colors"
        >
          {t(lang, "works.clearFilters")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-sm mb-4 text-brand-text-muted">
        {tpl(lang, "works.loaded", { n: items.length, m: total })}
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
            <span>{tpl(lang, "works.end", { m: total })}</span>
          </div>
        )}
      </div>
    </>
  );
}
