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
