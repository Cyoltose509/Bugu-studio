/**
 * 作品库筛选的纯函数
 *
 * 筛选改为只改 URL（不触发 RSC 导航）之后，筛选按钮的高亮、已选胶囊都必须
 * 在客户端根据 searchParams 自己算 —— 否则点下去界面毫无反应。
 * 所以这些函数不能有服务端依赖，服务端和客户端共用同一份。
 */

export const TYPE_OPTIONS = [
    { value: "OFFICIAL_RELEASE", label: "正式上架" },
    { value: "TRIAL_DEMO", label: "提供试玩" },
    { value: "MINI_GAME", label: "小游戏" },
    { value: "IN_DEVELOPMENT", label: "开发阶段" },
] as const;

/** 合并当前 query 与覆盖项；undefined / 空串表示删除该参数 */
export function buildUrl(current: Record<string, any>, overrides: Record<string, any>): string {
    const params = new URLSearchParams();
    const merged = { ...current, ...overrides };
    // 无限滚动不用 page，避免 URL 里残留无用参数
    delete merged.page;
    for (const [k, v] of Object.entries(merged)) {
        if (v !== void 0 && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return `/works${qs ? `?${qs}` : ""}`;
}

export type ActiveFilterChip = { key: string; label: string; clearHref: string };

export function buildActiveChips(
    params: Record<string, any>,
    tagNameBySlug: Map<string, string> | Record<string, string> = {},
): ActiveFilterChip[] {
    const nameOf = (slug: string) =>
        tagNameBySlug instanceof Map
            ? tagNameBySlug.get(slug) || slug
            : (tagNameBySlug as Record<string, string>)[slug] || slug;

    const chips: ActiveFilterChip[] = [];
    if (params.types) {
        const typeLabel =
            TYPE_OPTIONS.find((t) => t.value === params.types)?.label || params.types;
        chips.push({
            key: "types",
            label: typeLabel,
            clearHref: buildUrl(params, { types: void 0 }),
        });
    }
    if (params.year) {
        chips.push({
            key: "year",
            label: `${params.year}年`,
            clearHref: buildUrl(params, { year: void 0 }),
        });
    }
    if (params.tag) {
        chips.push({
            key: "tag",
            label: nameOf(params.tag),
            clearHref: buildUrl(params, { tag: void 0 }),
        });
    }
    if (params.q) {
        chips.push({
            key: "q",
            label: `“${params.q}”`,
            clearHref: buildUrl(params, { q: void 0 }),
        });
    }
    return chips;
}

/**
 * 判断某个筛选链接当前是否选中：比较它关心的那几个参数。
 * 不再依赖服务端传下来的 active，pushState 改 URL 后能立刻高亮。
 */
export function isFilterActive(
    href: string,
    current: URLSearchParams,
    activeKeys: string[],
): boolean {
    const target = new URLSearchParams(href.includes("?") ? href.split("?")[1] : "");
    return activeKeys.every(
        (k) => (current.get(k) ?? "") === (target.get(k) ?? ""),
    );
}
