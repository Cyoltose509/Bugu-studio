/**
 * Next.js 中间件 — 路由保护 + 安全头
 *
 * 优化：仅对受保护路由调用 auth()，公开路由直接放行
 * CORS preflight (OPTIONS) 立即返回 204
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

// 公开路由（完全跳过 auth() 调用，提升性能）
const PUBLIC_PREFIXES = ["/", "/works", "/members", "/about", "/join", "/api"];

/**
 * 判断是否为 RSC 请求（Next.js 客户端导航/预取）
 */
function isRscRequest(req: NextRequest): boolean {
  return req.headers.get("RSC") === "1" || req.nextUrl.searchParams.has("_rsc");
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. CORS preflight — 立即响应 204
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 });
  }

  // 2. 判断是否需要认证检查
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isMember = MEMBER_ROUTES.some((r) => pathname.startsWith(r));
  const isAdmin = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const needsAuth = isProtected || isMember || isAdmin;

  // 3. 公开路由且不是 RSC 请求 → 直接放行，不调用 auth()
  if (!needsAuth && !isRscRequest(req)) {
    return NextResponse.next();
  }

  // 4. 需要认证的路由，才调用 auth()
  const session = await auth();
  const user = session?.user;

  // 检查 ADMIN 路由
  if (isAdmin) {
    if (!user || (user as any).role !== "ADMIN") {
      if (isRscRequest(req)) return new NextResponse("Unauthorized", { status: 401 });
      return NextResponse.redirect(new URL("/auth/login?callbackUrl=/admin", req.url));
    }
  }

  // 检查受保护路由（需要登录）
  if (isProtected) {
    if (!user) {
      if (isRscRequest(req)) return new NextResponse("Unauthorized", { status: 401 });
      return NextResponse.redirect(
        new URL(`/auth/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      );
    }
  }

  // 检查 MEMBER 路由
  if (isMember) {
    const role = (user as any)?.role;
    if (!role || !["MEMBER", "REVIEWER", "ADMIN"].includes(role)) {
      if (isRscRequest(req)) return new NextResponse("Unauthorized", { status: 401 });
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico|images|icons).*)",
  ],
};
