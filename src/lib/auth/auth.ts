/**
 * Auth.js v5 配置
 * 策略：JWT（Credentials 登录必须用 JWT）
 * 换届下线：jwt + session callback 中校验 isActive
 *
 * 重要：middleware 在 Next.js 中始终运行在 Edge Runtime，因此 auth.ts
 * 不能顶层静态导入 prisma。所有 Prisma 调用均使用动态 import。
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validations/auth";

// ── 安全：所有错误统一返回 generic code，防止账户枚举 ──
class AuthFailed extends CredentialsSignin { code = "auth_failed"; }
class RateLimited extends CredentialsSignin { code = "auth_failed"; }

/** 登录失败限制：每邮箱 15 分钟内最多 5 次失败 */
const LOGIN_RATE_WINDOW = 15 * 60; // 15 分钟（秒）
const LOGIN_RATE_MAX = 5;

/**
 * 注意：不再使用进程内存缓存。
 * Next.js dev 模式下 server action 和 page route 跑在不同编译上下文，
 * 同一个 Map 在两个上下文中是不同的实例，导致 clear → 无效。
 * session callback 每次直接读 DB（主键索引，毫秒级），确保名称立即生效。
 *
 * 2026-06 优化：session callback 添加 30s TTL 缓存。
 * 每次客户端导航都会触发 auth() → session callback，在无缓存情况下
 * 每次都是 1 次 DB findUnique（东京 Supabase），累积延迟 ~300-500ms/click。
 * 30s 缓存将重复导航的 DB 查询降为 0，仅在缓存过期后才重新同步。
 */

/** Session 回调结果缓存 (TTL 30s) */
const _sessionCache = new Map<string, { data: SessionCacheEntry; ts: number }>();
const SESSION_CACHE_MS = 30_000;

interface SessionCacheEntry {
  isActive: boolean;
  image: string | null;
  name: string | null;
  role: string;
}

function _getSessionCache(key: string): SessionCacheEntry | null {
  const entry = _sessionCache.get(key);
  if (entry && Date.now() - entry.ts < SESSION_CACHE_MS) return entry.data;
  _sessionCache.delete(key);
  return null;
}

function _setSessionCache(key: string, data: SessionCacheEntry) {
  _sessionCache.set(key, { data, ts: Date.now() });
}

/** 强制清除指定用户的 session 缓存（角色变更/邀请码兑换后调用） */
export function invalidateSessionCache(userId: string) {
  _sessionCache.delete(userId);
}

