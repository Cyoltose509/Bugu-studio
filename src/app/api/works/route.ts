/**
 * GET /api/works — 作品无限滚动加载 API
 * 支持 cursor-based 分页（用 lastId 作为游标）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";
import { auth } from "@/lib/auth/auth";

const PAGE_SIZE = 16; // 4x4

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor"); // 上一批最后一个 id
    const types = searchParams.get("types");
    const year = searchParams.get("year");
    const tag = searchParams.get("tag");
    const q = searchParams.get("q");
    const sort = searchParams.get("sort") || "date";

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
    if (year) where.developYear = parseInt(year);
    if (q) where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
    ];
    if (tag) where.tags = { some: { tag: { slug: tag } } };

    // 排序
    const orderBy: any = sort === "name"
        ? [{ title: "asc" }]
        : sort === "likes"
            ? [{ likes: { _count: "desc" } }, { publishedAt: "desc" }]
            : [{ developYear: "desc" }, { publishedAt: "desc" }];

    // cursor-based 分页：找出 cursor 项的排序值，然后取之后的项
    const projects = await prisma.project.findMany({
        where: cursor ? { ...where, id: { not: undefined } } : where,
        orderBy,
        take: PAGE_SIZE + 1,
        // 用 skip+cursor 实现：先找到 cursor 位置，跳过已加载
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            description: true,
            coverImage: true,
            type: true,
            developYear: true,
            publishedAt: true,
            tags: { include: { tag: true } },
            awards: true,
            _count: { select: { likes: true } },
            members: {
                orderBy: { sortOrder: "asc" },
                include: {
                    member: {
                        select: { displayName: true, avatar: true, user: { select: { image: true } } },
                    },
                    user: { select: { id: true, name: true, image: true } },
                },
            },
        },
    });

    const hasMore = projects.length > PAGE_SIZE;
    const items = hasMore ? projects.slice(0, PAGE_SIZE) : projects;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // 查询当前用户点赞状态
    const session = await auth().catch(() => null);
    let likedSet = new Set<string>();
    if (session?.user?.id && items.length > 0) {
        const liked = await prisma.projectLike.findMany({
            where: { userId: session.user.id, projectId: { in: items.map((p) => p.id) } },
            select: { projectId: true },
        });
        likedSet = new Set(liked.map((l) => l.projectId));
    }

    return NextResponse.json({
        items: items.map((p) => ({ ...p, liked: likedSet.has(p.id) })),
        nextCursor,
        hasMore,
    });
}
