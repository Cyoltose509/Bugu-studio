/**
 * Next.js 中间件 — 路由保护 + 安全头 + www 规范化
 *
 * 重要：CORS preflight (OPTIONS) 请求不能被重定向，否则浏览器会拒绝跨域请求。
 * RSC 请求同样需要避免跨域重定向，否则会导致 "Redirect is not allowed
 * for a preflight request" 错误。
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

/**
 * 判断是否为 RSC 请求
 * Next.js 客户端导航/预取会发送 RSC 请求（带 _rsc 参数或 RSC header）
 */
function isRscRequest(req: NextRequest): boolean {
  return req.headers.get("RSC") === "1" || req.nextUrl.searchParams.has("_rsc");
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ══════════════════════════════════════════════════
  // 1. CORS preflight — 立即响应 204，绝不重定向
  // ══════════════════════════════════════════════════
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 });
  }

  // ══════════════════════════════════════════════════
  // 2. 获取会话（直接调用 auth()，不使用 wrapper）
  // ══════════════════════════════════════════════════
  const session = await auth();
  const user = session?.user;

  // ══════════════════════════════════════════════════
  // 4. 检查 ADMIN 路由
  // ══════════════════════════════════════════════════
  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!user || (user as any).role !== "ADMIN") {
      // RSC 请求：返回 401 让客户端降级为完整页面导航
      if (isRscRequest(req)) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/login?callbackUrl=/admin", req.url));
    }
  }

  // ══════════════════════════════════════════════════
  // 5. 检查受保护路由（需要登录）
  // ══════════════════════════════════════════════════
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!user) {
      if (isRscRequest(req)) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      return NextResponse.redirect(
        new URL(`/auth/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      );
    }
  }

  // ══════════════════════════════════════════════════
  // 6. 检查 MEMBER 路由
  // ══════════════════════════════════════════════════
  if (MEMBER_ROUTES.some((route) => pathname.startsWith(route))) {
    const role = (user as any)?.role;
    if (!role || !["MEMBER", "REVIEWER", "ADMIN"].includes(role)) {
      if (isRscRequest(req)) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
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
