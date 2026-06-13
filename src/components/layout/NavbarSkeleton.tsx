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
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:opacity-85 transition-opacity nav-link">
          <Image src="/images/logo.png" alt="布谷工作室" width={32} height={32} className="rounded" />
          <span>布谷工作室</span>
        </Link>
        <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-6">
          <NavLink href="/works">作品库</NavLink>
          <NavLink href="/members">成员</NavLink>
          <NavLink href="/activities">活动</NavLink>
          <NavLink href="/history">历史</NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/auth/login" className="text-sm text-white/80 hover:text-white transition-colors nav-link">登录</Link>
          <Link href="/auth/register" className="text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link">注册</Link>
        </div>
      </div>
    </header>
  );
}
