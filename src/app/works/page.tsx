import {Metadata} from "next";
import {Suspense} from "react";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ensureDefaultTags} from "@/lib/db/tags";
import {auth} from "@/lib/auth/auth";
import {ProjectStatus} from "@prisma/client";
import LogoLoading from "@/components/ui/LogoLoading";
import FilterSidebarClient from "@/components/works/FilterSidebarClient";
import FilterNavLink from "@/components/works/FilterNavLink";
import WorksToolbar from "@/components/works/WorksToolbar";
import WorksInfiniteGrid from "@/components/works/WorksInfiniteGrid";
import EngineTagIcon from "@/components/tags/EngineTagIcon";
import { getEngineChipClass, getEngineColor, isEngineTagSlug, sortTagsEngineFirst } from "@/lib/tags/engine-tags";
import FilterLink from "@/components/works/FilterLink";
import TagFilterChips from "@/components/works/TagFilterChips";
import { PROJECT_SELECT } from "@/lib/works/project-select";
import { sortByNameAndSlice } from "@/lib/works/name-sort";
import { TYPE_OPTIONS, buildUrl } from "@/lib/works/filters";
import {
    isMockDataEnabled,
    mockListProjects,
    mockSidebarTags,
    mockSidebarYears,
} from "@/lib/mock/frontend-data";

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
                <Suspense fallback={<LogoLoading text="正在加载筛选..." compact />}>
                    <WorksSidebarData params={params} />
                </Suspense>

                {/* ── 主区域：工具栏（含桌面已选胶囊）+ 作品网格── */}
                <div className="flex-1 min-w-0">
                    <Suspense fallback={<WorksToolbar />}>
                        <WorksToolbarData params={params} />
                    </Suspense>

                    <Suspense fallback={<LogoLoading text="正在加载作品..." compact />}>
                        <WorksFirstPage params={params} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

/** 主区工具栏 — 解析标签名后渲染桌面端已选胶囊 */
async function WorksToolbarData({ params }: { params: Record<string, any> }) {
    const tags = isMockDataEnabled()
        ? mockSidebarTags()
        : await cachedQuery(
        "works:sidebar:tags",
        () =>
            prisma.tag.findMany({
                orderBy: { sortOrder: "asc" },
                include: {
                    _count: {
                        select: {
                            projects: { where: { project: { status: "PUBLISHED" } } },
                        },
                    },
                },
            }),
        120,
    );
    // 胶囊与高亮都由客户端按 URL 实时算（筛选不再触发 RSC 导航）
    const tagNames = Object.fromEntries(tags.map((t: any) => [t.slug, t.name]));

    return <WorksToolbar tagNames={tagNames} />;
}

/* ═══════════════════════════════════════════════════════════════════
   侧栏数据 — 异步组件（Suspense 包裹，流式加载）
   ═══════════════════════════════════════════════════════════════════ */

