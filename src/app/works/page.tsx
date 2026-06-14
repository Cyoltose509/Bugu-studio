import {Metadata} from "next";
import Link from "next/link";
import {Suspense} from "react";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ensureDefaultTags} from "@/lib/db/tags";
import {auth} from "@/lib/auth/auth";
import {ProjectStatus} from "@prisma/client";
import LogoLoading from "@/components/ui/LogoLoading";
import FilterSidebarClient from "@/components/works/FilterSidebarClient";
import WorksToolbar from "@/components/works/WorksToolbar";
import WorksInfiniteGrid from "@/components/works/WorksInfiniteGrid";

export const metadata: Metadata = {title: "作品库", description: "浏览历届社员创作的所有游戏作品"};
export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

const PAGE_SIZE = 16; // 4x4

interface PageProps {
    searchParams: Promise<{ q?: string; types?: string; tag?: string; year?: string; sort?: string }>;
}

/**
 * 作品库页面 — 流式渲染
 *
 * 架构要点：
 * 1. 主组件仅 resolve searchParams（~0ms），立即返回页面骨架
 * 2. 侧栏数据和作品网格各自在 Suspense 中流式加载
 * 3. 避免 force-dynamic 页面因 DB 查询阻塞首字节（TTFB）
 *
 * 导航体验：点击"作品库" → 页面骨架瞬间出现 → 数据逐步填充
 */
