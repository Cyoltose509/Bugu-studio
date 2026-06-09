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

// ── 细分错误类型（前端据此显示不同提示） ──
class UserNotFound extends CredentialsSignin { code = "user_not_found"; }
class EmailNotVerified extends CredentialsSignin { code = "email_not_verified"; }
class AccountDisabled extends CredentialsSignin { code = "account_disabled"; }
class WrongPassword extends CredentialsSignin { code = "wrong_password"; }
class NoPasswordLogin extends CredentialsSignin { code = "no_password_login"; }

/** 短期内存缓存：减少 session callback 的 DB 查询（60s TTL） */
const sessionCache = new Map<string, { data: any; ts: number }>();
const SESSION_CACHE_TTL = 60_000; // 60 秒

/** 清除指定用户的 session 缓存（修改用户信息后调用） */
export function clearSessionCache(userId: string) {
  sessionCache.delete(userId);
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
        if (!parsed.success) throw new CredentialsSignin();

        const { email, password } = parsed.data;
        const { prisma } = await import("@/lib/db/prisma");

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) throw new UserNotFound();
        if (!user.passwordHash) throw new NoPasswordLogin();
        if (!user.isActive) throw new AccountDisabled();
        if (!user.emailVerified) throw new EmailNotVerified();

        const { verifyPassword } = await import("@/lib/auth/password");
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) throw new WrongPassword();

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

      // trigger === "update" 时（client 端 useSession().update()），从 DB 刷新并更新缓存
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
            // 更新缓存
            sessionCache.set(token.id as string, { data: dbUser, ts: Date.now() });
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
        // 优先用 jwt callback 同步后的 token 值
        session.user.image = (token.picture as string) ?? undefined;
        session.user.name = (token.name as string) ?? undefined;

        // 每次读取 session 时从 DB 同步最新状态（30s 内存缓存，降低 DB 压力）
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const userId = token.id as string;

          // 检查缓存
          const cached = sessionCache.get(userId);
          let dbUser: any;
          if (cached && Date.now() - cached.ts < SESSION_CACHE_TTL) {
            dbUser = cached.data;
          } else {
            dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { isActive: true, image: true, name: true, role: true },
            });
            if (dbUser) sessionCache.set(userId, { data: dbUser, ts: Date.now() });
          }

          if (!dbUser?.isActive) {
            session.user = undefined as any;
          } else {
            // 同步 DB 中最新的 image / name / role
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
