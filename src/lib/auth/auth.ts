/**
 * Auth.js v5 配置
 * 策略：JWT（Credentials 登录必须用 JWT）
 * 换届下线：jwt + session callback 中校验 isActive
 * 注意：顶层不 import Prisma，确保 middleware (Edge Runtime) 兼容
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validations/auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET!,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  pages: {
    signIn: "/auth/login",
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
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const { prisma } = await import("@/lib/db/prisma");

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;
        if (!user.emailVerified) return null;

        const { verifyPassword } = await import("@/lib/auth/password");
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

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
        // 优先用 jwt callback 同步后的 token 值
        session.user.image = (token.picture as string) ?? undefined;
        session.user.name = (token.name as string) ?? undefined;

        // 额外 from-DB 校验 isActive（仅 Node.js 环境，Edge 降级）
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { isActive: true, image: true, name: true },
          });
          if (!dbUser?.isActive) {
            session.user = undefined as any;
          } else {
            // 兜底：若 jwt 没同步到，用 session callback 结果覆盖
            if (dbUser.image) session.user.image = dbUser.image;
            if (dbUser.name) session.user.name = dbUser.name;
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
