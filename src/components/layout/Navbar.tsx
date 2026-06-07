/**
 * 导航栏组件
 */

import Link from "next/link";
import { auth } from "@/lib/auth/auth";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-2xl">🎮</span>
          <span className="text-white">布谷工作室</span>
        </Link>

        {/* 主导航 */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <Link href="/works" className="hover:text-white transition-colors">
            作品库
          </Link>
          <Link href="/members" className="hover:text-white transition-colors">
            成员
          </Link>
          <Link href="/history" className="hover:text-white transition-colors">
            历史
          </Link>
        </nav>

        {/* 用户区域 */}
        <div className="flex items-center gap-3">
          {session?.user ? (
            <div className="flex items-center gap-3">
              {(session.user.role === "MEMBER" ||
                session.user.role === "REVIEWER" ||
                session.user.role === "ADMIN") && (
                <Link
                  href="/submit"
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition-colors"
                >
                  提交作品
                </Link>
              )}
              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  管理后台
                </Link>
              )}
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                  {session.user.name?.[0]?.toUpperCase() || "U"}
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md transition-colors"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
