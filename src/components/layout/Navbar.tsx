/**
 * 导航栏 - 深蓝 #25547A + 白色文字
 * 保持为 Server Component，用户会话直接在服务端获取
 */
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth/auth";
import NotificationBell from "./NotificationBell";
import NavLink from "./NavLink";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 shadow-md" style={{ background: "#25547A" }}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:opacity-85 transition-opacity nav-link">
          <Image src="/images/logo.png" alt="布谷工作室" width={32} height={32} className="rounded" />
          <span>布谷工作室</span>
        </Link>

        {/* 主导航 - 添加点击反馈的 CSS 类 */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <NavLink href="/works">作品库</NavLink>
          <NavLink href="/members">成员</NavLink>
          <NavLink href="/activities">活动</NavLink>
          <NavLink href="/history">历史</NavLink>
        </nav>

        {/* 用户区域 */}
        <div className="flex items-center gap-3">
          {session?.user ? (
            <div className="flex items-center gap-3">
              {(session.user.role === "MEMBER" || session.user.role === "ADMIN") && (
                <Link href="/submit" className="text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link">
                  提交作品
                </Link>
              )}
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="text-sm text-white/80 hover:text-white transition-colors nav-link">
                  管理后台
                </Link>
              )}
              <NotificationBell />
              <Link href="/profile" className="flex items-center gap-2 text-sm text-white/80 hover:text-white nav-link">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || ""}
                    width={28}
                    height={28}
                    className="rounded-full object-cover border border-white/30"
                    referrerPolicy="no-referrer"
                    sizes="28px"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#E38043" }}>
                    {session.user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="text-sm text-white/80 hover:text-white transition-colors nav-link">登录</Link>
              <Link href="/auth/register" className="text-sm btn-primary px-3 py-1.5 rounded-md font-medium nav-link">注册</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

