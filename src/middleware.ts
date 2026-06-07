/**
 * Next.js 中间件 - 路由保护 + 安全头
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

// 需要登录的路由
const PROTECTED_ROUTES = ["/dashboard", "/submit", "/profile", "/settings"];
// 需要 MEMBER 及以上权限
const MEMBER_ROUTES = ["/submit"];
// 需要 ADMIN 权限
const ADMIN_ROUTES = ["/admin"];

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const pathname = nextUrl.pathname;

  // 检查管理后台路由
  if (pathname.startsWith("/admin")) {
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/auth/login?callbackUrl=/admin", req.url));
    }
  }

  // 检查需要登录的路由
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!session?.user) {
      return NextResponse.redirect(
        new URL(`/auth/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      );
    }
  }

  // 检查 MEMBER 路由
  if (MEMBER_ROUTES.some((route) => pathname.startsWith(route))) {
    const role = session?.user?.role;
    if (!role || !["MEMBER", "REVIEWER", "ADMIN"].includes(role)) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images|icons).*)",
  ],
};
