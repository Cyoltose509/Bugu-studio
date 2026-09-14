"use client";

/**
 * 作品库筛选链接
 *
 * 只更新 URL（push），列表由 WorksInfiniteGrid 监听 searchParams 客户端重拉。
 * 不再额外 router.refresh()，避免排序/筛选像卡住一样。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCloseWorksFilter } from "./FilterSidebarClient";

interface Props {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export default function FilterNavLink({
  href,
  active,
  children,
  className = "",
  title,
  style,
}: Props) {
  const router = useRouter();
  const closeFilter = useCloseWorksFilter();

  return (
    <Link
      href={href}
      prefetch={false}
      title={title}
      aria-current={active ? "page" : undefined}
      style={style}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        closeFilter?.();
        router.push(href, { scroll: false });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
