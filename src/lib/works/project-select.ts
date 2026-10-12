/**
 * 作品列表（卡片）需要的字段
 *
 * 首屏 RSC 与 /api/works 必须取同一套字段，否则客户端拉回来的数据和
 * 服务端渲染的第一页对不上；名称排序要一次取全量再切片，所以只选卡片用得上的。
 */
export const PROJECT_SELECT = {
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
    aiUsages: true,
    _count: { select: { likes: true } },
    images: {
        orderBy: { sortOrder: "asc" as const },
        take: 4,
        select: { url: true, altText: true },
    },
    members: {
        orderBy: { sortOrder: "asc" as const },
        include: {
            member: {
                select: { displayName: true, avatar: true, user: { select: { image: true } } },
            },
            user: { select: { id: true, name: true, image: true } },
        },
    },
} as const;
