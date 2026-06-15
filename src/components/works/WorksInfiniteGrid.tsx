"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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

export default function WorksInfiniteGrid({
    initialItems,
    initialNextCursor,
    initialHasMore,
    filters,
    total,
}: Props) {
    const [items, setItems] = useState<ProjectCardProject[]>(initialItems);
    const [cursor, setCursor] = useState<string | null>(initialNextCursor);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loading, setLoading] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<() => void>(() => {});
    const observerRef = useRef<IntersectionObserver | null>(null);
    const router = useRouter();
    const [clickingId, setClickingId] = useState<string | null>(null);

    // 稳定引用：所有 ProjectCard 共享同一个 callback，避免每次 render 重建
    const handleCardClick = useCallback((id: string, slug: string) => {
        clickingRef.current = true;
        setClickingId(id);
        router.push(`/works/${slug}`);
    }, [router]);

    // ref 防并发：loading state 是异步的，Observer 可能在 setLoading(true) 生效前再次触发
    const loadingRef = useRef(false);
    const cursorRef = useRef(cursor);
    const clickingRef = useRef(false);

    // 筛选变化时重置
    useEffect(() => {
        setItems(initialItems);
        setCursor(initialNextCursor);
        setHasMore(initialHasMore);
        cursorRef.current = initialNextCursor;
    }, [initialItems, initialNextCursor, initialHasMore]);

    // loadMore — 最新引用存到 ref 避免 Observer 闭包过期
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore || clickingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (cursorRef.current) params.set("cursor", cursorRef.current);
            if (filters.types) params.set("types", filters.types);
            if (filters.year) params.set("year", filters.year);
            if (filters.tag) params.set("tag", filters.tag);
            if (filters.q) params.set("q", filters.q);
            if (filters.sort) params.set("sort", filters.sort);
            const res = await fetch(`/api/works?${params.toString()}`);
            if (!res.ok) throw new Error("load failed");
            const data = await res.json();
            setItems((prev) => {
                const existingIds = new Set(prev.map((p) => p.id));
                const newItems = data.items.filter((p: ProjectCardProject) => !existingIds.has(p.id));
                return [...prev, ...newItems];
            });
            cursorRef.current = data.nextCursor;
            setCursor(data.nextCursor);
            setHasMore(data.hasMore);
        } catch {
            // 静默失败
        } finally {
            loadingRef.current = false;
            setLoading(false);
            // 加载完成后重置 Observer：先取消监听再重新监听，让交叉状态重新计算
            if (observerRef.current && sentinelRef.current) {
                observerRef.current.unobserve(sentinelRef.current);
                observerRef.current.observe(sentinelRef.current);
            }
        }
    }, [hasMore, filters]);

    // 始终保持 loadMoreRef 为最新
    useEffect(() => {
        loadMoreRef.current = loadMore;
    });

    // Observer 挂载一次，通过 loadMoreRef 始终拿到最新 callback
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMoreRef.current();
            },
            { rootMargin: "600px" }
        );
        observer.observe(sentinel);
        observerRef.current = observer;

        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, []); // 只在挂载/卸载时执行

    if (items.length === 0) {
        return (
            <div className="text-center py-20 text-brand-text-muted">
                <div className="text-4xl mb-4">🔍</div>
                <p>没有找到匹配的作品</p>
            </div>
        );
    }

    return (
        <>
            {/* 统计提示 */}
            <div className="text-sm mb-4 text-brand-text-muted">
                已加载 {items.length} / {total} 件作品
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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

            {/* 哨兵 + 加载状态 + 到底提示 */}
            <div className="mt-6">
                {hasMore && (
                    <div ref={sentinelRef} className="h-1" />
                )}
                {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <WorkCardSkeleton key={i} />
                        ))}
                    </div>
                )}
                {!hasMore && items.length > 0 && (
                    <div className="text-center py-8 text-sm flex flex-col items-center gap-3 text-[#bbb] dark:text-[#556]">
                        <span>— 已到底部，共 {total} 件作品 —</span>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-xs px-4 py-1.5 rounded border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 text-brand-text-secondary border-brand-border-subtle"
                        >
                            🔄 刷新列表
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