async function WorksSidebarData({ params }: { params: Record<string, any> }) {
    const [tags, years] = isMockDataEnabled()
        ? [mockSidebarTags(), mockSidebarYears()]
        : await (async () => {
            await ensureDefaultTags();
            return Promise.all([
                cachedQuery('works:sidebar:tags', () =>
                        prisma.tag.findMany({
                            orderBy: {sortOrder: "asc"},
                            include: {_count: {select: {projects: {where: {project: {status: "PUBLISHED"}}}}}}
                        })
                    , 120),
                cachedQuery('works:sidebar:years', () =>
                        prisma.project.groupBy({by: ["developYear"], where: {status: ProjectStatus.PUBLISHED}, orderBy: {developYear: "desc"}})
                    , 120),
            ]);
        })();

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

    const typeOptions = TYPE_OPTIONS;

    // 分组与排序在服务端算好，剩下的高亮/href 交给客户端按 URL 实时判定
    const tagGroupsForUi = sortedGroups
        .map((group) => ({
            group,
            tags: sortTagsEngineFirst(
                (tagGroups[group] || []).filter((tag: any) => tag._count.projects > 0),
            ).map((tag: any) => ({
                slug: tag.slug,
                name: tag.name,
                color: tag.color,
                count: tag._count.projects,
            })),
        }))
        .filter((g) => g.tags.length > 0);

    const filterContent = (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold mb-3 text-brand-text-body">类型</h3>
                <div className="space-y-1.5">
                    <FilterLink href={buildUrl(params, {types: void 0})} activeKeys={["types"]} label="全部类型"/>
                    {typeOptions.map(t => (
                        <FilterLink key={t.value}
                                    href={buildUrl(params, {types: t.value})}
                                    activeKeys={["types"]}
                                    label={t.label}/>
                    ))}
                </div>
            </div>
            {years.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-3 text-brand-text-body">年份</h3>
                    <div className="space-y-1.5">
                        <FilterLink href={buildUrl(params, {year: void 0})} activeKeys={["year"]} label="全部年份"/>
                        {years.map(y => <FilterLink key={y.developYear}
                                                    href={buildUrl(params, {year: String(y.developYear)})}
                                                    activeKeys={["year"]}
                                                    label={String(y.developYear)}/>)}
                    </div>
                </div>
            )}
            <div>
                <h3 className="text-sm font-semibold mb-3 text-brand-text-body">标签</h3>
                {/* 0 件作品的标签不展示，避免点进去空列表误以为筛选坏了 */}
                <TagFilterChips groups={tagGroupsForUi} />
            </div>
        </div>
    );

    const tagNames = Object.fromEntries(tags.map((t: any) => [t.slug, t.name]));

    return (
        <FilterSidebarClient tagNames={tagNames}>
            {filterContent}
        </FilterSidebarClient>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   作品首屏数据 — 异步组件（Suspense 包裹，流式加载）
   ═══════════════════════════════════════════════════════════════════ */

async function WorksFirstPage({ params }: { params: Record<string, any> }) {
    const sort = params.sort || "date";

    if (isMockDataEnabled()) {
        const result = mockListProjects({
            types: params.types,
            year: params.year,
            tag: params.tag,
            q: params.q,
            sort,
            take: PAGE_SIZE,
        });
        const initialItems = result.items.map((p: any) => ({ ...p, liked: false }));
        return (
            <WorksInfiniteGrid
                initialItems={initialItems}
                initialNextCursor={result.nextCursor}
                initialHasMore={result.hasMore}
                filters={{
                    types: params.types,
                    year: params.year,
                    tag: params.tag,
                    q: params.q,
                    sort: params.sort,
                }}
                total={result.total}
            />
        );
    }

    // 与 /api/works 保持一致：喜欢排序用 id 保底，分页更稳
    // 名称排序例外：Postgres 排不出拼音序，取全量后在内存排（见 lib/works/name-sort.ts）
    const orderBy: any = sort === "likes"
        ? [{likes: {_count: "desc"}}, {id: "desc"}]
        : [{developYear: "desc"}, {publishedAt: "desc"}, {id: "desc"}];

    const where = buildWhere(params);
    const scopeKey = `${params.types || ''}:${params.year || ''}:${params.tag || ''}:${params.q || ''}`;

    // 并行获取作品列表 + 总数
    const [projects, total] = await Promise.all([
        sort === "name"
            ? cachedQuery(
                  `works:byname:${scopeKey}`,
                  () => prisma.project.findMany({where, select: PROJECT_SELECT}),
                  60,
              ).then((rows: any[]) => sortByNameAndSlice(rows, null, PAGE_SIZE + 1))
            : cachedQuery(
                `works:infinite:first:v2:${scopeKey}:${sort}`,
                () =>
                    prisma.project.findMany({
                        where,
                        take: PAGE_SIZE + 1,
                        orderBy,
                        select: PROJECT_SELECT,
                    }),
                60,
            ),
        cachedQuery(
            `works:total:${scopeKey}`,
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

    // 稳定挂载：排序/筛选改 URL 后由客户端拉 API，避免 key 重挂载 + refresh 双重迟滞
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

