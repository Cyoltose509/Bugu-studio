"use client";

/**
 * 侧栏里的筛选条目（类型 / 年份）
 *
 * 高亮必须按当前 URL 自己算：筛选改用 pushState 后不再有 RSC 重渲染，
 * 服务端传下来的 active 会一直停在初始值。
 */
import { useSearchParams } from "next/navigation";
import FilterNavLink from "./FilterNavLink";
import { isFilterActive } from "@/lib/works/filters";

export default function FilterLink({
  href,
  activeKeys,
  label,
}: {
  href: string;
  activeKeys: string[];
  label: string;
}) {
  const sp = useSearchParams();
  const active = isFilterActive(href, new URLSearchParams(sp.toString()), activeKeys);

  return (
    <FilterNavLink
      href={href}
      active={active}
      className={`block text-sm px-3 py-1.5 rounded transition-colors ${
        active
          ? "font-medium bg-brand-navy/10 text-brand-navy"
          : "text-brand-text-secondary hover:bg-brand-surface"
      }`}
    >
      {label}
    </FilterNavLink>
  );
}
