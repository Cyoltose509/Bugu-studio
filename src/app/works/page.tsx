import {Metadata} from "next";
import Link from "next/link";
import {Suspense} from "react";
import {prisma} from "@/lib/db/prisma";
import {cachedQuery} from "@/lib/db/cache";
import {ensureDefaultTags} from "@/lib/db/tags";
import {auth} from "@/lib/auth/auth";
import {ProjectStatus} from "@prisma/client";
import WorkCardServer from "@/components/works/WorkCardServer";
import WorkCardSkeleton from "@/components/works/WorkCardSkeleton";
import LogoLoading from "@/components/ui/LogoLoading";
import FilterSidebarClient from "@/components/works/FilterSidebarClient";
import WorksToolbar from "./WorksToolbar";

export const metadata: Metadata = {title: "作品库", description: "浏览历届社员创作的所有游戏作品"};
export const dynamic = "force-dynamic"; // cachedQuery 提供缓存，避免构建时连接池耗尽

interface PageProps {
    searchParams: Promise<{ q?: string; types?: string; tag?: string; year?: string; page?: string; sort?: string }>;
}

export default async function WorksPage({searchParams}: PageProps) {
    await ensureDefaultTags();
    const params = await searchParams;
    const page = parseInt(params.page || "1", 10);

    // 侧栏数据（立即渲染，有长 TTL 缓存）
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
    // 指定分组顺序
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
                <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>类型</h3>
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
                    <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>年份</h3>
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
                <h3 className="text-sm font-semibold mb-3" style={{color: "#555"}}>标签</h3>
                <div className="space-y-3">
                    {sortedGroups.map((group) => (
                        <div key={group}>
                            <h4 className="text-xs font-medium mb-1.5" style={{color: "#999"}}>{group}</h4>
                            <div className="flex flex-wrap gap-2">
                                {(tagGroups[group] || []).map(tag => (
                                    <Link key={tag.slug} href={buildUrl(params, {
                                        tag: params.tag === tag.slug ? void 0 : tag.slug,
                                        page: 1
                                    })}
                                          className={`text-xs px-2 py-1 rounded transition-all ${params.tag === tag.slug ? "ring-1 ring-[#88C232] ring-offset-1" : "opacity-70 hover:opacity-100"}`}
                                          style={{backgroundColor: "rgba(136,194,50,0.13)", color: "#88C232"}}>
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

    return (
        <div className="container mx-auto px-4 py-10 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold" style={{color: "#25547A"}}>作品库</h1>
                {/* 桌面端统计，移动端统计在 FilterSidebarClient 中 */}
                <p style={{color: "#777"}} className="mt-2 hidden lg:block">共 {total} 件作品</p>
            </div>
            <div className="flex flex-col lg:flex-row gap-8">
                <FilterSidebarClient total={total}>
                    {filterContent}
                </FilterSidebarClient>

                {/* 主区域 — 工具栏 + 作品网格 */}
                <div className="flex-1">
                    <WorksToolbar currentQ={params.q}/>

                    <Suspense fallback={<LogoLoading text="正在加载作品..."/>}>
                        <WorksGrid params={params} page={page} total={total}/>
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

/** 作品网格 — 渐进式流式加载：先获取 ID 列表，然后每个卡片独立加载独立渲染 */
async function WorksGrid({params, page, total}: { params: Record<string, any>; page: number; total: number }) {
    const pageSize = 12;
    const skip = (page - 1) * pageSize;
    const sort = params.sort || "date";

    const orderBy: any = sort === "name"
        ? [{title: "asc"}]
        : sort === "likes"
            ? [{likes: {_count: "desc"}}, {publishedAt: "desc"}]
            : [{developYear: "desc"}, {publishedAt: "desc"}];

    const where = buildWhere(params);

    // 第一步：只查询 ID 列表（极快，无 include）
    const projectIds = await cachedQuery(
        `works:ids:${page}:${params.types || ''}:${params.year || ''}:${params.tag || ''}:${params.q || ''}:${sort}`,
        () =>
            prisma.project.findMany({
                where,
                skip,
                take: pageSize,
                orderBy,
                select: {id: true},
            }),
        120,
    );

    // 批量查询点赞状态（全局缓存，一次查询）
    const session = await auth().catch(() => null);
    let likedProjectIds = new Set<string>();
    if (session?.user?.id && projectIds.length > 0) {
        const ids = projectIds.map(p => p.id);
        const liked = await cachedQuery(`works:likes:${session.user.id}`, () =>
                prisma.projectLike.findMany({
                    where: {userId: session.user.id},
                    select: {projectId: true},
                })
            , 60);
        const idSet = new Set(ids);
        likedProjectIds = new Set(liked.filter((l) => idSet.has(l.projectId)).map((l) => l.projectId));
    }

    const totalPages = Math.ceil(total / pageSize);

    return (
        <>
            {projectIds.length === 0 ? (
                <div className="text-center py-20" style={{color: "#999"}}>
                    <div className="text-4xl mb-4">🔍</div>
                    <p>没有找到匹配的作品</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {/* 每张卡片独立 Suspense — 数据到了就渲染，自然形成逐个弹出效果 */}
                    {projectIds.map(({id}, idx) => (
                        <Suspense key={id} fallback={<WorkCardSkeleton />}>
                            <WorkCardServer id={id} idx={idx} liked={likedProjectIds.has(id)} />
                        </Suspense>
                    ))}
                </div>
            )}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                    {page > 1 && <Link href={buildUrl(params, {page: page - 1})}
                                       className="btn-secondary px-4 py-2 rounded-lg text-sm">上一页</Link>}
                    <span className="px-4 py-2 text-sm" style={{color: "#777"}}>{page} / {totalPages}</span>
                    {page < totalPages && <Link href={buildUrl(params, {page: page + 1})}
                                                className="btn-secondary px-4 py-2 rounded-lg text-sm">下一页</Link>}
                </div>
            )}
        </>
    );
}

function buildWhere(params: Record<string, any>) {
    const where: any = {status: ProjectStatus.PUBLISHED};
    if (params.types) {
        const typeList = params.types.split(",").filter(Boolean)
            .map((t: string) => {
                // 兼容旧类型参数：STEAM→OFFICIAL_RELEASE, DEMO/ITCH→TRIAL_DEMO
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
        <Link href={href} className={`block text-sm px-3 py-1.5 rounded transition-colors ${active ? "font-medium" : ""}`}
              style={active ? {background: "rgba(37,84,122,0.07)", color: "#25547A"} : {color: "#777"}}>
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
