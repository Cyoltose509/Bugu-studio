"use client";

/**
 * 侧栏标签筛选
 *
 * 高亮与 href 都按当前 URL 实时算：点击已选标签要变成「清除」，
 * 而筛选不再触发 RSC 重渲染，服务端给的 active 不会更新。
 */
import { useSearchParams } from "next/navigation";
import FilterNavLink from "./FilterNavLink";
import EngineTagIcon from "@/components/tags/EngineTagIcon";
import {
    getEngineChipClass,
    getEngineColor,
    isEngineTagSlug,
} from "@/lib/tags/engine-tags";
import { buildUrl } from "@/lib/works/filters";
import { useLang } from "@/lib/i18n/LangProvider";
import { tagDisplayName, tagGroupDisplayName } from "@/lib/tags/tag-names";

export type TagChip = {
    slug: string;
    name: string;
    color?: string | null;
    count: number;
};

export default function TagFilterChips({
    groups,
}: {
    groups: { group: string; tags: TagChip[] }[];
}) {
    const sp = useSearchParams();
    const current = Object.fromEntries(sp.entries());
    const currentTag = sp.get("tag") || "";
    const { lang } = useLang();

    return (
        <div className="space-y-3">
            {groups.map(({ group, tags }) => (
                <div key={group}>
                    <h4 className="text-xs font-medium mb-1.5 text-brand-text-muted">
                        {tagGroupDisplayName(group, lang)}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                            const engine = isEngineTagSlug(tag.slug);
                            const color = getEngineColor(tag.slug) || tag.color || "#88C232";
                            const active = currentTag === tag.slug;
                            const displayName = tagDisplayName(tag.slug, tag.name, lang);
                            return (
                                <FilterNavLink
                                    key={tag.slug}
                                    href={buildUrl(current, {
                                        tag: active ? void 0 : tag.slug,
                                    })}
                                    active={active}
                                    title={`${displayName}（${tag.count}）`}
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 transition-all ${
                                        engine
                                            ? `rounded-full font-medium ${getEngineChipClass(tag.slug)}`
                                            : "rounded"
                                    } ${active ? "ring-1 ring-offset-1 opacity-100" : "opacity-75 hover:opacity-100"}`}
                                    style={
                                        engine
                                            ? undefined
                                            : { color, backgroundColor: `${color}18` }
                                    }
                                >
                                    {engine && <EngineTagIcon slug={tag.slug} />}
                                    {displayName}
                                    <span className="opacity-70">({tag.count})</span>
                                </FilterNavLink>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
