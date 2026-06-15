/**
 * Next.js 中间件 — 路由保护 + 安全头 + 审计信息传递
 *
 * 中间件运行在 Edge Runtime，不能直接使用 Node.js AsyncLocalStorage。
 * 替代方案：通过响应头传递 x-user-id 和 x-client-ip，
 * API Routes / Server Actions 通过 auditContext 辅助函数读取这些头信息。
 *
 * 优化：仅对受保护路由调用 auth()，公开路由直接放行。
 * CORS preflight (OPTIONS) 立即返回 204。
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
 * 从请求获取客户端 IP
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * 判断是否为 RSC 请求（Next.js 客户端导航/预取）
 */
function isRscRequest(req: NextRequest): boolean {
  return req.headers.get("RSC") === "1" || req.nextUrl.searchParams.has("_rsc");
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // 1. CORS preflight — 立即响应 204
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 });
  }

  // 2. 判断是否需要认证检查
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isMember = MEMBER_ROUTES.some((r) => pathname.startsWith(r));
  const isAdmin = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const needsAuth = isProtected || isMember || isAdmin;

  // 3. 公开路由 → 直接放行，附带审计 IP 头
  if (!needsAuth) {
    const res = NextResponse.next();
    res.headers.set("x-audit-ip", ip);
    return res;
  }

  // 4. 需要认证的路由，调用 auth()
  const session = await auth();
  const user = session?.user;

  // 创建响应并注入审计头
  const injectAuditHeaders = (res: NextResponse) => {
    res.headers.set("x-audit-ip", ip);
    if ((user as any)?.id) {
      res.headers.set("x-audit-user-id", (user as any).id);
    }
    return res;
  };

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
    const memberId = (user as any)?.memberId;
    // 双重校验：role 为 MEMBER/ADMIN，或 JWT 中有 memberId（ClubMember 记录）
    if ((!role || !["MEMBER", "ADMIN"].includes(role)) && !memberId) {
      if (isRscRequest(req)) return new NextResponse("Unauthorized", { status: 401 });
      if (user) {
        return NextResponse.redirect(new URL("/auth/login?error=permission_denied", req.url));
      }
      return NextResponse.redirect(
        new URL(`/auth/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      );
    }
  }

  return injectAuditHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico|images|icons).*)",
  ],
};
