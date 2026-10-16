/**
 * GET /api/works — 作品无限滚动加载 API
 * 支持 cursor-based 分页（用 lastId 作为游标）
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { isMockDataEnabled, mockListProjects } from "@/lib/mock/frontend-data";
import { cachedQuery } from "@/lib/db/cache";
import { sortByNameAndSlice } from "@/lib/works/name-sort";
import { PROJECT_DATE_ORDER_BY } from "@/lib/works/date-sort";
import { PROJECT_SELECT } from "@/lib/works/project-select";

const PAGE_SIZE = 16; // 4x4

export async function GET(request: NextRequest) {
    // 速率限制：每 IP 每分钟 60 次
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, { windowSeconds: 60, maxRequests: 60, prefix: "works:list" });
    if (!rl.allowed) {
        return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const types = searchParams.get("types");
    const year = searchParams.get("year");
    const tag = searchParams.get("tag");
    const q = searchParams.get("q")?.slice(0, 100); // 限制搜索词长度
    const sort = searchParams.get("sort") || "date";

    // 输入验证：year 必须是合法整数
    const yearNum = year ? parseInt(year) : null;
    if (year && (isNaN(yearNum!) || yearNum! < 2000 || yearNum! > 2100)) {
        return NextResponse.json({ error: "无效的年份参数" }, { status: 400 });
    }

    // 输入验证：sort 必须是指定值之一
    if (!["date", "name", "likes"].includes(sort)) {
        return NextResponse.json({ error: "无效的排序参数" }, { status: 400 });
    }

    if (isMockDataEnabled()) {
        const wantTotal = !cursor && searchParams.get("total") === "1";
        const result = mockListProjects({
            types,
            year,
            tag,
            q,
            sort,
            cursor,
            take: PAGE_SIZE,
        });
        return NextResponse.json({
            items: result.items.map((p) => ({ ...p, liked: false })),
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            ...(wantTotal ? { total: result.total } : {}),
        });
    }

    // 构建筛选条件
    const where: any = { status: ProjectStatus.PUBLISHED };
    if (types) {
        const typeList = types.split(",").filter(Boolean).map((t) => {
            if (t === "STEAM") return "OFFICIAL_RELEASE";
            if (t === "DEMO" || t === "ITCH") return "TRIAL_DEMO";
            return t;
        });
        if (typeList.length > 0) where.type = { in: typeList };
    }
    if (yearNum) where.developYear = yearNum;
    if (q) where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
    ];
    if (tag) where.tags = { some: { tag: { slug: tag } } };

    // 排序：时间/名称走索引友好字段；喜欢用 _count，并用 id 保底保证分页稳定
    // 名称排序例外：数据库排不出拼音序，改成取全量后在内存里排（见 name-sort.ts）
    const orderBy: any = sort === "likes"
        ? [{ likes: { _count: "desc" } }, { id: "desc" }]
        : PROJECT_DATE_ORDER_BY;

    const wantTotal = !cursor && searchParams.get("total") === "1";
    const scopeKey = `${types || ''}:${yearNum || ''}:${tag || ''}:${q || ''}`;

    // 首屏带 total 时并行；翻页只查列表
    // 列表与总数都走缓存：来回切换筛选/排序时不必每次都打数据库
    const listKey = `works:api:v2:${scopeKey}:${sort}:${cursor || ''}`;
    const [projects, total] = await Promise.all([
        sort === "name"
            ? cachedQuery(`works:api:byname:${scopeKey}`, () =>
                  prisma.project.findMany({ where, select: PROJECT_SELECT }),
                  60,
              ).then((rows: any[]) => sortByNameAndSlice(rows, cursor, PAGE_SIZE + 1))
            : cachedQuery(listKey, () =>
                prisma.project.findMany({
                    where,
                    orderBy,
                    take: PAGE_SIZE + 1,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                    select: PROJECT_SELECT,
                }),
                60,
            ),
        wantTotal
            ? cachedQuery(
                  `works:api:total:${scopeKey}`,
                  () => prisma.project.count({ where }),
                  60,
              )
            : Promise.resolve(null),
    ]);

    const hasMore = projects.length > PAGE_SIZE;
    const items = hasMore ? projects.slice(0, PAGE_SIZE) : projects;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // 查询当前用户点赞状态（getToken 纯 JWT 解码，不查 DB，比 auth() 快 5-10x）
    const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET,
        secureCookie: process.env.NODE_ENV === "production",
    }).catch(() => null);

    let likedSet = new Set<string>();
    if (token?.id && items.length > 0) {
        const liked = await prisma.projectLike.findMany({
            where: { userId: token.id as string, projectId: { in: items.map((p) => p.id) } },
            select: { projectId: true },
        });
        likedSet = new Set(liked.map((l) => l.projectId));
    }

    return NextResponse.json({
        items: items.map((p) => ({ ...p, liked: likedSet.has(p.id) })),
        nextCursor,
        hasMore,
        ...(typeof total === "number" ? { total } : {}),
    });
}
