/**
 * Navbar 骨架屏 — layout Suspense fallback
 * 在 auth() 完成前显示，不阻塞首屏渲染
 */
import Link from "next/link";
import Image from "next/image";
import NavLink from "@/components/layout/NavLink";

export function NavbarSkeleton() {
  return (
    <header className="sticky top-0 z-50 shadow-md bg-brand-navy/90">
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:opacity-85 transition-opacity nav-link shrink-0">
          <Image src="/images/logo.png" alt="BUGOO STUDIO" width={32} height={32} className="rounded shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">布谷工作室</span>
        </Link>
        <nav
          className="flex items-center justify-center gap-2 sm:gap-3 md:gap-6 text-[12px] sm:text-sm md:text-base min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="主导航"
        >
          <NavLink href="/works">作品库</NavLink>
          <NavLink href="/members">成员</NavLink>
          <NavLink href="/activities">活动</NavLink>
          <NavLink href="/history">历史</NavLink>
        </nav>
        <div className="flex items-center justify-end gap-2 shrink-0 min-h-8">
          <Link href="/auth/login" className="hidden md:inline text-sm text-white/80 hover:text-white transition-colors nav-link">登录</Link>
          <Link href="/auth/register" className="hidden md:inline-flex text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link">注册</Link>
        </div>
      </div>
    </header>
  );
}
