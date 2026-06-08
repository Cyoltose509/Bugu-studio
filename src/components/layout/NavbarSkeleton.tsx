/**
 * Navbar 骨架屏 — layout Suspense fallback
 * 在 auth() 完成前显示，不阻塞首屏渲染
 */
import Link from "next/link";
import Image from "next/image";

export function NavbarSkeleton() {
  return (
    <header className="sticky top-0 z-50 shadow-md" style={{ background: "#25547A" }}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
          <Image src="/images/logo.png" alt="布谷工作室" width={32} height={32} className="rounded" />
          <span>布谷工作室</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <Link href="/works" className="hover:text-white transition-colors">作品库</Link>
          <Link href="/members" className="hover:text-white transition-colors">成员</Link>
          <Link href="/history" className="hover:text-white transition-colors">历史</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/auth/login" className="text-sm text-white/80 hover:text-white transition-colors">登录</Link>
          <Link href="/auth/register" className="text-sm btn-primary px-3 py-1.5 rounded-md font-medium">注册</Link>
        </div>
      </div>
    </header>
  );
}
