"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import MiniLikeButton from "@/components/MiniLikeButton";
import ProjectCoverImage from "@/components/ProjectCoverImage";
import UserAvatar from "@/components/UserAvatar";
import WorkCardSkeleton from "./WorkCardSkeleton";

const TYPE_LABELS: Record<string, string> = {
    IN_DEVELOPMENT: "开发阶段",
    TRIAL_DEMO: "提供试玩",
    MINI_GAME: "小游戏",
    OFFICIAL_RELEASE: "正式上架",
};

interface Project {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverImage: string | null;
    type: string;
    developYear: number | null;
    liked: boolean;
    _count: { likes: number };
    awards?: string[];
    tags: { tag: { slug: string; name: string } }[];
    members: {
        id: string;
        externalName: string | null;
        member: { displayName: string; avatar: string | null; user: { image: string | null } | null } | null;
    }[];
}

interface Props {
    initialItems: Project[];
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
    const [items, setItems] = useState<Project[]>(initialItems);
    const [cursor, setCursor] = useState<string | null>(initialNextCursor);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loading, setLoading] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<() => void>(() => {});
    const observerRef = useRef<IntersectionObserver | null>(null);
    const router = useRouter();
    const [clickingId, setClickingId] = useState<string | null>(null);

    // ref 防并发：loading state 是异步的，Observer 可能在 setLoading(true) 生效前再次触发
    const loadingRef = useRef(false);
    const cursorRef = useRef(cursor);

    // 筛选变化时重置
    useEffect(() => {
        setItems(initialItems);
        setCursor(initialNextCursor);
        setHasMore(initialHasMore);
        cursorRef.current = initialNextCursor;
    }, [initialItems, initialNextCursor, initialHasMore]);

    // loadMore — 最新引用存到 ref 避免 Observer 闭包过期
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore) return;
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
                const newItems = data.items.filter((p: Project) => !existingIds.has(p.id));
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
            <div className="text-center py-20" style={{ color: "#999" }}>
                <div className="text-4xl mb-4">🔍</div>
                <p>没有找到匹配的作品</p>
            </div>
        );
    }

    return (
        <>
            {/* 统计提示 */}
            <div className="text-sm mb-4" style={{ color: "#999" }}>
                已加载 {items.length} / {total} 件作品
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {items.map((p, idx) => (
                    <WorkCard
                        key={p.id}
                        project={p}
                        idx={idx}
                        clicking={clickingId === p.id}
                        onClickStart={() => {
                            setClickingId(p.id);
                            router.push(`/works/${p.slug}`);
                        }}
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
                    <div className="text-center py-8 text-sm" style={{ color: "#bbb" }}>
                        — 已到底部，共 {total} 件作品 —
                    </div>
                )}
            </div>
        </>
    );
}

function WorkCard({
    project: p,
    idx,
    clicking,
    onClickStart,
}: {
    project: Project;
    idx: number;
    clicking: boolean;
    onClickStart: () => void;
}) {
    const delay = `${Math.min(idx % 16, 15) * 50}ms`;

    // 头像动态重叠计算
    const n = p.members.length;
    const avatarSize = 20;
    const maxW = 155;
    const normalOverlap = 6;
    const totalW = avatarSize + (n - 1) * (avatarSize - normalOverlap);
    const overlap = totalW > maxW
        ? Math.max(2, Math.min(avatarSize - 2, (n * avatarSize - maxW) / Math.max(1, n - 1)))
        : normalOverlap;

    return (
        <div style={{ animation: `cardPopIn 0.45s ${delay} both` }}>
            <a
                href={`/works/${p.slug}`}
                onClick={(e) => {
                    e.preventDefault();
                    if (!clicking) onClickStart();
                }}
                className="game-card group bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md block relative"
                style={{
                    borderColor: "#D0DEE8",
                    cursor: clicking ? "default" : "pointer",
                    opacity: clicking ? 0.65 : 1,
                    transition: "opacity 0.2s",
                }}
            >
                {clicking && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 rounded-xl">
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 shadow-lg" style={{ color: "#25547A" }}>
                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            <span className="text-sm font-medium">加载中…</span>
                        </div>
                    </div>
                )}

                {/* 封面图区域 */}
                <div className="relative aspect-video" style={{ background: "#E6F0F8" }}>
                    {p.awards && p.awards.length > 0 && (
                        <div className="absolute top-2 right-2 text-lg z-10" title={p.awards.join("、")}>🏆</div>
                    )}
                    <ProjectCoverImage src={p.coverImage} alt={p.title} priority={idx === 0} />
                    {!p.coverImage && (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: "#E6F0F8" }}>
                            <Image src="/images/logo.png" alt="" width={40} height={40} className="opacity-30" />
                        </div>
                    )}
                    <div className="absolute top-2 left-2">
                        <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">
                            {TYPE_LABELS[p.type] || p.type}
                        </span>
                    </div>
                </div>

                {/* 卡片内容区 */}
                <div className="p-4">
                    <h3
                        className="font-semibold group-hover:text-[#3388BB] transition-colors flex items-baseline gap-1.5"
                        style={{ color: "#333" }}
                    >
                        <span className="truncate">{p.title}</span>
                        {p.subtitle && (
                            <span className="text-xs font-normal flex-shrink-0" style={{ color: "#999" }}>
                                {p.subtitle}
                            </span>
                        )}
                    </h3>
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: "#777" }}>
                        {p.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.tags.slice(0, 3).map(({ tag }) => (
                            <span
                                key={tag.slug}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: "rgba(136,194,50,0.13)", color: "#88C232" }}
                            >
                                {tag.name}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3">
                        {/* 年份 */}
                        {p.developYear && (
                            <span className="text-xs flex-shrink-0" style={{ color: "#999" }}>{p.developYear}</span>
                        )}
                        <div className="flex-1" />
                        {/* ❤️ + 头像：右对齐，动态重叠 */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <MiniLikeButton
                                projectId={p.id}
                                initialCount={p._count.likes}
                                initialLiked={p.liked}
                            />
                            <div className="overflow-hidden" style={{ maxWidth: maxW + "px" }}>
                                {p.members.map((pm, i) => {
                                    const name = pm.member?.displayName || (pm as any).user?.name || pm.externalName || "?";
                                    const avatarUrl = pm.member
                                        ? pm.member.user?.image || pm.member.avatar
                                        : (pm as any).user?.image || null;
                                    return (
                                        <span
                                            key={pm.id}
                                            className="inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] text-white border border-white overflow-hidden flex-shrink-0"
                                            style={{
                                                background: pm.member ? "#E38043" : (pm as any).userId ? "#3388BB" : "#6B7280",
                                                marginLeft: i === 0 ? 0 : -overlap + "px",
                                            }}
                                            title={name}
                                        >
                                            {avatarUrl ? (
                                                <UserAvatar src={avatarUrl} name={name} size={20} />
                                            ) : (
                                                name[0]
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </a>
        </div>
    );
}
