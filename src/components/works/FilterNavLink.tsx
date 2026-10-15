"use client";

/**
 * 作品库筛选链接
 *
 * 只更新 URL，列表由 WorksInfiniteGrid 监听 searchParams 客户端重拉。
 * 用原生 History API 而非 router.push —— 后者会触发整页 RSC 导航，
 * 服务端要把筛选侧栏、首屏作品、总数全查一遍，而这份结果客户端马上会
 * 用 /api/works 重拉覆盖掉，等于白跑一趟还卡住 UI。
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCloseWorksFilter } from "./FilterSidebarClient";
import { isFilterActive } from "@/lib/works/filters";

interface Props {
  href: string;
  active: boolean;
  /** 该链接负责哪几个筛选参数；给了就按当前 URL 实时判定高亮 */
  activeKeys?: string[];
  children: React.ReactNode;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export default function FilterNavLink({
  href,
  active,
  activeKeys,
  children,
  className = "",
  title,
  style,
}: Props) {
  const closeFilter = useCloseWorksFilter();
  const sp = useSearchParams();
  // 不触发 RSC 导航后，服务端传下来的 active 不会更新，所以按 URL 自己判
  const isActive =
    activeKeys && activeKeys.length > 0
      ? isFilterActive(href, new URLSearchParams(sp.toString()), activeKeys)
      : active;

  return (
    <Link
      href={href}
      prefetch={false}
      title={title}
      aria-current={isActive ? "page" : undefined}
      style={style}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        closeFilter?.();
        if (window.location.pathname + window.location.search === href) return;
        // 只换 URL，不触发 RSC 导航；Next 会同步更新 useSearchParams
        window.history.pushState(null, "", href);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