export default async function WorksPage({searchParams}: PageProps) {
    // 仅解析 URL 参数 — 无 DB 操作，瞬间完成
    const params = await searchParams;

    return (
        <div className="container mx-auto px-4 py-10 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-brand-navy">作品库</h1>
            </div>
            <div className="flex flex-col lg:flex-row gap-8">
                {/* ── 侧栏：流式加载（tags/total/years 数据）── */}
                <Suspense fallback={<LogoLoading text="正在加载筛选..." />}>
                    <WorksSidebarData params={params} />
                </Suspense>

                {/* ── 主区域：工具栏（即时渲染）+ 作品网格（流式加载）── */}
                <div className="flex-1">
                    <WorksToolbar currentQ={params.q} />

                    <Suspense fallback={<LogoLoading text="正在加载作品..." />}>
                        <WorksFirstPage params={params} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   侧栏数据 — 异步组件（Suspense 包裹，流式加载）
   ═══════════════════════════════════════════════════════════════════ */

async function WorksSidebarData({ params }: { params: Record<string, any> }) {
    await ensureDefaultTags();
    const [tags, total, years] = await Promise.all([
        cachedQuery('works:sidebar:tags', () =>
                prisma.tag.findMany({
                    orderBy: {sortOrder: "asc"},
                    include: {_count: {select: {projects: {where: {project: {status: "PUBLISHED"}}}}}}
                })
            , 120),
        cachedQuery(`works:count:${JSON.stringify(params)}`, () =>
                prisma.project.count({where: buildWhere(params)})
            , 60),
        cachedQuery('works:sidebar:years', () =>
                prisma.project.groupBy({by: ["developYear"], where: {status: ProjectStatus.PUBLISHED}, orderBy: {developYear: "desc"}})
            , 120),
    ]);

    // 按 group 分组
    const tagGroups = tags.reduce<Record<string, typeof tags>>((acc, tag) => {
        const key = (tag as any).group || "其他";
        (acc[key] ??= []).push(tag);
        return acc;
    }, {});
    const groupOrder = ["引擎", "大类", "要素", "其他"];
    const sortedGroups = Object.keys(tagGroups).sort((a, b) => {
        const ia = groupOrder.indexOf(a);
        const ib = groupOrder.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    const typeOptions = [
        { value: "OFFICIAL_RELEASE", label: "正式上架" },
        { value: "TRIAL_DEMO", label: "提供试玩" },
        { value: "MINI_GAME", label: "小游戏" },
        { value: "IN_DEVELOPMENT", label: "开发阶段" },
    ] as const;

    const filterContent = (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold mb-3 text-brand-text-body">类型</h3>
                <div className="space-y-1.5">
                    <FilterLink href={buildUrl(params, {types: void 0, page: 1})} active={!params.types} label="全部类型"/>
                    {typeOptions.map(t => (
                        <FilterLink key={t.value}
                                    href={buildUrl(params, {types: t.value, page: 1})}
                                    active={params.types === t.value}
                                    label={t.label}/>
                    ))}
                </div>
            </div>
            {years.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-3 text-brand-text-body">年份</h3>
                    <div className="space-y-1.5">
                        <FilterLink href={buildUrl(params, {year: void 0, page: 1})} active={!params.year} label="全部年份"/>
                        {years.map(y => <FilterLink key={y.developYear}
                                                    href={buildUrl(params, {year: String(y.developYear), page: 1})}
                                                    active={params.year === String(y.developYear)}
                                                    label={String(y.developYear)}/>)}
                    </div>
                </div>
            )}
            <div>
                <h3 className="text-sm font-semibold mb-3 text-brand-text-body">标签</h3>
                <div className="space-y-3">
                    {sortedGroups.map((group) => (
                        <div key={group}>
                            <h4 className="text-xs font-medium mb-1.5 text-brand-text-muted">{group}</h4>
                            <div className="flex flex-wrap gap-2">
                                {(tagGroups[group] || []).map(tag => (
                                    <Link key={tag.slug} href={buildUrl(params, {
                                        tag: params.tag === tag.slug ? void 0 : tag.slug,
                                        page: 1
                                    })}
                                          className={`text-xs px-2 py-1 rounded transition-all bg-brand-green/15 text-brand-green ${params.tag === tag.slug ? "ring-1 ring-[#88C232] ring-offset-1" : "opacity-70 hover:opacity-100"}`}>
                                        {tag.name} ({tag._count.projects})
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return <FilterSidebarClient total={total}>{filterContent}</FilterSidebarClient>;
}

/* ═══════════════════════════════════════════════════════════════════
   作品首屏数据 — 异步组件（Suspense 包裹，流式加载）
   ═══════════════════════════════════════════════════════════════════ */

async function WorksFirstPage({ params }: { params: Record<string, any> }) {
    const sort = params.sort || "date";
    const orderBy: any = sort === "name"
        ? [{title: "asc"}, {id: "desc"}]
        : sort === "likes"
            ? [{likes: {_count: "desc"}}, {publishedAt: "desc"}, {id: "desc"}]
            : [{developYear: "desc"}, {publishedAt: "desc"}, {id: "desc"}];

    const where = buildWhere(params);

    // 并行获取作品列表 + 总数
    const [projects, total] = await Promise.all([
        cachedQuery(
            `works:infinite:first:${params.types || ''}:${params.year || ''}:${params.tag || ''}:${params.q || ''}:${sort}`,
            () =>
                prisma.project.findMany({
                    where,
                    take: PAGE_SIZE + 1,
                    orderBy,
                    select: {
                        id: true, slug: true, title: true, subtitle: true,
                        description: true, coverImage: true, type: true,
                        developYear: true, publishedAt: true,
                        tags: {include: {tag: true}},
                        awards: true,
                        aiUsages: true,
                        _count: {select: {likes: true}},
                        members: {
                            orderBy: {sortOrder: "asc"},
                            include: {
                                member: {
                                    select: {displayName: true, avatar: true, user: {select: {image: true}}},
                                },
                                user: {select: {id: true, name: true, image: true}},
                            },
                        },
                    },
                }),
            60,
        ),
        cachedQuery(
            `works:total:${params.types || ''}:${params.year || ''}:${params.tag || ''}:${params.q || ''}`,
            () => prisma.project.count({where}),
            60,
        ),
    ]);

    const hasMore = projects.length > PAGE_SIZE;
    const items = hasMore ? projects.slice(0, PAGE_SIZE) : projects;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // 查点赞
    const session = await auth().catch(() => null);
    let likedSet = new Set<string>();
    if (session?.user?.id && items.length > 0) {
        const liked = await cachedQuery(`works:likes:${session.user.id}`, () =>
                prisma.projectLike.findMany({
                    where: {userId: session.user.id},
                    select: {projectId: true},
                })
            , 60);
        likedSet = new Set(liked.map((l) => l.projectId));
    }

    const initialItems = items.map((p: any) => ({...p, liked: likedSet.has(p.id)}));

    return (
        <WorksInfiniteGrid
            initialItems={initialItems}
            initialNextCursor={nextCursor}
            initialHasMore={hasMore}
            filters={{
                types: params.types,
                year: params.year,
                tag: params.tag,
                q: params.q,
                sort: params.sort,
            }}
            total={total}
        />
    );
}

/* ═══════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════ */

function buildWhere(params: Record<string, any>) {
    const where: any = {status: ProjectStatus.PUBLISHED};
    if (params.types) {
        const typeList = params.types.split(",").filter(Boolean)
            .map((t: string) => {
                if (t === "STEAM") return "OFFICIAL_RELEASE";
                if (t === "DEMO" || t === "ITCH") return "TRIAL_DEMO";
                return t;
            });
        if (typeList.length > 0) where.type = { in: typeList };
    }
    if (params.year) where.developYear = parseInt(params.year);
    if (params.q) where.OR = [{title: {contains: params.q, mode: "insensitive"}}, {description: {contains: params.q, mode: "insensitive"}}];
    if (params.tag) where.tags = {some: {tag: {slug: params.tag}}};
    return where;
}

function FilterLink({href, active, label}: { href: string; active: boolean; label: string }) {
    return (
        <Link href={href} className={`block text-sm px-3 py-1.5 rounded transition-colors ${active ? "font-medium bg-brand-navy/10 text-brand-navy" : "text-brand-text-secondary"}`}>
            {label}
        </Link>
    );
}

function buildUrl(current: Record<string, any>, overrides: Record<string, any>): string {
    const params = new URLSearchParams();
    const merged = {...current, ...overrides};
    for (const [k, v] of Object.entries(merged)) {
        if (v !== void 0 && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return `/works${qs ? `?${qs}` : ""}`;
}
