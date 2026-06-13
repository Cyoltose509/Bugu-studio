/**
 * Auth.js v5 配置
 * 策略：JWT（Credentials 登录必须用 JWT）
 * 换届下线：jwt + session callback 中校验 isActive
 * 注意：顶层不 import Prisma，确保 middleware (Edge Runtime) 兼容
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
 */

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
      }

      // trigger === "update" 时（client 端 useSession().update()），从 DB 刷新
      if (trigger === "update" && token.id) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { image: true, name: true, role: true, isActive: true },
          });
          if (!dbUser?.isActive) return {} as any;
          if (dbUser) {
            token.picture = dbUser.image ?? undefined;
            token.name = dbUser.name ?? undefined;
            token.role = dbUser.role;
          }
        } catch {
          // Edge Runtime 降级
        }
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

        // 每次从 DB 同步最新状态（无内存缓存，避免跨上下文不同步）
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const userId = token.id as string;

          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { isActive: true, image: true, name: true, role: true },
          });

          if (!dbUser?.isActive) {
            session.user = undefined as any;
          } else {
            if (dbUser.image) session.user.image = dbUser.image;
            if (dbUser.name) session.user.name = dbUser.name;
            if (dbUser.role) session.user.role = dbUser.role;
          }
        } catch {
          // Edge runtime 降级
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
