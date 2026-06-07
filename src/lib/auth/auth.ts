/**
 * Auth.js v5 配置
 * 策略：JWT（Credentials 登录必须用 JWT）
 * 换届下线：jwt callback 中校验 isActive，禁用后 session 返回空
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth";

export const authConfig = {
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

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;
        if (!user.emailVerified) return null;

        // 动态 import：避免 Edge Runtime 打包 password.ts
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
    async jwt({ token, user }) {
      // 首次登录时将用户信息写入 JWT
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.email = user.email!;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.email = token.email as string;

        // 每次 session 读取时校验 isActive（换届可强制下线）
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true },
        });
        if (!dbUser?.isActive) {
          session.user = undefined as any;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