export const authConfig = {
  secret: process.env.AUTH_SECRET!,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/signout",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new AuthFailed();

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        // ── 本地 mock：DB 不可达时用 .env.local 的 MOCK_USER_* 登录（密码绝不入库）──
        try {
          const { isMockDataEnabled, verifyMockLogin } = await import("@/lib/mock/frontend-data");
          if (isMockDataEnabled()) {
            const mockUser = verifyMockLogin(normalizedEmail, password);
            if (!mockUser) throw new AuthFailed();
            return {
              id: mockUser.id,
              email: mockUser.email,
              name: mockUser.name,
              image: mockUser.image,
              role: mockUser.role,
              memberId: mockUser.memberId,
            } as any;
          }
        } catch (e) {
          if (e instanceof AuthFailed || e instanceof RateLimited) throw e;
          // mock 模块异常时继续走真实鉴权
        }

        const { prisma } = await import("@/lib/db/prisma");

        // ── 登录速率限制：检查是否已被锁定 ──
        const { checkBlocked, isRateLimited, resetRateLimit } = await import("@/lib/utils/rate-limit");
        const rateKey = `login:fail:${normalizedEmail}`;
        const isLocked = await checkBlocked(rateKey, LOGIN_RATE_WINDOW, LOGIN_RATE_MAX);
        if (isLocked) {
          console.warn(`[auth] rate limited: ${normalizedEmail}`);
          throw new RateLimited();
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, passwordHash: true, isActive: true, emailVerified: true, name: true, image: true, role: true },
        });

        // 记录失败并递增限流计数（失败原因仅存服务端日志，不返回客户端）
        const fail = async (reason: string) => {
          console.warn(`[auth] login failed: ${normalizedEmail} - ${reason}`);
          await isRateLimited(rateKey, LOGIN_RATE_WINDOW, LOGIN_RATE_MAX).catch(() => {});
          // 记录登录失败审计
          try {
            await prisma.loginAttempt.create({
              data: { email: normalizedEmail, ipAddress: "unknown", success: false },
            });
          } catch { /* 非关键 */ }
          throw new AuthFailed();
        };

        if (!user) return await fail("user_not_found");
        if (!user.passwordHash) return await fail("no_password");
        if (!user.isActive) return await fail("account_disabled");
        if (!user.emailVerified) return await fail("email_not_verified");

        const { verifyPassword } = await import("@/lib/auth/password");
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return await fail("wrong_password");

        // 登录成功 → 清除失败计数 + 记录成功
        await resetRateLimit(rateKey).catch(() => {});
        try {
          await prisma.loginAttempt.create({
            data: { email: normalizedEmail, ipAddress: "unknown", success: true },
          });
        } catch { /* 非关键 */ }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 首次登录：从 user 对象填充 token
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.email = user.email!;
        token.picture = user.image ?? undefined;
        token.name = user.name ?? undefined;
        if ((user as any).memberId) token.memberId = (user as any).memberId;
      }

      let mockOn = false;
      try {
        const { isMockDataEnabled } = await import("@/lib/mock/frontend-data");
        mockOn = isMockDataEnabled();
      } catch { /* ignore */ }

      // mock 模式：不打 DB，保留 JWT / mock 用户信息
      if (mockOn) {
        if (!token.memberId) {
          try {
            const { getMockAuthUser } = await import("@/lib/mock/frontend-data");
            const mu = getMockAuthUser();
            if (mu?.memberId && mu.id === token.id) token.memberId = mu.memberId;
          } catch { /* ignore */ }
        }
        return token;
      }

      // trigger === "update" 时（client 端 useSession().update()），从 DB 刷新
      if (trigger === "update" && token.id) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const [dbUser, member] = await Promise.all([
            prisma.user.findUnique({
              where: { id: token.id as string },
              select: { image: true, name: true, role: true, isActive: true },
            }),
            prisma.clubMember.findUnique({
              where: { userId: token.id as string },
              select: { id: true },
            }),
          ]);
          if (!dbUser?.isActive) return {} as any;
          if (dbUser) {
            token.picture = dbUser.image ?? undefined;
            token.name = dbUser.name ?? undefined;
            token.role = dbUser.role;
          }
          // 同步 memberId 到 token，供 middleware 备用校验
          if (member) token.memberId = member.id;
          else delete (token as any).memberId;
        } catch {
          // Edge Runtime 降级：使用现有 token 数据
        }
      }

      // 首次登录时也查一下 memberId（避免 jwt callback 未执行过 update 时无此字段）
      if (!token.memberId && token.id) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const member = await prisma.clubMember.findUnique({
            where: { userId: token.id as string },
            select: { id: true },
          });
          if (member) token.memberId = member.id;
        } catch { /* Edge Runtime 降级 */ }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.email = token.email as string;
        session.user.image = (token.picture as string) ?? undefined;
        session.user.name = (token.name as string) ?? undefined;
        (session.user as any).memberId = (token as any).memberId || undefined;

        const userId = token.id as string;

        let mockOn = false;
        try {
          const { isMockDataEnabled } = await import("@/lib/mock/frontend-data");
          mockOn = isMockDataEnabled();
        } catch { /* ignore */ }

        if (mockOn) {
          _setSessionCache(userId, {
            isActive: true,
            image: session.user.image ?? null,
            name: session.user.name ?? null,
            role: String(session.user.role || "MEMBER"),
          });
          return session;
        }

        // 30 秒内有缓存 → 跳过 DB 查询（消除每次导航的 ~300ms 延迟）
        const cached = _getSessionCache(userId);
        if (cached) {
          if (!cached.isActive) { session.user = undefined as any; return session; }
          if (cached.image) session.user.image = cached.image;
          if (cached.name) session.user.name = cached.name;
          session.user.role = cached.role as any;
          return session;
        }

        // 缓存未命中 → 查 DB 并写入缓存
        try {
          const { prisma: sessionPrisma } = await import("@/lib/db/prisma");
          const dbUser = await sessionPrisma.user.findUnique({
            where: { id: userId },
            select: { isActive: true, image: true, name: true, role: true },
          });

          if (!dbUser?.isActive) {
            _setSessionCache(userId, { isActive: false, image: null, name: null, role: "" });
            session.user = undefined as any;
          } else {
            _setSessionCache(userId, {
              isActive: true,
              image: dbUser.image ?? null,
              name: dbUser.name ?? null,
              role: dbUser.role,
            });
            if (dbUser.image) session.user.image = dbUser.image;
            if (dbUser.name) session.user.name = dbUser.name;
            if (dbUser.role) session.user.role = dbUser.role;
          }
        } catch {
          // Edge runtime 降级：使用 JWT 中的数据
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          // Edge runtime 降级
        }
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
